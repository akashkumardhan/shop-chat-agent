/**
 * Order operations tools — list (paginated 3-at-a-time) and cancel.
 *
 * Architecture (Path B Hybrid):
 *   The customer's OAuth token only grants the MCP server scope, so we
 *   identify the customer via the JWT `sub` claim (see customer-identity.server.js)
 *   and then run all order queries server-side against the Admin API
 *   using the merchant's stored Session.accessToken.
 *
 * Pagination cursor is persisted on Conversation.orderCursor so the LLM
 * doesn't have to thread it.
 */
import { adminGraphQL } from "../admin-graphql.server";
import { requireCustomer } from "../customer-identity.server";
import { getOrderCursor, setOrderCursor } from "../../db.server";

const PAGE_SIZE = 3;

// ---------- list_my_orders ----------

const LIST_ORDERS_QUERY = /* GraphQL */ `
  query ListMyOrders($id: ID!, $first: Int!, $after: String) {
    customer(id: $id) {
      id
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          name
          processedAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet {
            shopMoney { amount currencyCode }
          }
          lineItems(first: 5) {
            nodes { title quantity }
          }
        }
      }
    }
  }
`;

/**
 * @param {{ conversationId: string, shop: string }} ctx
 * @param {{ next?: boolean, reset?: boolean }} args
 */
export async function listMyOrders(ctx, args = {}) {
  const { conversationId, shop } = ctx;
  if (!shop) return { error: "shop context missing" };

  const cust = await requireCustomer(conversationId);
  if (cust._authRequired) return { _authRequired: true };

  let cursor = null;
  if (args.next) cursor = await getOrderCursor(conversationId);

  let data;
  try {
    data = await adminGraphQL(shop, LIST_ORDERS_QUERY, {
      id: cust.customerGid,
      first: PAGE_SIZE,
      after: cursor,
    });
  } catch (e) {
    return { error: e.message };
  }

  const conn = data?.customer?.orders;
  if (!conn) {
    return { orders: [], hasMore: false, message: "No orders found on your account." };
  }

  await setOrderCursor(
    conversationId,
    conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null
  );

  const orders = (conn.nodes || []).map((o) => ({
    id: o.id,
    name: o.name,
    processedAt: o.processedAt,
    financialStatus: o.displayFinancialStatus,
    fulfillmentStatus: o.displayFulfillmentStatus,
    total: o.currentTotalPriceSet?.shopMoney
      ? `${o.currentTotalPriceSet.shopMoney.amount} ${o.currentTotalPriceSet.shopMoney.currencyCode}`
      : null,
    lineItems: (o.lineItems?.nodes || []).map((li) => `${li.quantity}× ${li.title}`),
  }));

  return {
    orders,
    hasMore: !!conn.pageInfo?.hasNextPage,
    pageSize: PAGE_SIZE,
  };
}

// ---------- cancel_my_order ----------

const VERIFY_ORDER_OWNERSHIP_QUERY = /* GraphQL */ `
  query VerifyOrder($id: ID!) {
    order(id: $id) {
      id
      name
      cancelledAt
      displayFinancialStatus
      customer { id }
      fulfillments(first: 1) { id }
    }
  }
`;

const ORDER_CANCEL_MUTATION = /* GraphQL */ `
  mutation OrderCancel(
    $orderId: ID!
    $reason: OrderCancelReason!
    $refundMethod: OrderCancelRefundMethodInput!
    $restock: Boolean!
    $notifyCustomer: Boolean
    $staffNote: String
  ) {
    orderCancel(
      orderId: $orderId
      reason: $reason
      refundMethod: $refundMethod
      restock: $restock
      notifyCustomer: $notifyCustomer
      staffNote: $staffNote
    ) {
      job { id done }
      orderCancelUserErrors { field message code }
      userErrors { field message }
    }
  }
`;

/**
 * @param {{ conversationId: string, shop: string }} ctx
 * @param {{ orderId: string, reason?: string }} args
 */
export async function cancelMyOrder(ctx, args = {}) {
  const { conversationId, shop } = ctx;
  if (!args?.orderId) return { error: "orderId is required" };
  if (!shop) return { error: "shop context missing" };

  const cust = await requireCustomer(conversationId);
  if (cust._authRequired) return { _authRequired: true };

  // Step 1: confirm via Admin API that the order's customer matches the
  // authenticated customer. Never trust an arbitrary order ID from the chat.
  let verify;
  try {
    verify = await adminGraphQL(shop, VERIFY_ORDER_OWNERSHIP_QUERY, { id: args.orderId });
  } catch (e) {
    return { error: e.message };
  }
  const order = verify?.order;
  if (!order) {
    return { error: "We couldn't find that order on your account." };
  }
  if (!order.customer?.id || order.customer.id !== cust.customerGid) {
    console.warn(`[orderOps] ownership mismatch: order ${args.orderId} customer=${order.customer?.id}, authed=${cust.customerGid}`);
    return { error: "That order isn't associated with your account." };
  }
  if (order.cancelledAt) {
    return { error: `Order ${order.name} is already cancelled.` };
  }
  if (order.fulfillments?.length) {
    return {
      error: `Order ${order.name} has already been fulfilled and can't be cancelled. Please start a return instead.`,
    };
  }

  // Step 2: cancel via Admin API. Default refund to original payment method,
  //         restock inventory, notify customer.
  const variables = {
    orderId: args.orderId,
    reason: args.reason || "CUSTOMER",
    refundMethod: { originalPaymentMethodsRefund: true },
    restock: true,
    notifyCustomer: true,
    staffNote: `Cancellation requested via AI shopping assistant${
      args.reason ? ` (${args.reason})` : ""
    }.`,
  };

  let data;
  try {
    data = await adminGraphQL(shop, ORDER_CANCEL_MUTATION, variables);
  } catch (e) {
    return { error: e.message };
  }

  const result = data?.orderCancel;
  const errs = [...(result?.orderCancelUserErrors || []), ...(result?.userErrors || [])];
  if (errs.length) {
    return { error: errs.map((e) => e.message).join("; ") };
  }

  return {
    cancelled: true,
    orderId: args.orderId,
    orderName: order.name,
    jobId: result?.job?.id,
    refundMethod: "original payment method",
    message: `Order ${order.name} has been cancelled. The refund is on its way to your original payment method.`,
  };
}

// ---------- tool definitions exported for the registry ----------

export const orderOpsToolDefinitions = [
  {
    name: "list_my_orders",
    description:
      "List the signed-in customer's most recent orders, 3 per call. Pass {next: true} to fetch the next 3 orders when the shopper says 'show me more'. Returns orders newest-first with status, total, and line items. Requires customer authentication.",
    input_schema: {
      type: "object",
      properties: {
        next: {
          type: "boolean",
          description: "Pass true to fetch the next page of 3 orders after the most recent list_my_orders call.",
        },
        reset: {
          type: "boolean",
          description: "Pass true to start from the first page again.",
        },
      },
    },
  },
  {
    name: "cancel_my_order",
    description:
      "Cancel one of the signed-in customer's orders. Only works for orders that have not been fulfilled yet. The refund is automatically issued to the original payment method, inventory is restocked, and the customer is notified by email. Confirm the order with the shopper before calling this. Requires customer authentication.",
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The Shopify order GID, e.g. 'gid://shopify/Order/123456789'. Obtain it from list_my_orders.",
        },
        reason: {
          type: "string",
          enum: ["CUSTOMER", "DECLINED", "FRAUD", "INVENTORY", "OTHER", "STAFF"],
          description: "Cancellation reason. Defaults to CUSTOMER if omitted.",
        },
      },
      required: ["orderId"],
    },
  },
];
