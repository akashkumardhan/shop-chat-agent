# Chat Widget Capability Survey — Shopify-Verified

**Author:** akumar (with Claude)
**Date:** 2026-05-21
**Source:** Shopify Dev MCP (live docs, May 2026)
**Purpose:** What we can actually do for orders and other in-widget operations *today*, without committing to UCP migration as a strategic posture.

---

## On the UCP question — calibrated position

You said you don't see the profit in migrating to UCP right now. Here's the honest read:

**Two separate decisions are being conflated.** Untangle them:

1. **Tactical:** Migrate the *catalog search* path off `search_shop_catalog` → `search_catalog` before **June 15, 2026** (25 days from today). This is **not optional**. After that date, the old tool stops responding and our product search breaks on every storefront we ship to. The migration here is small: rename, swap request/response shape to UCP-wrapped, host a static profile JSON for the `meta.ucp-agent.profile` field. This is ~1 person-week of work, not a strategic pivot.
2. **Strategic:** Adopt UCP across other surfaces (Cart MCP, Checkout MCP, Order MCP, Global Catalog) — i.e., agentic-commerce posture. This is what your "no profit" intuition is pointing at, and you're right. There's no payoff for moving off the standard `get_cart`/`update_cart` cart tools today, and adopting Order MCP would force us into Token-tier agent identity for marginal benefit.

**My recommendation:** do (1), defer (2). Treat UCP catalog migration as a tax we pay because Shopify made it a tax. Don't reorganize around UCP otherwise. Keep all customer-data work (orders, returns, subscriptions, addresses) on the **Customer Account API** path which is GraphQL, stable, and well-documented.

The PRD review doc overweighted (2). That's my mistake — fixed in the action list at the bottom.

---

## What we can do in the widget today

Three buckets: **anonymous shopping (no login)**, **authenticated customer (post-login)**, and **server-side reads/writes (Admin API)**.

### Bucket A — Anonymous shopping (no auth required)

Available via **Storefront MCP** + **Storefront Catalog MCP** (UCP). Works for any shopper who hasn't logged in.

| Capability | Tool / API | Status |
|---|---|---|
| Catalog search | `search_catalog` (UCP) — replaces `search_shop_catalog` June 15 | ✅ Available |
| Product lookup by ID / handle | `lookup_catalog` (UCP) | ✅ Available |
| Full product detail + variant selection | `get_product` (UCP) | ✅ Available |
| Get current cart | `get_cart` (standard Storefront MCP) | ✅ Available, no auth |
| Add / update / remove cart items | `update_cart` (standard Storefront MCP) | ✅ Available, no auth |
| Apply discount code to cart | `update_cart` with discount field | ✅ Available |
| Get cart checkout URL | `get_cart` returns `checkout_url` | ✅ Available |
| Policy & FAQ lookup | `search_shop_policies_and_faqs` | ✅ Available |
| Multi-language / multi-currency context | `context.address_country`, `context.language`, `context.currency` on UCP catalog calls | ✅ Available |
| Related-product recommendations | Product Recommendations API (`intent: RELATED`) — auto-generated | ✅ Available, all plans |
| Complementary-product recommendations | Product Recommendations API (`intent: COMPLEMENTARY`) — **merchant must configure manually** in Search & Discovery app | ⚠️ Requires merchant setup |

### Bucket B — Authenticated customer (post-login, via Customer Account API + Customer Account MCP)

Requires the customer to OAuth in. App must have:
- `customer_read_customers` + `customer_read_orders` (+ `customer_write_*` for mutations) scopes
- A **custom domain** on the merchant's storefront (Shopify requirement, not waivable)
- **Level 2 protected customer data** approval from Shopify (manual Partner-team review, days to weeks)

Once those gates are cleared, the widget can do a lot:

| Capability | API / Tool | Status |
|---|---|---|
| **Order status — single order** | `get_order_status` (Customer Account MCP, legacy tool name in shop-chat-agent template) OR `order(id:)` query on Customer Account API | ✅ Both work; MCP simpler |
| **Order history list** | `customer { orders }` query on Customer Account API | ✅ Available |
| **Most-recent-order shortcut** | `get_most_recent_order_status` (Customer Account MCP) | ✅ Available |
| **Tracking info / fulfillment events** | `order { fulfillments { trackingInfo } }` | ✅ Available |
| **Return eligibility check** | `Order.returnInformation` field (Customer Account API 2025-04+) | ✅ Available |
| **Return refund preview (what would I get back?)** | `returnCalculate` query (Customer Account API 2025-01+) | ✅ Available |
| **Initiate a return request** | `orderRequestReturn` mutation (Customer Account API 2025-01+) | ✅ Available — sets return to `REQUESTED`, merchant approves/declines in admin |
| **Show existing returns on an order** | `Order.returns` connection | ✅ Available |
| **View store credit balance** | `customer { storeCreditAccounts }` (Customer Account API 2024-07+) | ✅ Available |
| **View applied gift cards on order** | `order { appliedGiftCards }` | ✅ Available |
| **Add / update / delete saved address** | `customerAddressCreate`, `customerAddressUpdate`, `customerAddressDelete` | ✅ Available |
| **Set default address** | `customerDefaultAddressUpdate` | ✅ Available |
| **Update profile (name, email, marketing prefs)** | `customerUpdate` | ✅ Available |
| **View subscription contracts** | `customer { subscriptionContracts }` | ✅ Available |
| **Fetch delivery options for a subscription** | `subscriptionContractFetchDeliveryOptions` mutation | ✅ Available |
| **Change subscription delivery method / address** | `subscriptionContractSelectDeliveryMethod` | ✅ Available |
| **View order payments / refunds** | `order { transactions, refunds }` | ✅ Available |
| **Discounts available to customer** | `customer { discountCodes }` / order-level discount fields | ✅ Available |
| **Buyer identity on cart (for tax/shipping accuracy after login)** | `cartBuyerIdentityUpdate` (Storefront API) | ✅ Available |

### Bucket C — Server-side / Admin API (chat backend hits Admin API, not exposed directly to widget)

These need the app's shop access token (not the customer's). The widget asks the backend, which uses Admin API on the customer's behalf — the customer never sees a scope prompt.

| Capability | Mutation | Notes |
|---|---|---|
| **Cancel order** | `orderCancel` (Admin GraphQL) | Customer-requested cancellations. Reason enum supports CUSTOMER, FRAUD, INVENTORY, DECLINED, STAFF_ERROR, OTHER. Refund + restock options. **Irreversible.** Requires `write_orders` scope. |
| **Modify order — edit line items** | `orderEditBegin` → `orderEditAddVariant` / `orderEditSetQuantity` → `orderEditCommit` | Add/remove/swap line items on an existing order before fulfillment. |
| **Update order metadata** | `orderUpdate` | Notes, tags. Not for line items. |
| **Update shipping address on unfulfilled order** | `orderUpdate` (limited) or order-edit flow | Pre-fulfillment only on most plans. |
| **Approve / decline customer return request** | `returnApproveRequest`, `returnDeclineRequest` | Process the requests created by `orderRequestReturn`. |
| **Process refund + restock** | `returnProcess` (replaces deprecated `returnRefund` / `refundCreate`) | Combined disposition + financial in one call. Available 2025-07+. |
| **Issue store credit refund** | `storeCreditAccountCredit` | Refund as store credit instead of payment method. |
| **Apply discount to existing order** | Discount Codes / Functions | Generally don't retroactively discount; issue store credit instead. |
| **Create subscription contract** | `subscriptionContractCreate` | Requires app approval for subscriptions principles. |
| **Update subscription contract** | `subscriptionContractUpdate` | Change interval, items, billing date. |
| **Pause / resume subscription** | `subscriptionContractPause` / `subscriptionContractActivate` | Customer-requested pause. |
| **Cancel subscription** | `subscriptionContractCancel` | |
| **Create draft order** | `draftOrderCreate` | For B2B quotes, custom orders. |
| **Tag customer for segmentation** | `customerUpdate` with `tags` | Useful for analytics + targeted automation. |

### Bucket D — Webhooks (proactive notifications, not in-widget but adjacent)

The widget can't subscribe to events directly — the backend subscribes to Shopify webhooks and pushes to the chat session.

| Event | Use case |
|---|---|
| `orders/create` | Confirm "your order #1234 was placed!" |
| `orders/fulfilled`, `orders/paid` | Status updates without polling |
| `fulfillments/create`, `fulfillments/update` | "Your order shipped — tracking #ABC" |
| `refunds/create` | "Your refund is on its way" |
| `subscription_contracts/create / update / pause / fail` | Subscription lifecycle |
| `inventory_levels/update` | Back-in-stock triggers |
| `customers/create / update` | Profile sync |

---

## Concrete operations the chat widget can offer post-purchase

These are the conversation patterns the widget can fully execute today, end-to-end, without manual handoff:

### Order & shipping
1. "Where's my order?" → `get_most_recent_order_status` or `get_order_status` → render status, ETA, tracking link
2. "Track order #1234" → same, lookup by order number
3. "When will it arrive?" → fulfillment ETA + tracking carrier estimate
4. "I haven't gotten it" → fulfillment state + carrier last-scan + offer escalation
5. "Change my delivery address" → if unfulfilled: `orderUpdate` (Admin) or hand to merchant; if fulfilled: explain it's with carrier

### Returns & refunds
6. "Can I return this?" → `Order.returnInformation` → return eligibility per item with rules-aware messaging
7. "How much would I get back?" → `returnCalculate` → preview refund
8. "Start a return" → `orderRequestReturn` → status REQUESTED, customer gets confirmation
9. "What's the status of my return?" → `Order.returns` → REQUESTED / OPEN / CLOSED state
10. "Refund as store credit instead?" → `storeCreditAccountCredit` (with merchant policy check)

### Cancellation & modification
11. "Cancel my order" → check `orderEdit` eligibility (unfulfilled, no auth holds, no returns in progress) → `orderCancel` with `reason: CUSTOMER`
12. "Change the size on order #1234" → `orderEditBegin` → swap variant → `orderEditCommit` (pre-fulfillment only)
13. "Add one more to my order" → same flow

### Subscriptions
14. "Skip next delivery" → `subscriptionContractUpdate` push next-billing-date
15. "Pause my subscription" → `subscriptionContractPause`
16. "Change my subscription to monthly" → `subscriptionContractUpdate` billing/delivery policy
17. "Swap the product in my subscription" → `subscriptionContractUpdate` line items
18. "Cancel my subscription" → `subscriptionContractCancel` (offer retention deal first if merchant configured)

### Account & store credit
19. "What's my store credit balance?" → `customer { storeCreditAccounts { balance } }`
20. "Show my saved addresses" → `customer { addresses }`
21. "Add a new address" → `customerAddressCreate`
22. "Update my email" → `customerUpdate`
23. "How much loyalty/store credit do I have?" → store credit + gift cards (if loyalty app — adapter required)

### Re-purchase loops
24. "Re-order what I bought last time" → fetch last order line items → `update_cart` with same variants
25. "Reorder but in a different color" → fetch last order → `search_catalog` for sibling variants → cart update
26. "What did I buy in February?" → order history query

### Discovery + context-aware help
27. "Find me something like the one I bought" → fetch last order → `lookup_catalog` for product → recommendations via Product Recommendations API `RELATED`
28. "Is this in stock in my size?" → `get_product` returns real-time variant availability
29. "When will this be back in stock?" → inventory webhook subscription + email-on-restock (custom logic, no native API)
30. "Apply my $10 off code" → `update_cart` with discount field

---

## What we *can't* do in the widget (worth being honest)

- **Render the chat UI on Shopify checkout pages.** Theme app extensions are explicitly blocked from checkout (contact info, shipping, payment, order status pages). Conversational checkout means we have to either (a) use the Storefront API to build cart→checkout entirely in the widget, or (b) hand off to standard checkout. Cannot live alongside it.
- **Fetch orders not placed through us via UCP Order MCP.** Only the per-merchant Customer Account MCP/API sees the full order history — Order MCP is scoped to "originated by this agent."
- **Modify orders post-fulfillment** beyond cancellation. Carrier-side address changes, redirected packages, lost-package replacements all require human or 3rd-party app intervention.
- **Issue refunds to a customer's payment method without merchant approval** for return-driven refunds (good — prevents fraud). Refund flow is: customer requests → merchant approves → Shopify processes.
- **Access reviews / ratings / Q&A data natively.** Shopify doesn't ship a first-party reviews API. We need adapters for Yotpo / Judge.me / Loox / Stamped / Okendo to surface UGC.
- **Native wishlist / save-for-later.** No Shopify primitive — we'd build this in our own DB keyed by `customerId` or session.
- **Loyalty points / tier display.** Per-app adapters (Smile / Yotpo Loyalty / LoyaltyLion / Stamped Loyalty).
- **Universal "all-orders" view for one customer across stores.** Each store's Customer Account API is scoped to that store.
- **Real-time inventory at a specific physical location for BOPIS.** Multi-location inventory query needs Admin API + scope.

---

## Compatibility with the existing template

The shop-chat-agent template already wires:

- Storefront MCP: `search_shop_catalog`, `update_cart`, `get_cart`, `search_shop_policies_and_faqs`
- Customer Account MCP: `get_most_recent_order_status`, `get_order_status` (per README)
- OAuth PKCE flow stored in `CustomerToken` Prisma model

**To unlock most of Bucket B + C above, what's needed:**

1. **Before June 15:** swap `search_shop_catalog` → `search_catalog`. Add an agent-profile JSON. Keep `get_cart`/`update_cart` on the standard Storefront MCP endpoint — no change needed there.
2. **For returns:** start calling `returnCalculate` query + `orderRequestReturn` mutation against the Customer Account API directly (we already have the access token). Adds two new tool definitions.
3. **For order cancel / modify:** the backend uses the shop's Admin API access token (already stored via the standard `@shopify/shopify-app-react-router` install flow). Add `orderCancel` and `orderEditBegin`/`orderEditCommit` wrappers in `tool.server.js`.
4. **For subscriptions:** Customer Account API has read access for free. Mutations need `customer_write_orders` or subscription-specific scopes; add to `shopify.app.toml`.
5. **For webhooks → in-chat notifications:** add webhook subscriptions in `app/routes/api.webhooks.jsx`, push events into the Conversation table, surface them on next message or via SSE.

None of the above requires the UCP Cart / Checkout / Order MCP infrastructure.

---

## Recommended next moves

In priority order:

1. **UCP catalog-only migration** (the tactical one). 1 engineer-week. Done by June 8 with buffer.
2. **Add `orderCancel` + `returnRequest` + `returnCalculate` tool wrappers** to the existing tool service. ~2 engineer-days. Unlocks ~8 of the 30 post-purchase conversation patterns above.
3. **Add subscription read tools** (view / skip / pause / swap). ~3 engineer-days *if* the merchant has a subscription contract already (i.e., they ship via the Subscriptions APIs already). Otherwise gate behind a "subscriptions enabled" flag.
4. **Add `customerAddressCreate/Update/Delete` + `customerUpdate`** to the tool surface. ~1 engineer-day. Profile management in chat.
5. **Wire order webhooks → conversation surface.** Largest payoff for proactive engagement — "your order shipped" lands as an unread chat bubble. ~3 engineer-days.

Skip for now (until there's a wedge):

- Order MCP (UCP) — would require Token-tier identity + agent-profile capability declaration for orders. We get the same data via Customer Account API without the negotiation overhead.
- Cart MCP / Checkout MCP (UCP) — adds nothing the standard `update_cart` + `checkout_url` flow doesn't already give us.
- Global Catalog MCP — cross-merchant search is not the use case for an embedded storefront widget.
