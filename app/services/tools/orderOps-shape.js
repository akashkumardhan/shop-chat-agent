/**
 * Pure mapping helpers for the orderOps tool. Lives in a non-server file
 * so unit tests can import it without dragging in the Shopify app session
 * machinery from admin-graphql.server.js.
 */

/**
 * Map an Admin GraphQL Order node to the shape the LLM (and chat widget)
 * consumes.
 *
 * Stable, additive shape — never remove a field consumers depend on.
 */
export function mapOrder(o) {
  return {
    id: o.id,
    name: o.name,
    processedAt: o.processedAt,
    cancelledAt: o.cancelledAt || null,
    cancelReason: o.cancelReason || null,
    statusUrl: o.statusPageUrl || null,
    financialStatus: o.displayFinancialStatus, // PAID / REFUNDED / PARTIALLY_REFUNDED / ...
    fulfillmentStatus: o.displayFulfillmentStatus, // FULFILLED / IN_PROGRESS / ...
    total: o.currentTotalPriceSet?.shopMoney
      ? `${o.currentTotalPriceSet.shopMoney.amount} ${o.currentTotalPriceSet.shopMoney.currencyCode}`
      : null,
    totalAmount: Number(o.currentTotalPriceSet?.shopMoney?.amount) || null,
    currency: o.currentTotalPriceSet?.shopMoney?.currencyCode || null,
    lineItems: (o.lineItems?.nodes || []).map((li) => ({
      title: li.title,
      quantity: li.quantity,
      image: li.image?.url || null,
    })),
    // LLM-friendly compact view (kept for the JSON tool result the model reads).
    lineItemsCompact: (o.lineItems?.nodes || []).map(
      (li) => `${li.quantity}× ${li.title}`
    ),
    fulfillments: (o.fulfillments || []).map((f) => ({
      id: f.id,
      status: f.status, // SUCCESS / OPEN / CANCELLED / ...
      trackingCompany: f.trackingInfo?.[0]?.company || null,
      tracking: (f.trackingInfo || []).map((t) => ({
        number: t.number || null,
        url: t.url || null,
        company: t.company || null,
      })),
      items: (f.fulfillmentLineItems?.edges || []).map((e) => ({
        title: e.node?.lineItem?.title || "",
        quantity: e.node?.quantity || 0,
      })),
    })),
  };
}
