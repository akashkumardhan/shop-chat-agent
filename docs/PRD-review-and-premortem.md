# PRD Review & Premortem — Multi-Vertical AI Shopping Assistant

**Reviewer:** akumar (with Claude)
**Review date:** 2026-05-20
**PRD reviewed:** [docs/PRD.md](PRD.md) (Draft v2, dated 2026-05-19, 5,443 lines, 37 features, 7 vertical packs)
**Verification source:** Shopify Dev MCP (live docs, May 2026)

---

## TL;DR

The PRD is ambitious, well-organized, and unusually concrete for a "v2 consolidated" draft. The vertical-pack thesis is defensible, the feature decomposition is granular, and the data model is thought through. **The plan is unlikely to ship v1 on time and on-thesis without three structural changes.**

**Top three risks (sharp premortem):**

1. **UCP cutoff is missed.** [PRD:1711](PRD.md#L1711) says "UCP migration must complete before **June 15, 2026**." Today is 2026-05-20. That is **26 calendar days**, against a Phase 0 plan of **5–7 weeks** (35–49 days) where F36 is one of seven parallel workstreams. The migration is also bigger than the PRD describes — see §2 below. **The cutoff will slip unless F36 is pulled out, prioritized, and scoped down today.**
2. **+4% PCR lift is not statistically detectable on a single design-partner merchant.** The PRD commits to **+4% absolute** post-conversation conversion across all 7 packs ([PRD:115](PRD.md#L115), [PRD:152](PRD.md#L152), [PRD:181](PRD.md#L181)), but never specifies sample size, baseline conversion rate, or test duration. At a mid-market merchant's typical PCR (~2–5%), a +4 pp lift requires tens of thousands of engaged sessions per arm to detect at 80% power. Most $1M–$50M GMV merchants won't deliver that within the 90-day target window. The "headline metric" is therefore unfalsifiable, which means it will be reported as "directionally positive" and the exec team will lose trust.
3. **Vertical Pack abstraction breaks on pack #3 or #4.** The PRD validates the abstraction on jewelry + flowers ([PRD:1712](PRD.md#L1712)) and then ships **three more packs in Phase 1** (fashion, footwear, electronics — [PRD:1735](PRD.md#L1735)). Two packs is not enough to expose the joints — footwear's brand-calibration matrix and electronics' compatibility graph are both *fundamentally different shapes* from jewelry's catalog-of-attributes. The team will end up either (a) bloating the Pack interface, (b) writing per-pack escape hatches, or (c) shipping shallow packs and missing the lift target on three of seven. We have already seen this pattern with other "configurable" frameworks.

**Top three Shopify dependencies the PRD missed entirely:**

1. **UCP Agent Profiles** — every UCP catalog request must include `meta.ucp-agent.profile` pointing to a hosted JSON document declaring the agent's capabilities and version. The PRD's F36 description treats migration as a rename + endpoint change; it is in fact a new auth-shaped infrastructure piece. See §2.1.
2. **Customer Account MCP onboarding gates** — requires a **custom domain** on the merchant store and **Level 2 protected customer data** approval (manual Shopify review). [PRD:153](PRD.md#L153) targets "30-min setup"; both gates can take days. Affects F20, F22, F25.
3. **Theme app extension JS bundle ceilings** — Shopify suggests **10 KB compressed per JS file**. Today's [chat.js](../extensions/chat-bubble/assets/chat.js) is 956 lines and Phase 0 features (proactive engine, image upload, sizing, compare, save-cart, auth, handoff, etc.) will push this far past the threshold. Appendix I.20 lists ~20 JS modules but does not address bundling/dynamic-import strategy.

---

## 1. Premortem — assume v1 missed +4% PCR target on 90 days post-GA. Why?

Ranked by likelihood × impact. Each row is a *plausible* postmortem narrative the team could write in 2027.

### P1 — "We never met the UCP cutoff and shipped degraded for two weeks"  *(very likely)*

- F36 was scoped as a single ticket with seven sub-features [PRD:1711](PRD.md#L1711).
- The agent-profile requirement (see §2.1) wasn't surfaced until late in implementation.
- We had to write a profile fixture, host it, and add version negotiation **after** writing the migration code. Two-week regression of the catalog-search path.
- F1 (pack runtime) and F11 (analytics) had implicit dependencies on the old catalog tool shapes; both regressed.
- **Pre-mitigation:** Pull UCP migration out of Phase 0 *today*. Treat it as a single dedicated workstream owned by one engineer, completed and merged within 18 days. Block everything else on it. Reject F1/F2/F11 PRs that touch the old tool names.

### P2 — "+4 pp lift was not statistically detectable, so we couldn't tell if it worked"  *(very likely)*

- One design partner at $5M GMV, ~50K sessions/month, ~3% PCR. With a 90/10 split, the treatment arm gets ~4,500 engaged sessions/month. A 4 pp lift on a 3% base requires ≥ ~13K sessions/arm at 80% power, α=0.05.
- After 90 days we had 13.5K total sessions; the lift point estimate was +2.6 pp but the CI was [-1.8, +6.9]. We couldn't reject the null.
- We declared "directional improvement" and moved on. The exec team didn't believe it.
- **Pre-mitigation:** Either (a) commit to ≥ 3 design partners per pack with combined ≥ 50K sessions/arm before claiming any pack hit the target, or (b) lower the headline to "+1.5 pp absolute" which is detectable. The PRD should also predefine a **primary** vs. **secondary** metric — AOV among engaged shoppers ([PRD:174](PRD.md#L174)) is likely the more sensitive lever and probably should be the headline.

### P3 — "Pack abstraction calcified after two packs, then broke on footwear and electronics"  *(likely)*

- Jewelry and flowers both fit the "catalog of distinct, attribute-rich items" shape.
- Footwear's *brand-calibration matrix* (one shopper's true-to-size in Brand X is half-size-up in Brand Y) doesn't fit the per-product attribute pattern. We bolted on a per-pack `brandCalibration` table — first escape hatch.
- Electronics' *compatibility graph* (USB-C variants, ecosystem lock-in, HDMI 2.1) requires reasoning about product↔product edges, not product attributes. Another escape hatch.
- By the time we got to home goods (Phase 2), the pack interface was 2× the size it started, half the packs used escape hatches, and the "no core changes per pack" claim ([PRD:156](PRD.md#L156)) was dead.
- **Pre-mitigation:** Don't write the Pack interface against jewelry. Write it against the **two worst-fitting verticals** (probably footwear + electronics) and verify jewelry/flowers fit *down* into it. The PRD's choice to start with the cleanest pack is the opposite of stress-testing.

### P4 — "Auto-detection picked the wrong pack on 30% of mixed-catalog shops"  *(likely)*

- F15 auto-detection ([PRD:821](PRD.md#L821)) is foundational ([PRD:1693](PRD.md#L1693)) but the PRD's success metric is "top-pack accuracy" against ~20 known shops ([PRD:2168](PRD.md#L2168)).
- That's an underpowered evaluation set and it doesn't test the *mixed-catalog* case which the PRD explicitly cites as a wedge ([PRD:142](PRD.md#L142)).
- In practice, department-store and gift-shop catalogs trip the detector. We end up shipping a pack-picker UI as the fallback, and the "feels smart out of the box" promise dies.
- **Pre-mitigation:** Expand the eval set to ≥ 200 real shops including ≥ 50 mixed-catalog. Define per-pack precision/recall, not just top-1 accuracy. Pre-decide what the UX is when confidence < threshold (don't bluff).

### P5 — "Adapter sprawl ate the schedule"  *(likely)*

- F19 (reviews — 5 adapters), F22 (returns — 3 adapters), F25 (loyalty — 4 adapters), F26 (SMS provider), F36 (Shopify Functions for discounts) = ~13 distinct vendor integrations promised across Phase 1–2.
- Each vendor has its own API, auth, rate limits, sandbox, and quarterly breaking changes. We picked Loop + Returnly + Yotpo + Smile based on assumed coverage, but the design partners had Stamped, Judge.me, Klaviyo, and AfterShip. We rebuilt three adapters in Phase 2.
- **Pre-mitigation:** Don't commit to *which* adapters until you sign design partners. Ship the first adapter per category against the design partner's installed app; add the rest after launch on demand. F19/F22/F25's "top 2–3 adapters in v1" promises are aspirational.

### P6 — "Attribution was gamed by us and we didn't notice"  *(moderate)*

- F11 attribution requires ≥ 3 shopper messages to count as "engaged" ([PRD:2175](PRD.md#L2175)).
- Proactive triggers (F4) regularly fire two greeting turns before the shopper says anything substantive. The shopper sends "no thanks" and the conversation gets counted as engaged.
- Net: engaged-shopper conversion rate went up, but it was just self-selection on the engagement signal, not lift.
- **Pre-mitigation:** Engagement should require ≥ 2 *shopper-initiated* messages, not just message count. Pre-register the operational definition in writing before Phase 0 ships.

### P7 — "Conversational checkout hurt conversion on the merchant who opted in"  *(moderate)*

- F21 ([PRD:1029](PRD.md#L1029)) is opt-in, A/B-gated, default-OFF ([PRD:2179](PRD.md#L2179)) — the PRD already flags this.
- Risk: a single high-AOV merchant opts in early, sees a small but real drop, blames us, churns. One bad anecdote can sink the narrative even if A/B is clean.
- **Pre-mitigation:** Gate F21 opt-in behind a written acknowledgement of the A/B variance band; require sample-size minimum before merchants can flip it on.

### P8 — "Memory layer triggered a privacy complaint we didn't have a playbook for"  *(moderate)*

- F20 ([PRD:983](PRD.md#L983)) stores shopper attributes (allergies, sizes, skin type) with opt-in [PRD:2178](PRD.md#L2178) — good.
- But beauty + flowers verticals capture sensitive context (pregnancy safety, sympathy contexts) the PRD acknowledges ([PRD:2183](PRD.md#L2183)) but doesn't operationalize a deletion path for. One subject-access request that we can't honor cleanly = a regulator letter.
- **Pre-mitigation:** SAR/DSR (subject access / deletion) playbook must exist before F20 ships, not after. Includes: what's stored, where, how to enumerate by `customerId`, how to wipe within statutory windows (30 days GDPR, 45 days CCPA).

### P9 — "Phase 2 features didn't ship and the launch felt thin"  *(moderate)*

- Phase 2 is 6–8 weeks for **15 features** including F5/F6/F10/F12/F16/F17/F21/F24/F25/F26/F27/F28/F29/F30/F31 *plus two new packs* ([PRD:1740](PRD.md#L1740)).
- Each is non-trivial; F10 (12 languages) alone is a multi-week QA effort.
- **Pre-mitigation:** Re-scope Phase 2 to ≤ 8 features ranked by lift potential. Move F23/F27/F28/F33/F34 to a "v1.1" track and stop pretending they ship at GA.

### P10 — "Theme extension JS bundle blew past the 10 KB suggestion and the storefront LCP regressed"  *(moderate)*

- Today's [extensions/chat-bubble/assets/chat.js](../extensions/chat-bubble/assets/chat.js) is 956 lines pre-feature-add.
- Phase 0 alone adds: pack-aware UI, proactive trigger engine, sizing widget, compare sheet, image upload, save-cart, auth flow, error/offline UI.
- Shopify's enforced theme-app-extension caps are 10MB total / 30 blocks; the suggested per-JS-file ceiling is 10 KB compressed. Today's chat.js may already exceed it; with Phase 0 features it certainly will.
- Storefront performance is a Shopify App Store review criterion. A bloated chat widget can fail the listing review.
- **Pre-mitigation:** Add a §I.20.x section that mandates dynamic `import()` for all secondary blocks (sizing, compare, image upload, vision results). Set a build-time budget check.

---

## 2. Shopify MCP verification — claim-by-claim

The PRD references Shopify primitives heavily. The MCP server confirmed most claims but surfaced **four material gaps**.

### 2.1 ❌ MISSING — UCP Agent Profiles

PRD F36 ([PRD:1529](PRD.md#L1529)) frames the UCP migration as a tool-rename + endpoint change. **It is more than that.** Shopify confirms:

> The `/api/ucp/mcp` endpoint requires an agent profile. Every request must include a `meta.ucp-agent.profile` URL pointing to your agent's UCP profile. The returned tools depend on the capabilities your agent advertises.
> — [shopify.dev/docs/agents/catalog/storefront-catalog](https://shopify.dev/docs/agents/catalog/storefront-catalog)

What this implies for our app:

- We must publish a JSON document at a public, stable URL declaring our UCP version and supported capabilities (e.g., `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup`, and — if we transact — `dev.ucp.shopping.cart`, `dev.ucp.shopping.checkout`).
- Shopify fetches and validates it; capability intersection is server-selected.
- If we want to support new UCP versions later, we publish a new profile and rotate.
- **Implication for F36's June 15 deadline:** the migration is ≥ 1 person-week longer than the PRD assumes. Add to scope: agent-profile JSON authoring, hosting infra, version-bump runbook.

**Action:** Update F36's "Files to touch" with `app/services/ucp-profile.json` (or remote URL), update `app/mcp-client.js` to inject `meta.ucp-agent.profile` on every UCP catalog call, and document version negotiation.

### 2.2 ❌ MISSING — Customer Account MCP onboarding gates

PRD F22 ([PRD:1065](PRD.md#L1065)), F20 ([PRD:983](PRD.md#L983)), F25 ([PRD:1180](PRD.md#L1180)) depend on Customer Account MCP. Shopify confirms two requirements [the PRD never mentions](#):

> Your store must have a **custom domain** configured.
> Your app must meet Shopify's **protected customer data** requirements.
> You must have completed the customer accounts MCP integration steps.
> — [shopify.dev/docs/apps/build/storefront-mcp/servers/customer-account](https://shopify.dev/docs/apps/build/storefront-mcp/servers/customer-account)

"Protected customer data requirements" = Level 2 PII approval, which is a **manual review by Shopify Partner team**, typically days to weeks. The 30-min onboarding target ([PRD:153](PRD.md#L153)) silently excludes any feature that needs the Customer Account MCP, on any merchant that hasn't completed both gates.

**Action:** Add a §6 row "Customer Account MCP prereqs" listing the custom-domain and L2 PII gates. Update F22's acceptance criteria. Adjust the onboarding flow to gracefully degrade — order-status / returns / loyalty features should be visibly *disabled* (with a 1-click "request L2 PII access" CTA) rather than broken.

### 2.3 ❌ MISSING — Theme app extension JS bundle limits

[shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration) — enforced and suggested limits:

| Limit | Type | Value |
|---|---|---|
| All files | Enforced | 10 MB |
| Number of blocks | Enforced | 30 |
| Locale files | Enforced | 100 |
| Locale file size | Enforced | 15 KB |
| Liquid total | Enforced | 100 KB |
| CSS per asset | **Suggested** | 100 KB compressed |
| **JS per asset** | **Suggested** | **10 KB compressed** |

PRD Appendix I.20 ([PRD:4921](PRD.md#L4921)) enumerates ~20 JS modules but does not commit to a bundling strategy. **The current `chat.js` is 956 lines, single-file.** With Phase 0 alone, this fails the suggested limit.

**Action:** Add a §I.20.x subsection mandating dynamic `import()` for every block that isn't required on first paint (sizing, compare, image upload, vision result, save-cart, handoff card). Add a CI gate that fails the build if `extensions/chat-bubble/assets/*.js` (any file, compressed) exceeds 10 KB.

### 2.4 ⚠️ INCOMPLETE — Order MCP server divergence

PRD references `get_order_status` and `get_most_recent_order_status` (legacy Storefront/Customer MCP tool names from the original shop-chat-agent template). Shopify now ships a **separate Order MCP server** ([shopify.dev/docs/agents/orders/order-mcp](https://shopify.dev/docs/agents/orders/order-mcp)):

- New tool: `get_order` (returns full state including fulfillment events, post-purchase adjustments).
- New auth: Global API JWT with `read_global_api_orders` scope, **60-minute TTL**.
- **Only available to Token-tier agents.**
- Shopify recommends webhooks as the **primary** update channel; `get_order` is for buyer-initiated reads and reconciliation, not polling.

**Action:** Decide whether F22 ([PRD:1065](PRD.md#L1065)) targets the legacy Customer Account MCP order tools or the new Order MCP. If the latter: budget for trust-tier accreditation + JWT mint/refresh infrastructure + webhook ingestion (which the PRD also doesn't model in §11 data changes).

### 2.5 ✅ CONFIRMED — UCP cutoff is June 15, 2026

[shopify.dev/changelog/storefront-catalog-mcp-now-implements-ucp](https://shopify.dev/changelog/storefront-catalog-mcp-now-implements-ucp), April 22, 2026:

> The old versions will be maintained until **June 15th, 2026**, but all documentation will refer to the latest version.

PRD F36 is correct. Timing is the issue: **26 days from today.**

### 2.6 ✅ CONFIRMED — Product Recommendations API exists

PRD F5 ([PRD:485](PRD.md#L485)) assumes "frequently bought together" data is available. Shopify ships a Product Recommendations API on all plans since 2019, with two intents:

- `related` — auto-generated by Shopify
- `complementary` — **merchant must manually configure** via the Shopify Search & Discovery app

**Action:** F5 should clarify that cross-sell strength is gated on merchants having configured complementary recommendations in their admin. Default behavior should fall back to `related` when complementary is empty; the admin onboarding should surface this as a "5-min setup boost" task.

### 2.7 ✅ CONFIRMED — Web Pixels for attribution

F11 attribution can use Web Pixels. Scopes required: `write_pixels` and `read_customer_events` ([PRD:2197](PRD.md#L2197) open question). Constraint not in PRD: **pixels run in a Shopify sandbox** — they can `fetch()` to your backend but cannot share state with the storefront DOM. Cookie-based session linking has to flow `pixel → backend → conversation` via a shared visitor cookie. This works but needs an architectural sketch.

**Action:** Add a "Pixel/attribution flow" diagram or 4-bullet sequence to §F11 ([PRD:717](PRD.md#L717)).

### 2.8 ⚠️ NOTE — Theme app extensions cannot render on checkout pages

> Theme app extension app blocks and app embed blocks can't be rendered on checkout pages. This includes all pages that are rendered when a customer initiates a checkout, such as Contact information, Shipping method, Payment method, and Order status.

F21 (conversational checkout, [PRD:1029](PRD.md#L1029)) — the chat widget literally cannot follow the shopper into the Shopify checkout flow. Whatever F21 ships must complete the purchase from **inside** the chat surface (Storefront API cart → checkout creation), or hand off entirely. The PRD's risk note ([PRD:2179](PRD.md#L2179)) doesn't surface this Shopify constraint.

---

## 3. Section-by-section feedback (concrete edits)

| Section | PRD lines | Issue | Suggested fix |
|---|---|---|---|
| §4 Success metrics | [171–181](PRD.md#L171) | +4% PCR target lacks sample-size / detection-power math | Add a "Statistical detection requirements" row: minimum sessions per arm for the target lift to be detectable at 80% power |
| §6 Current state | [218](PRD.md#L218) | Says "must migrate before June 15" but Phase 0 ([PRD:1709](PRD.md#L1709)) treats F36 as one of 8 parallel items | Reorder: F36 is the *only* item that ships in week 1; everything else starts week 2 |
| §7 Pack architecture | [247–286](PRD.md#L247) | Abstraction validated against the easiest pack (jewelry) | Sketch the worst-fit verticals (footwear brand-calibration, electronics compatibility graph) against the pack interface *before* writing pack #1 |
| §10 Phase 0 | [1709](PRD.md#L1709) | 5–7 weeks for F36 + F1 + F2 + F3 + F11 + F13 + F14 + F15 = 8 workstreams | Re-scope to F36 (week 1, blocking) → F1 + F15 (weeks 2–3) → F11 + F13 (weeks 3–4) → F2 + F3 (weeks 4–6). Drop F14 to Phase 1. |
| §10 Phase 2 | [1740](PRD.md#L1740) | 15 features + 2 packs in 6–8 weeks | Cut to ≤ 8 features; defer F23/F27/F28/F33/F34 |
| §11 Data model | [1773](PRD.md#L1773) | No `WebhookEvent` table, no `OrderMcpToken` cache, no `UcpProfileVersion` history | Add three small tables; required by §2.1/2.4 above |
| §12 Risks | [2163](PRD.md#L2163) | Doesn't list "Shopify API deprecation timeline" as a risk despite being the only hard deadline in the document | Add row: "Shopify ships UCP-style changes faster than our adapter pattern absorbs them — Riskiness: High — Cheapest test: subscribe to all Storefront/Customer/Order MCP changelogs; on-call rotation reviews weekly" |
| §13 Open questions | [2192](PRD.md#L2192) | Q14 (F21) is marked recommended for low-risk merchant A/B — should be marked "do not ship to any merchant until §2.8 widget-on-checkout constraint is resolved" | Update Q14 wording |
| Appendix H (all packs) | [2436+](PRD.md#L2436) | Each pack assumes merchant has populated `metafields` with pack-specific keys (metal/stone/clarity for jewelry, fabric/fit for fashion, etc.) | Add per-pack "Required merchant metafield schema" section with create-on-install metafield definitions, or graceful-degrade rules when the field is missing |
| Appendix I.20 | [4921](PRD.md#L4921) | Doesn't address theme-app-extension JS limits | Add subsection mandating dynamic-import for non-first-paint modules; add build-time budget check |
| Appendix J | [5175](PRD.md#L5175) | Excellent coverage, but no test of the **out-of-stock + substitution + cross-pack** combined path (e.g., shopper on a flowers PDP, item OOS, wants electronics gift card as substitute) | Add a row to J.12 |

---

## 4. Concrete next steps

In priority order. The first three should happen this week.

1. **Pull F36 (UCP migration) out of Phase 0.** Make it a standalone, single-engineer workstream targeting **June 8, 2026** (one-week buffer before the cutoff). Block all PRs touching the catalog tools until it lands. Author the UCP agent profile JSON, host it (preferred: same domain as our app), wire `meta.ucp-agent.profile` into `app/mcp-client.js`. Verify against both endpoints.
2. **Stress-test the Pack interface against footwear and electronics on paper.** Before writing the jewelry pack code, write the brand-calibration logic for footwear and the compatibility-graph logic for electronics *as if they were pack methods*. If they don't fit cleanly, fix the interface now.
3. **Rewrite §4's success metric with statistical power math.** Decide: do we commit to +4 pp PCR per pack (requires ≥ 3 design partners per pack with ~50K sessions/arm — probably infeasible in 90 days), or do we lower to +1.5 pp (detectable on a single mid-market merchant), or do we change the headline to AOV-among-engaged-shoppers (more sensitive)?
4. Add the **Customer Account MCP prereqs** to onboarding telemetry; tag merchants who can/cannot enable F20/F22/F25.
5. Add the **theme-app-extension JS budget gate** to CI. Mandate dynamic `import()` for non-first-paint blocks.
6. Drop the Phase 2 feature count by ≥ 7. Move F23/F27/F28/F33/F34 to v1.1.
7. Write the **SAR/DSR playbook** before F20 ships. Include enumerate-by-customerId and 30-day wipe procedures.
8. Re-scope adapter promises (F19/F22/F25) to "first adapter ships with design partner; others on demand." Stop committing to specific vendor lists.

---

## 5. What's strong about the PRD (briefly)

To stay calibrated: this is one of the more concrete PRDs I've seen for a project this size. Specific strengths:

- §0 "How to read this document" sets reading expectations cleanly.
- Per-feature shape (Why / What / Vertical behaviors / Files / Acceptance) is consistent and implementable.
- Appendix D ("If you only had time for 5 things this week") is excellent prioritization discipline.
- §12 risks table is honest about which assumptions are critical vs. low.
- §17 (implementation order) and §18 (files & paths) reduce ambiguity for whichever engineer picks this up.
- Appendix H pack specs have real domain content (sympathy override for flowers, brand-calibration matrix for footwear, ingredient conflicts for beauty), not buzzword placeholders.
- Counter-metrics ([PRD:183](PRD.md#L183)) — including bounce on PDPs with proactive triggers — show product-discipline.

The fixes above are scope and sequencing, not vision.
