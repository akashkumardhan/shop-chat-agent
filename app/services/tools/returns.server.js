/**
 * Return tools — via Admin API.
 *
 * Path B Hybrid: customer identity comes from JWT `sub`; ownership is verified
 * server-side against the Admin API; mutations run with the shop's app token.
 *
 * Notes on each operation:
 *   - calculate_return: Admin only exposes refund calculation *after* a return
 *     exists (Return.suggestedFinancialOutcome). For a pre-request preview we
 *     compute manually from the order's fulfillment line items. Result is
 *     estimated — restocking fees, prorated cart discounts, and merchant-
 *     specific return rules aren't accounted for.
 *   - request_return: Admin's returnRequest mutation creates the return with
 *     status REQUESTED. The merchant then approves or declines via admin UI;
 *     a Shopify constraint we cannot bypass for self-serve returns.
 *
 * Required Admin scopes: read_orders, read_returns, write_returns
 */
import { adminGraphQL } from "../admin-graphql.server";
import { requireCustomer } from "../customer-identity.server";

// Verify (a) order belongs to the authed customer, (b) the requested
// fulfillment line items belong to that order, then return enough detail
// to compute a refund preview.
const VERIFY_AND_FETCH_QUERY = /* GraphQL */ `
  query VerifyOrderForReturn($orderId: ID!) {
    order(id: $orderId) {
      id
      name
      currencyCode
      customer { id }
      fulfillments(first: 5) {
        id
        fulfillmentLineItems(first: 50) {
          nodes {
            id
            quantity
            lineItem {
              id
              title
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedUnitPriceSet { shopMoney { amount currencyCode } }
              taxLines { priceSet { shopMoney { amount currencyCode } } rate }
            }
          }
        }
      }
    }
  }
`;

/** Lookup helper: find a fulfillment-line-item record by its GID across all fulfillments. */
function findFulfillmentLineItem(order, fulfillmentLineItemId) {
  for (const f of order.fulfillments || []) {
    for (const node of f.fulfillmentLineItems?.nodes || []) {
      if (node.id === fulfillmentLineItemId) return node;
    }
  }
  return null;
}

// ---------- calculate_return ----------

/**
 * @param {{conversationId: string, shop: string}} ctx
 * @param {{orderId: string, returnLineItems: Array<{fulfillmentLineItemId: string, quantity: number, returnReason?: string}>}} args
 */
export async function calculateReturn(ctx, args = {}) {
  if (!args?.orderId) return { error: "orderId is required" };
  if (!Array.isArray(args.returnLineItems) || args.returnLineItems.length === 0) {
    return { error: "returnLineItems must be a non-empty array" };
  }
  if (!ctx.shop) return { error: "shop context missing" };

  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };

  let data;
  try {
    data = await adminGraphQL(ctx.shop, VERIFY_AND_FETCH_QUERY, { orderId: args.orderId });
  } catch (e) {
    return { error: e.message };
  }
  const order = data?.order;
  if (!order) return { error: "We couldn't find that order on your account." };
  if (order.customer?.id !== cust.customerGid) {
    return { error: "That order isn't associated with your account." };
  }

  // Manual estimate: sum (discountedUnitPrice × quantity-to-return) + estimated tax.
  // Tax rate is derived from the line item's existing tax lines as
  // (sum tax / (line subtotal)) so we proportionally apply it.
  let subtotal = 0;
  let tax = 0;
  let currency = order.currencyCode || "USD";
  const lines = [];

  for (const requested of args.returnLineItems) {
    const fli = findFulfillmentLineItem(order, requested.fulfillmentLineItemId);
    if (!fli) {
      return {
        error: `Line item ${requested.fulfillmentLineItemId} isn't part of order ${order.name}.`,
      };
    }
    const qty = Math.min(Number(requested.quantity) || 0, fli.quantity);
    if (qty <= 0) continue;

    const li = fli.lineItem;
    const unit = parseFloat(li?.discountedUnitPriceSet?.shopMoney?.amount ?? li?.originalUnitPriceSet?.shopMoney?.amount ?? 0);
    const lineSubtotal = unit * qty;
    subtotal += lineSubtotal;
    currency = li?.discountedUnitPriceSet?.shopMoney?.currencyCode || currency;

    // Tax estimate: prorate the line's tax across its quantity
    const liTaxTotal = (li?.taxLines || []).reduce(
      (acc, t) => acc + parseFloat(t?.priceSet?.shopMoney?.amount ?? 0),
      0
    );
    const lineTax = li?.quantity ? (liTaxTotal / li.quantity) * qty : 0;
    tax += lineTax;

    lines.push({
      fulfillmentLineItemId: fli.id,
      title: li?.title,
      quantity: qty,
      subtotal: `${lineSubtotal.toFixed(2)} ${currency}`,
    });
  }

  return {
    estimatedRefund: `${(subtotal + tax).toFixed(2)} ${currency}`,
    subtotal: `${subtotal.toFixed(2)} ${currency}`,
    tax: `${tax.toFixed(2)} ${currency}`,
    currency,
    lines,
    disclaimer:
      "This is an estimate. Final refund may differ due to restocking fees, return shipping fees, prorated discounts, or merchant-specific return rules.",
  };
}

// ---------- request_return ----------

const RETURN_REQUEST_MUTATION = /* GraphQL */ `
  mutation ReturnRequest($input: ReturnRequestInput!) {
    returnRequest(input: $input) {
      return {
        id
        status
        order { id name }
      }
      userErrors { field message code }
    }
  }
`;

/**
 * @param {{conversationId: string, shop: string}} ctx
 * @param {{orderId: string, returnLineItems: Array<{fulfillmentLineItemId: string, quantity: number, returnReason?: string, customerNote?: string}>}} args
 */
export async function requestReturn(ctx, args = {}) {
  if (!args?.orderId) return { error: "orderId is required" };
  if (!Array.isArray(args.returnLineItems) || args.returnLineItems.length === 0) {
    return { error: "returnLineItems must be a non-empty array" };
  }
  if (!ctx.shop) return { error: "shop context missing" };

  const cust = await requireCustomer(ctx.conversationId);
  if (cust._authRequired) return { _authRequired: true };

  // Ownership verification — never let a chat user request a return on
  // someone else's order.
  let owner;
  try {
    owner = await adminGraphQL(ctx.shop, VERIFY_AND_FETCH_QUERY, { orderId: args.orderId });
  } catch (e) {
    return { error: e.message };
  }
  const order = owner?.order;
  if (!order) return { error: "We couldn't find that order on your account." };
  if (order.customer?.id !== cust.customerGid) {
    return { error: "That order isn't associated with your account." };
  }
  // Verify each line item belongs to the order
  for (const li of args.returnLineItems) {
    if (!findFulfillmentLineItem(order, li.fulfillmentLineItemId)) {
      return { error: `Line item ${li.fulfillmentLineItemId} isn't part of order ${order.name}.` };
    }
  }

  const input = {
    orderId: args.orderId,
    returnLineItems: args.returnLineItems.map((li) => ({
      fulfillmentLineItemId: li.fulfillmentLineItemId,
      quantity: li.quantity,
      returnReason: li.returnReason || "UNKNOWN",
      ...(li.customerNote ? { customerNote: li.customerNote } : {}),
    })),
  };

  let data;
  try {
    data = await adminGraphQL(ctx.shop, RETURN_REQUEST_MUTATION, { input });
  } catch (e) {
    return { error: e.message };
  }

  const result = data?.returnRequest;
  if (result?.userErrors?.length) {
    return { error: result.userErrors.map((e) => e.message).join("; ") };
  }
  if (!result?.return) {
    return { error: "Could not create the return request. Please try again." };
  }

  return {
    requested: true,
    returnId: result.return.id,
    status: result.return.status,
    orderName: result.return.order?.name,
    message:
      "Your return request is on its way to the team. You'll hear back once it's approved — refunds are issued after the items are received.",
  };
}

// ---------- tool definitions ----------

export const returnsToolDefinitions = [
  {
    name: "calculate_return",
    description:
      "Estimate the refund the customer would receive for a potential return. Returns an itemized estimate (not final — may be adjusted for restocking fees, return shipping, discounts, etc.). Use this before request_return so the shopper sees what they'd get back. Requires customer authentication.",
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The Shopify order GID, e.g. 'gid://shopify/Order/123456789'.",
        },
        returnLineItems: {
          type: "array",
          description: "The line items to include in the return.",
          items: {
            type: "object",
            properties: {
              fulfillmentLineItemId: { type: "string", description: "The fulfillment line item GID." },
              quantity: { type: "integer", minimum: 1 },
              returnReason: {
                type: "string",
                enum: [
                  "COLOR",
                  "DEFECTIVE",
                  "NOT_AS_DESCRIBED",
                  "OTHER",
                  "SIZE_TOO_LARGE",
                  "SIZE_TOO_SMALL",
                  "STYLE",
                  "UNKNOWN",
                  "UNWANTED",
                  "WRONG_ITEM",
                ],
              },
            },
            required: ["fulfillmentLineItemId", "quantity"],
          },
        },
      },
      required: ["orderId", "returnLineItems"],
    },
  },
  {
    name: "request_return",
    description:
      "Submit a return request for an order. The status is set to REQUESTED — the merchant must approve before the refund is processed. Confirm details with the shopper (item, quantity, reason) before calling. Requires customer authentication.",
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The Shopify order GID, e.g. 'gid://shopify/Order/123456789'.",
        },
        returnLineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fulfillmentLineItemId: { type: "string" },
              quantity: { type: "integer", minimum: 1 },
              returnReason: {
                type: "string",
                enum: [
                  "COLOR",
                  "DEFECTIVE",
                  "NOT_AS_DESCRIBED",
                  "OTHER",
                  "SIZE_TOO_LARGE",
                  "SIZE_TOO_SMALL",
                  "STYLE",
                  "UNKNOWN",
                  "UNWANTED",
                  "WRONG_ITEM",
                ],
              },
              customerNote: { type: "string", description: "Optional note from the shopper." },
            },
            required: ["fulfillmentLineItemId", "quantity"],
          },
        },
      },
      required: ["orderId", "returnLineItems"],
    },
  },
];
