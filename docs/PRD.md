# PRD: Multi-Vertical AI Shopping Assistant for shop-chat-agent

**Status:** Draft v2 (consolidated) — single-file handoff for Claude Code
**Author:** Product
**Audience:** Claude Code (implementing engineer)
**Last updated:** 2026-05-19
**Repo:** `shop-chat-agent` (Shopify embedded app, React Router + Claude + MCP)

---

## Table of contents

0. How to read this document
1. Executive summary
2. Problem & opportunity
3. Goals & non-goals
4. Success metrics
5. Personas & JTBD
6. Current state assessment
7. Vertical Pack architecture
8. Feature specification (F1–F18)
9. Cross-cutting requirements
10. Phasing
11. Data model changes
12. Risks & assumptions to validate
13. Open questions / decisions needed
14. Appendix A — Base sales-first system prompt
15. Appendix B — Pack file scaffolding (per-pack knowledge file structure)
16. Appendix C — Example conversations (cross-vertical smoke tests)
17. Appendix D — Implementation order quick reference
18. Appendix E — Files & paths quick reference
19. Appendix F — Sales-first vs. support-first framing
20. Appendix G — Pack Authoring Spec
21. Appendix H — Vertical Pack specifications
    - H.1 Jewelry & Gemstones
    - H.2 Fashion & Apparel
    - H.3 Footwear
    - H.4 Electronics & Appliances
    - H.5 Flowers & Gifts
    - H.6 Beauty & Skincare
    - H.7 Home & Furniture
22. Appendix I — Chat Widget UI/UX Design
    - I.1 Design principles & references
    - I.2 Design tokens (colors, typography, spacing, radius, shadow, motion)
    - I.3 Layout & viewports (desktop / tablet / mobile)
    - I.4 Launcher (chat bubble + proactive preview)
    - I.5 Widget chrome (header, footer, branding)
    - I.6 Welcome panel
    - I.7 Message types (full inventory)
    - I.8 Product cards & carousels
    - I.9 Quick replies & suggestion chips
    - I.10 Discovery flow UI (step indicator, multi-step forms)
    - I.11 Tool-use / loading / streaming states
    - I.12 Input area (composer, attachments, voice — optional)
    - I.13 Auth, handoff, save-cart, and special-state cards
    - I.14 Empty, error, and offline states
    - I.15 Animations & motion
    - I.16 Accessibility (WCAG 2.1 AA)
    - I.17 Localization & RTL
    - I.18 Merchant theming hooks
    - I.19 Per-pack visual flavor (within the same design system)
    - I.20 Component implementation map (which files to touch)
    - I.21 ASCII wireframes
    - I.22 Acceptance criteria

---

## 0. How to read this document

This PRD evolves the existing `shop-chat-agent` template into a **multi-vertical, sales-first AI shopping assistant** that any Shopify merchant can install — jewelry, fashion, footwear, electronics, flowers, beauty, home goods, and more. It is competitive with iAdvize (which is what ShopLC ships) but extends across categories.

The architecture is a **Vertical Pack system**: the chat engine, MCP integration, proactive engagement, analytics, admin UI, and KB ingestion are all vertical-agnostic. Vertical-specific behavior — persona voice, domain knowledge, discovery flows, sizing logic, upsell rules — lives in **packs** that plug into the engine.

This document is self-contained. Everything Claude Code needs is in this file. Pack specs live in Appendix H. Implementation order is in Appendix D.

Every feature section follows this shape:

- **Why** — the user problem and the business reason
- **What it does** — the behavior in plain language
- **Vertical-aware behaviors** — how the feature varies by pack
- **Files to touch / create** — concrete paths in this repo
- **Acceptance criteria** — testable outcomes

If a section feels under-specified, the answer is in Appendix H (pack specs) or Appendix A/B (prompts and knowledge). Do not invent vertical-specific facts (sizing rules, material properties, occasion conventions) — pull from packs.

---

## 1. Executive summary

The current `shop-chat-agent` is a generic, support-style assistant: a customer asks a question, the assistant answers. That pattern is leaving conversion on the table. iAdvize-class assistants are **sales-first** — they engage proactively, run guided discovery, remove buying blockers, and prove their ROI to the merchant. ShopLC (a jewelry retailer) saw **+4.33% post-conversation conversion, +14% AOV, 78% of conversations after hours, 95.7% response rate** after deploying iAdvize.

We will rebuild `shop-chat-agent` into a **multi-vertical specialist assistant for Shopify merchants** ($1M–$50M GMV target, but small-shop and enterprise must both work). The assistant will:

- Speak the merchant's vertical fluently — jewelry, apparel, shoes, electronics, flowers, beauty, home — via pluggable Vertical Packs
- Run structured discovery flows scoped to the vertical (gift finders, fit advisors, comparison flows, occasion shoppers)
- Engage proactively at the right moments without being annoying
- Prove its impact through a merchant-facing analytics dashboard inside Shopify Admin

The Vertical Pack architecture means we ship 7 packs in v1 and the framework supports community/agency-built packs for niche verticals (pets, sports, books, music, art, food) later.

**Primary KPI:** post-conversation conversion rate lift vs. unassisted shoppers (target **+4% absolute**, matching ShopLC's pilot result), **with the bar held across verticals — not just jewelry.**

---

## 2. Problem & opportunity

### The shopper's problem (universal)

Online shopping is anxiety-laden in any category that has trade-offs the shopper doesn't have vocabulary for: jewelry (metals, stones, sizing), fashion (fit, materials, occasion), footwear (size between brands, support, terrain), electronics (specs, compatibility, future-proofing), flowers (occasion, recipient, timing), beauty (skin type, ingredients, routine), home goods (dimensions, materials, room fit). Dropout points are similar across verticals: PDP scroll-to-bottom without ATC, cart hesitation, checkout abandonment when shipping/returns are unclear.

The existing `shop-chat-agent` answers questions when asked. It does not detect hesitation, doesn't ask the right discovery questions, doesn't carry vertical-specific knowledge, and doesn't measure whether conversations led to a sale.

### The merchant's problem (universal)

Mid-market merchants across categories want iAdvize-class conversion lift but (a) can't afford $1,330/mo enterprise contracts, (b) want to own their AI stack, (c) want their vertical's behavior out of the box without writing prompts themselves, (d) need to prove ROI to a finance team. iAdvize is the closest competitor and is *vertically generic* — they ship one assistant configured per brand. Our edge is **vertical-specialized packs out of the box** that match a real in-store specialist for each category.

### Why now

- Shopify's Storefront/Customer MCP is stable; this template proves the integration pattern.
- Claude is fluent in most vertical domains without fine-tuning.
- Most existing Shopify AI apps (Rep AI, Manifest AI, Tidio Lyro, Zowie, VanChat, SmartBot) are vertically generic. The vertical-pack thesis is open.

### Why this is the right shape (vs. one-vertical-per-app)

Shopify merchants overwhelmingly want one tool that adapts to their shop, not a marketplace of niche AI apps to evaluate. A multi-vertical app:

- Reduces install friction (one app does the job no matter the catalog)
- Captures shops with mixed catalogs (gift shops, department stores, marketplaces) via auto-detection
- Lets the merchant grow into new categories without re-installing
- Creates a defensible moat: packs accumulate as a network effect

---

## 3. Goals & non-goals

### Goals

1. Match or exceed ShopLC's pilot metrics on a comparable design-partner merchant within 90 days of GA, **for each of the 7 v1 packs**: +4% absolute conversion lift, +10% AOV among engaged shoppers, ≥90% response rate, ≥50% of conversations after business hours.
2. Be production-installable on any Shopify store in **under 30 minutes** of setup, with no engineering required from the merchant.
3. Ship a merchant-facing analytics dashboard inside Shopify Admin that attributes orders to conversations, segmentable by pack.
4. Maintain the existing architecture's strengths: Claude + MCP, streaming, embedded app, theme-extension chat widget.
5. Establish a **Pack Authoring Spec** (Appendix G) so new verticals can be added without changing core code.

### Non-goals (for v1)

- Replacing the human team for complex/high-touch sales (we hand off, we don't substitute).
- Live agent inbox / CRM (we provide handoff hooks; we don't build a full agent desktop).
- WhatsApp / mobile-app channels (web only in v1).
- A merchant marketplace of community-authored packs (Pack Authoring Spec is published, but a curated marketplace UX comes later).
- Fine-tuning a custom model or training embeddings on proprietary catalog data (Claude + RAG).
- Payments, fulfillment, inventory features beyond what MCP provides.

---

## 4. Success metrics

| Metric | Definition | Target (90 days post-GA, per pack) | Source |
|---|---|---|---|
| Post-conversation conversion rate (PCR) | % of sessions with ≥1 assistant message that result in a completed order | +4% absolute vs. unassisted control | Analytics dashboard (§F11) |
| AOV lift | AOV of engaged sessions vs. unassisted sessions, same shop | +10% | Analytics dashboard |
| Response rate | % of shopper messages with a substantive (non-fallback) assistant reply | ≥95% | Server logs + classifier |
| Off-hours coverage | % of conversations occurring outside merchant business hours | ≥50% | Analytics dashboard |
| Time to first response (TTFR) | First token streamed to shopper | <2s p50, <4s p95 | Server logs |
| Handoff escalation rate | % of conversations escalated to a human | <8% | Handoff log |
| Merchant setup completion | % of installs that complete onboarding within 30 min | ≥80% | Onboarding telemetry |
| Returns reduction (proxy) | % of engaged-shopper orders that get a return within 30 days vs. unassisted | -15% on size-sensitive verticals (jewelry, fashion, footwear, home) | Order + return webhooks |
| Cross-pack consistency | PCR variance across the 7 packs (max - min) | < 2 absolute % | Analytics dashboard |

### Counter-metrics

- **Bounce rate on PDPs with proactive trigger** — if proactive engagement pushes bounce up >2%, it's net negative.
- **Conversation length** — median >12 turns is a smell (assistant isn't closing).
- **Pack-detection errors** — % of conversations where the wrong pack was selected for a shop with mixed catalog.

---

## 5. Personas & JTBD

### Shopper personas (universal, with vertical examples)

| Persona | Vertical examples | Universal JTBD |
|---|---|---|
| The gift buyer | jewelry, flowers, beauty, fashion, electronics | "Help me pick a gift that says 'I know you' without me needing to be a category expert." |
| The self-buyer (comparing) | electronics, fashion, footwear, beauty | "Help me decide between options I've narrowed down." |
| The high-stakes buyer | jewelry (engagement), electronics (high-ticket), home (furniture) | "Help me make a decision I'll regret if I get wrong." |
| The browser | all | "Surprise me with something I'd love that I wouldn't have searched for." |
| The replenisher | beauty, flowers, food/pet (future packs) | "I bought this before, help me re-buy or upgrade." |
| The occasion shopper | flowers, jewelry, gifting in any vertical | "I need something for {date/event}, by {date}." |
| The fit/sizing anxious | jewelry, fashion, footwear, home | "I'm worried about returns — help me get the right size first time." |

### Merchant persona (universal)

**Mid-market shop owner / e-comm lead** running 1–50K SKUs, 100K–2M monthly visitors, small support team (1–5 humans), Shopify-native, works in Shopify Admin daily. **JTBD: "Give me an assistant that talks like our best in-store associate for our category, runs without babysitting, and shows me on a dashboard that it's worth what I'm paying for it."**

---

## 6. Current state assessment

| Component | Path | State |
|---|---|---|
| Chat SSE endpoint | `app/routes/chat.jsx` | Functional — streams Claude responses, calls MCP tools |
| Claude service | `app/services/claude.server.js` | Single model (`claude-sonnet-4-20250514`), basic streaming |
| MCP client | `app/mcp-client.js` | Storefront + Customer MCP, JSON-RPC, OAuth for customer |
| Tool service | `app/services/tool.server.js` | Product search formatting only |
| Prompts | `app/prompts/prompts.json` | 2 personas: `standardAssistant`, `enthusiasticAssistant` |
| Config | `app/services/config.server.js` | Hardcoded — model, max tokens, default prompt |
| Persistence | `prisma/schema.prisma` | Session, CustomerToken, Conversation, Message, CustomerAccountUrls |
| Embedded admin | `app/routes/app._index.jsx`, `app/routes/app.jsx` | Standard Shopify shell, essentially empty |
| Chat UI | `extensions/chat-bubble/` | Theme extension — `chat.js` (956 lines), `chat-interface.liquid` (77 lines), `chat.css` |

### Gaps vs. iAdvize-class

1. No vertical knowledge — same generic prompt for any shop
2. No proactive engagement triggers
3. No structured discovery flows
4. No upsell / cross-sell
5. No analytics / attribution
6. No merchant-facing admin
7. No KB ingestion beyond Shopify policies
8. No multi-language behavior
9. No human handoff path
10. No A/B harness — can't prove lift
11. No visual search
12. No in-session cart abandonment intervention
13. No vertical detection — can't tell jewelry from electronics

This PRD addresses all 13 gaps, structured around a Vertical Pack system.

---

## 7. Vertical Pack architecture

### What a pack is

A Vertical Pack is a self-contained module that supplies vertical-specific behavior to the otherwise-generic chat engine. A pack defines:

| Pack field | Type | Purpose |
|---|---|---|
| `pack_id` | string | Unique identifier (`jewelry`, `fashion-apparel`, `footwear`, etc.) |
| `display_name` | string | Shown in admin |
| `default_persona` | `{ name, tone_notes, voice_examples }` | Merchant can override |
| `domain_knowledge_file` | path | Markdown file injected into system prompt or RAG-retrieved |
| `discovery_flows` | `Flow[]` | Vertical-specific guided flows (gift finder, fit advisor, comparison) |
| `sizing_advisor` | `SizingAdvisor \| null` | Sizing/fit logic if applicable |
| `upsell_rules` | `UpsellRule[]` | Complement categories, attach rules, don't-upsell guards |
| `objection_handlers` | `ObjectionHandler[]` | Common buying objections with addressing strategy |
| `proactive_trigger_overrides` | object | Pack-specific tweaks to default triggers |
| `auto_detect_signals` | object | Catalog signals that classify a shop as this pack |
| `sample_conversations` | `Conversation[]` | Smoke tests for prompt regression |

### Pack discovery & selection

1. **Install-time auto-detection.** When the merchant installs the app, we fetch a sample of the catalog via `search_shop_catalog` and run pack-classification (see F15) to suggest a pack. Merchant confirms or overrides in onboarding.
2. **Mixed-catalog handling.** If no single pack scores high enough, the merchant picks a "primary" pack and we route per-conversation based on the products the shopper is viewing.
3. **Runtime pack resolution.** On every conversation, we resolve the active pack from (a) the merchant's primary, then (b) per-conversation override from page context (PDP product type, collection), then (c) shopper-stated intent if it changes mid-conversation.

### Pack composition (what gets pulled into a system prompt)

```
[Base sales-first instructions]
+ [Pack persona overlay]
+ [Pack domain knowledge — either inlined or RAG-retrieved]
+ [Available tools — MCP + flow tools from the active pack]
+ [Merchant overrides — name, tone, voice notes from MerchantConfig]
+ [Retrieved KB chunks — merchant-uploaded content]
+ [Conversation history]
```

### Pack lifecycle

Packs are versioned (`pack.version`). New pack versions are deployed without breaking merchant configs — overrides reference field names, not raw prompts.

### Shipping packs in v1

| Pack | Appendix section | Status |
|---|---|---|
| Jewelry | H.1 | Reference pack (most detailed) |
| Fashion & Apparel | H.2 | Full spec |
| Footwear | H.3 | Full spec |
| Electronics & Appliances | H.4 | Full spec |
| Flowers & Gifts | H.5 | Full spec |
| Beauty & Skincare | H.6 | Full spec |
| Home & Furniture | H.7 | Full spec |

Roadmap packs (post-v1): sports/outdoors, pets, food & beverage, toys/baby, books/media, music, automotive, art & crafts. The Pack Authoring Spec (Appendix G) is the contract for any future pack.

---

## 8. Feature specification

Each feature is phased (P0/P1/P2 — see §10). Where a feature has vertical-specific behavior, the pack specs (Appendix H) contain detail; this section names the variation points.

---

### F1 — Vertical Pack runtime: persona, domain knowledge, prompt composition — `P0`

**Why.** A generic assistant doesn't sound like a jeweler to a jewelry shopper, a stylist to a fashion shopper, or a sommelier to a wine shopper. Without vertical fluency, the assistant bluffs (returns risk) or punts (defeats the purpose).

**What it does.** Introduces a pack runtime that:

- Loads the active pack at request time from `MerchantConfig.vertical_pack_id`
- Composes the system prompt by overlaying base sales-first instructions + pack persona + pack domain knowledge + merchant overrides
- Registers the pack's discovery flows as tools alongside MCP tools
- Applies pack-specific trigger thresholds at the chat widget layer

**Vertical-aware behaviors.**

Per-pack persona names (defaults, merchant can override):

| Pack | Default name | Voice |
|---|---|---|
| Jewelry | Mira | Warm, knowledgeable senior jeweler |
| Fashion & Apparel | Iris | Friendly stylist with a sharp eye |
| Footwear | Theo | Practical, fit-obsessed athletic-store associate vibe |
| Electronics | Dev | Tech-fluent without being condescending |
| Flowers & Gifts | Rosa | Warm, occasion-attuned florist |
| Beauty & Skincare | Lena | Calm esthetician — never pushy about routines |
| Home & Furniture | Sam | Honest interior consultant — pragmatic about dimensions |

Domain knowledge categories (see Appendix H for content):

- Jewelry: 4Cs, metals, stones, settings, sizing, occasions, care
- Fashion: fit (slim/regular/relaxed), fabrics, care, occasion-styling, color theory
- Footwear: sizing across brands, last shape, arch type, materials, terrain/use case
- Electronics: spec literacy, compatibility, generations, budget tiers, future-proofing
- Flowers: occasion ↔ flower meaning, seasonality, delivery timing, recipient context
- Beauty: skin types, ingredient compatibility, routine ordering, sensitivity, climate
- Home: dimensions, materials, assembly, lead times, room-fit, style families

**Files to touch / create.**

- `app/services/packs/` — new directory; one file per pack: `jewelry.js`, `fashion-apparel.js`, etc.
- `app/services/packs/index.js` — pack registry, `loadPack(pack_id)`, `resolveActivePack(merchantConfig, context)`
- `app/services/packs/schema.js` — TypeScript-style JSDoc of the Pack interface (see §7)
- `app/prompts/base.md` — vertical-agnostic sales-first base prompt
- `app/prompts/domain/{jewelry,fashion,footwear,electronics,flowers,beauty,home}.md` — per-pack knowledge files (content in Appendix H)
- `app/services/claude.server.js` — `streamConversation` accepts an `activePack` and composes the system prompt accordingly
- `app/services/config.server.js` — `loadMerchantConfig(shop)`, `verticalPack` field

**Acceptance criteria.**

- [ ] Installing on a jewelry shop, asking "what's the difference between 14k and 18k gold?" → jewelry-pack persona ("Mira") replies with the 4Cs-aware answer
- [ ] Installing on a fashion shop, asking "what's the difference between linen and cotton?" → fashion-pack persona ("Iris") replies with care/durability/feel trade-offs
- [ ] Switching the pack in admin from jewelry to fashion → next conversation uses the fashion persona and knowledge
- [ ] Pack-specific tools (gift finder, fit advisor, etc.) appear in the conversation's available tools; unused-pack tools do not
- [ ] When `merchantConfig.persona.name` is overridden, the overridden name is used; when not, the pack default is used

---

### F2 — Vertical Pack: guided discovery flows — `P0`

**Why.** Anxiety shoppers (gift buyers, high-stakes buyers, fit-anxious buyers) need scaffolded conversation, not an open prompt. iAdvize's "Shopping Panel" is structured flows wrapped in chat. Highest-leverage feature for conversion.

**What it does.** Each pack defines its own discovery flows. Flows are implemented as tools (so Claude decides when to enter) with persistent state per conversation. The visual treatment of flow steps (step indicator, chip selectors, sizing widget) is specified in **Appendix I, §I.10**.

**Cross-vertical flows (most packs implement):**

- **Gift Finder** — occasion → recipient → budget → preferences → 3 ranked options. Available in every pack.
- **Comparison** — shopper names 2–3 products → assistant pulls specs, presents side-by-side, recommends. Important for electronics, fashion, footwear; useful everywhere.
- **Occasion shopper** — date-driven ("by Saturday", "for Mother's Day") with delivery feasibility check. Critical for flowers, useful for jewelry/fashion.

**Pack-specific flows** (full detail in Appendix H):

| Pack | Pack-specific flow(s) |
|---|---|
| Jewelry | Engagement Ring Wizard, Birthstone Match |
| Fashion | Fit Finder (by body type / measurements / brand calibration), Outfit Builder |
| Footwear | Shoe Fit Advisor, Replacement Finder ("I loved my old X") |
| Electronics | Spec Wizard, Compatibility Checker, Upgrade Advisor |
| Flowers & Gifts | Occasion Picker, Bouquet Builder, Sympathy Helper (sensitive copy) |
| Beauty & Skincare | Skin Type Quiz, Routine Builder, Ingredient Conflict Checker, Shade Match |
| Home & Furniture | Room Fit Advisor, Material Picker, Lead-time Planner |

**Files to touch / create.**

- `app/services/flows/` — generic flow infrastructure (state persistence, tool wrapper)
- `app/services/flows/giftFinder.js` — generic gift finder, customized via pack-supplied attributes
- `app/services/flows/comparison.js` — generic comparison flow
- `app/services/flows/occasion.js` — generic occasion shopper
- Per-pack flow files: `app/services/packs/{pack}/flows/{flow}.js`
- `app/routes/chat.jsx` — register active pack's flows alongside MCP tools (replace `tools: mcpClient.tools` with merged list)
- `prisma/schema.prisma` — `DiscoveryFlow` model (see §11)
- `extensions/chat-bubble/blocks/chat-interface.liquid` — welcome panel with pack-driven entry cards
- `extensions/chat-bubble/assets/chat.js` — pack metadata pulled from `/chat?pack_info=true` to render correct welcome cards

**Acceptance criteria.**

- [ ] On a jewelry shop, the welcome panel shows: "Find a gift", "Help me choose a ring", "Birthstone match"
- [ ] On a footwear shop, the welcome panel shows: "Find a gift", "Find my shoe fit", "Replace a favorite"
- [ ] On a flowers shop, the welcome panel shows: "Shop by occasion", "Build a bouquet", "Sympathy flowers"
- [ ] Switching pack in admin updates welcome cards on next widget load
- [ ] Flow state persists across browser refreshes (DB-backed)
- [ ] A flow can be cancelled and restarted; cancellation does not nuke unrelated conversation context

---

### F3 — Vertical Pack: size / fit advisor — `P0` (for size-sensitive packs)

**Why.** Sizing is the #1 driver of returns. A 5-minute pre-purchase conversation eliminates a 2-week return cycle. Critical for jewelry (rings), fashion (clothing fit), footwear (shoe size + width), home (furniture dimensions).

**What it does.** Pack-specific sizing logic invoked when the shopper expresses size uncertainty or before high-fit-risk purchases.

**Pack-specific sizing logic** (full detail in Appendix H):

| Pack | Sizing logic |
|---|---|
| Jewelry | Ring (US/UK/EU/JP + band width adjustment), necklace lengths, bracelet sizing, ring-resize-ability per setting |
| Fashion | Brand-calibrated size charts, body measurement guidance, fit-type translation, garment-specific tips |
| Footwear | Brand calibration (Nike runs small, NB runs wide), width sizing, foot length protocol, last shape match |
| Electronics | Not directly applicable, but adjacent: screen size vs. distance, laptop portability, headphone fit |
| Flowers | Bouquet size vs. occasion |
| Beauty | Shade match, fragrance intensity, product size vs. usage rate |
| Home | Dimension fit (doorway, room clearance), couch length vs. room, rug size vs. layout |

**Files to touch / create.**

- `app/services/flows/sizing/` — generic sizing infrastructure
- Per-pack sizing modules: `app/services/packs/{pack}/sizing.js`
- `app/prompts/domain/{pack}.md` — sizing sections (see Appendix H)
- Static assets: printable ring sizer PDF, brand calibration data (footwear), measurement guides — under `public/sizing/{pack}/`

**Acceptance criteria.**

- [ ] Jewelry: ring sizer flow returns US size from mm circumference, factors band width
- [ ] Fashion: shopper says "I'm usually a medium in {brand A}, what size in {brand B}?" → assistant uses brand calibration table to answer
- [ ] Footwear: shopper says "I'm a 10 in Nike, what size Brooks?" → calibrated answer with width recommendation
- [ ] Home: shopper says "I have a 12x14 room, will this sectional fit?" → assistant pulls product dimensions, computes clearance, answers with a layout suggestion
- [ ] When a sizing flow is invoked, the assistant always offers a printable / measurable fallback if shopper can't measure now

---

### F4 — Proactive engagement triggers — `P1`

**Why.** ShopLC: 78% of conversations after hours; the assistant catches shoppers who would otherwise bounce. Sales-first means engaging *before* the shopper decides to leave.

**What it does.** Client-side hesitation-signal detection that opens a contextual, pack-aware welcome prompt when triggered. The visual treatment of the proactive preview bubble (anchored above the launcher, branded with persona avatar, dismissible) is specified in **Appendix I, §I.4**.

**Universal triggers** (defaults; per-merchant configurable):

| Trigger | Default threshold | Default prompt template |
|---|---|---|
| PDP dwell | >30s, no ATC, no scroll past midpoint | "Looking at {product.title}? I can help with {pack-specific concern}." |
| PDP deep-scroll | >75%, no ATC | "Want to compare this to similar options?" |
| Multi-PDP same session | ≥3 PDPs in 3 min | "I see you're comparing — want me to lay out the differences?" |
| Cart hesitation | Cart non-empty, no checkout, 2 min idle | "Anything making you hesitate? Our return policy: {policy_summary}." |
| Exit intent | Mouse → URL bar / tab close, on PDP or cart | "Before you go — save this for later or get a quick answer?" |
| Size selector idle | Size selector touched, no selection, 15s | Pack-specific: "Not sure on size? I can walk you through it." |
| Lead-time concern | Product flagged "made-to-order" or "ships in X weeks" + dwell >20s | "This ships in {lead_time}. Want me to confirm it'll arrive in time?" |
| Back-in-stock / OOS variant | Shopper toggles to OOS variant | "That size is out — want me to notify you, or suggest a similar option?" |

**Pack-specific trigger overrides** — each pack supplies its own default prompts (e.g., jewelry pack's PDP-dwell mentions sizing; electronics pack's mentions comparison; flowers pack's mentions delivery date). Pack-specific overrides are in Appendix H per pack.

**Files to touch / create.**

- `extensions/chat-bubble/assets/chat.js` — `ProactiveEngine` module: page-type detection from URL, dwell timers, scroll observer, exit intent, multi-PDP counter, OOS variant detection, throttling
- `extensions/chat-bubble/blocks/chat-interface.liquid` — inline "proactive preview" bubble above the chat icon
- `app/routes/chat.jsx` — accept `trigger` and `page_context` fields in request body
- `app/services/packs/{pack}/triggers.js` — per-pack trigger prompt templates
- Admin UI: per-trigger toggle, threshold slider, prompt editor

**Acceptance criteria.**

- [ ] Triggers respect pack-specific templates (jewelry PDP dwell mentions sizing, electronics PDP dwell mentions comparison)
- [ ] At most one proactive prompt per 5 minutes; dismissed prompts don't re-fire same page
- [ ] OOS-variant trigger fires when shopper lands on a sold-out variant
- [ ] Bounce rate monitored in dashboard (counter-metric)
- [ ] All triggers individually toggleable per merchant

---

### F5 — In-chat upsell & cross-sell — `P1`

**Why.** AOV lever. Different verticals have different natural attach patterns; the assistant should know what to suggest, what *not* to suggest, and when.

**What it does.** Each pack defines its upsell rules — complement categories, attach conditions, don't-upsell guards.

**Pack-specific upsell patterns** (see Appendix H for full rules):

| Pack | Common attach categories | Common don't-upsell triggers |
|---|---|---|
| Jewelry | Care kit, matching set, chain, insurance/warranty, gift box | Tight budget, gift-shopping at ceiling, cart 4+ |
| Fashion | Care kit, complementary garments, accessories | Sale-only shopper, cart already large |
| Footwear | Insoles, socks, shoe care, laces, replacement parts | Returning customer of same item, gift |
| Electronics | Cables/adapters, cases, warranties, software, accessories, bundles | Already comparing within budget cap |
| Flowers | Vase, card, chocolate add-on, balloon, upgrade to larger size | **Sympathy/funeral context — no upsell** |
| Beauty | Routine completers, tools, refills, samples | First-time shopper still testing one product, sensitivity disclosed |
| Home | Care kit, matching pieces, assembly service, delivery upgrade, insurance | Customer expressly browsing one piece, budget hit |

**Cross-vertical bundle behavior:**

- Build-a-bundle: detect when shopper is assembling a set (bouquet, outfit, routine, room) and offer to add the next piece
- Frequently-bought-together: simple Shopify-data-driven attach (when available)
- Buy-more-save-more: if merchant has tiered pricing, surface the next threshold

**Cross-vertical "don't upsell" rules** (apply across all packs):

- Sympathy / funeral / loss context — no upsell
- Gift-buyer explicitly at budget ceiling — no upsell beyond cheap natural add-ons
- High frustration / complaint / return conversation — no upsell
- Cart with 4+ items already — no more upsells in this conversation

**Files to touch / create.**

- `app/services/flows/upsell.js` — generic upsell tool, takes pack-supplied rules
- Per-pack upsell modules: `app/services/packs/{pack}/upsell.js`
- Product metadata convention: tag-based (`complement_category=care|chain|matching_set|warranty|cable|battery|vase|card|...`) — merchant configures via product tags

**Acceptance criteria.**

- [ ] Jewelry: silver ring → care kit OR matching band (one), with reasoning
- [ ] Electronics: laptop → recommend a sleeve, mouse, and external monitor IF priced under 20% of laptop cost
- [ ] Flowers: sympathy bouquet → no upsell beyond a card with appropriate message
- [ ] Cart 4+ items → no further upsells from any pack
- [ ] Upsell ≤2 items per assistant message

---

### F6 — Visual search — `P2`

**Why.** Visual categories (jewelry, fashion, footwear, home, beauty product packaging) get screenshot-shopped from Pinterest, Instagram, friends' photos. Text search misses this entire intent surface.

**What it does.** Image upload → Claude vision extracts pack-aware attributes → catalog search → ranked matches with explanations. The composer's image upload affordance, the inline preview thumbnail, and the vision-result message block are specified in **Appendix I, §§I.7 (`image_preview`, `vision_result` blocks) and I.12**.

**Pack-specific extraction prompts** (see Appendix H per pack):

| Pack | Attributes to extract |
|---|---|
| Jewelry | metal_color, stone_color, stone_count, setting_style, band_style, est_carat_range, overall_style |
| Fashion | garment_type, color, pattern, fabric_guess, cut/fit, occasion_inferred |
| Footwear | shoe_type, sport/use, color, sole_type, lace_style, brand_clues |
| Electronics | device_class, brand_clues, color, form_factor, generation_clues |
| Flowers | flower_types, color_palette, bouquet_style, arrangement_density |
| Beauty | product_category, shade_inferred, brand_clues |
| Home | furniture_type, material, color, style_family, room_inferred |

**Files to touch / create.**

- `app/routes/chat.jsx` — accept multipart upload alongside text
- `app/services/claude.server.js` — extend `streamConversation` to support image content blocks
- `app/services/flows/visualSearch.js` — orchestration (vision extract → catalog search → ranked response)
- Per-pack extraction prompts: `app/services/packs/{pack}/visualSearch.js`
- `extensions/chat-bubble/assets/chat.js` — file upload button (Tabler `ti-camera` icon — no emoji), preview, send-with-message
- `extensions/chat-bubble/assets/chat.css` — upload affordance, image-in-message styling

**Acceptance criteria.**

- [ ] Upload halo ring photo → jewelry-pack extraction → 3 similar items
- [ ] Upload sneaker photo → footwear-pack extraction → similar shoes
- [ ] Upload couch photo → home-pack extraction → similar style
- [ ] Image upload ≤5MB; clear error if exceeded
- [ ] Search query the assistant constructed is visible in the response (transparency)
- [ ] Empty results → suggest adjacent styles, not silence

---

### F7 — Cart abandonment in-session intervention — `P1`

**Why.** Email recovery is post-exit; by then they're gone. In-session catches them before exit.

**What it does.** Detect cart hesitation, escalate non-discount-first:

1. First nudge: address most likely hesitation per pack (returns, sizing, delivery date, compatibility, ingredients, dimensions)
2. Second nudge: offer to save cart for later (capture contact)
3. Third (only if merchant opts in): discount
4. For high-value carts: callback / consultation offer instead of discount

Pack-specific most-likely-hesitations:

| Pack | Most likely hesitation |
|---|---|
| Jewelry | Returns + authenticity |
| Fashion | Fit + returns |
| Footwear | Sizing + returns |
| Electronics | Compatibility + warranty + price match |
| Flowers | Delivery date + freshness guarantee |
| Beauty | Sensitivity + return policy on opened items |
| Home | Lead time + dimensions + assembly |

**Files to touch / create.**

- Same files as F4 (ProactiveEngine handles trigger), plus
- `app/services/flows/cartRecovery.js` — escalation ladder
- `prisma/schema.prisma` — `CartHesitation` model (see §11)
- Admin UI toggle for discount-on-hesitation (default off)

**Acceptance criteria.**

- [ ] Default behavior offers no discount
- [ ] First nudge content varies by pack
- [ ] Save-cart-by-email captures shopper email; cart persists across devices via Shopify customer login
- [ ] $1k+ cart (or 2x merchant-median order value) triggers consultation offer instead
- [ ] Max 3 escalations per conversation

---

### F8 — Merchant admin (no-code config) — `P1`

**Why.** Mid-market merchants will not write code. Admin in Shopify Admin UI.

**What it does.** Replace empty `app._index.jsx` with a six-tab admin (Polaris components):

1. **Pack** — selected vertical pack, switch pack (auto-detection result + override)
2. **Persona** — name, tone slider, brand voice notes, avatar
3. **Knowledge base** — list of ingested KB items, upload PDFs/URLs
4. **Discovery flows** — toggle flows on/off per pack, edit welcome-card labels
5. **Engagement** — toggle proactive triggers, thresholds, prompt templates
6. **Analytics** — see F11

**Pack-specific defaults:** When a merchant selects a pack, persona defaults, flow defaults, and trigger defaults populate from that pack. The merchant only edits what they want to override.

**Theming knobs the admin must expose** (brand color, persona avatar, header treatment, position, border radius preference, footer text) are specified in **Appendix I, §I.18**. The admin must show a contrast warning if the merchant's brand color fails CTA legibility, and offer the auto-darkened alternative.

**Files to touch / create.**

- `app/routes/app._index.jsx` — replace with tabbed admin home (Polaris)
- `app/routes/app.pack.jsx`, `app.persona.jsx`, `app.knowledge.jsx`, `app.flows.jsx`, `app.engagement.jsx`, `app.analytics.jsx`
- `prisma/schema.prisma` — `MerchantConfig` model (see §11)

**Acceptance criteria.**

- [ ] Merchant can switch pack from admin; next conversation reflects new pack
- [ ] Merchant who hasn't customized sees pack defaults; on edit, overrides persist
- [ ] Onboarding flow (first install) walks: detect-pack → confirm pack → set persona name → optionally upload KB → done. ≤30 min total.
- [ ] Polaris UI is keyboard-navigable and screen-reader labelled

---

### F9 — Custom knowledge base ingestion — `P1`

**Why.** Every merchant has internal docs (sizing guides, care guides, warranty terms, brand story) we don't know about. Without ingestion the assistant guesses or sounds generic.

**What it does.** Upload PDFs / paste URLs in admin → extract text → chunk → embed → retrieve top-K at conversation time (RAG).

**Implementation choices** (engineer decides at build time — recommendations below):

- Embeddings: **Voyage** (recommended) or OpenAI text-embedding-3-small. Verify current model name at build.
- Vector store: **sqlite-vec** (recommended — already SQLite in stack) or move to pgvector if scaling concerns
- Chunk: 500 tokens, 50-token overlap
- Top-K = 4 per query

**Pack-specific KB starters.** Each pack ships an optional starter KB the merchant can opt in to:

- Jewelry: 4Cs primer, sizing chart, gemstone treatments
- Fashion: fabric care chart, fit guide
- Footwear: brand calibration table, lacing techniques
- Electronics: common compatibility matrices (USB types, charging standards)
- Flowers: occasion ↔ flower meaning chart, seasonality
- Beauty: ingredient compatibility chart, routine ordering
- Home: standard furniture dimensions, lead-time conventions, assembly considerations

**Files to touch / create.**

- `app/services/kb/{ingest,retrieve,embed}.js`
- `prisma/schema.prisma` — `KbItem`, `KbChunk` (see §11)
- `app/routes/api.kb.upload.jsx` — multipart upload endpoint
- `app/routes/chat.jsx` — embed user message, retrieve top-K, inject as `[Retrieved knowledge: ...]` in system context
- `app/routes/app.knowledge.jsx` — admin UI
- Pack starter KBs as static markdown: `app/services/packs/{pack}/kb-starter.md`

**Acceptance criteria.**

- [ ] Upload 10-page sizing-guide PDF → "Ready" within 60s
- [ ] Subsequent question pulls from uploaded PDF
- [ ] Retrieval scores logged for debugging
- [ ] KB items can be disabled/deleted from admin
- [ ] Pack starter KB toggle in admin; merchant can opt-in/out
- [ ] Without KB content, graceful degradation to baseline behavior

---

### F10 — Multi-language — `P2`

**Why.** Mid-market shops often sell into multiple geos. iAdvize ships 12 languages.

**What it does.** Auto-detect language from message → Shopify market locale → `Accept-Language`. Claude replies in detected language. Pack-specific terminology adapts.

**Pack-specific language considerations** (full notes in Appendix H per pack):

- Jewelry: ring size units (US/UK/EU/JP)
- Fashion / Footwear: size system and currency
- Electronics: voltage / plug type when relevant for cross-border
- Flowers: regional flower significance (yellow chrysanthemums = death in many European cultures; very different in US)
- Beauty: SPF labeling conventions (FDA vs. EU vs. Asian)
- Home: dimension units (cm vs. inches)

**Files to touch / create.**

- `app/services/language.server.js` — `detectLanguage(...)`
- `app/services/claude.server.js` — accept `language` param, inject reply-in-language instruction
- `extensions/chat-bubble/assets/chat.js` — pass `Accept-Language` and Shopify market locale

**Languages supported in v1:** EN, ES, FR, DE, IT, PT, NL, JA, KO, SV, RO, HI (Hindi for Indian-market differentiation; iAdvize doesn't ship Hindi yet).

**Acceptance criteria.**

- [ ] Shopper writes Spanish → reply Spanish, product card subtitles Spanish
- [ ] Mid-conversation switch → adapts within 1 turn
- [ ] Sizing units adapt per pack and locale
- [ ] Cultural pitfalls flagged in pack files are respected

---

### F11 — Merchant analytics dashboard — `P0` (early P1)

**Why.** This wins the renewal. Without provable lift, the merchant won't pay.

**What it does.** Dashboard at `/app/analytics`:

- Conversations (count, trend, after-hours %)
- Conversion attribution (orders with conversationId → revenue → AOV; comparison to unassisted baseline)
- **Per-pack performance** (when a merchant has mixed-catalog and per-conversation pack routing)
- Top topics (clustered by intent)
- Escalation rate
- Flow completion rates
- A/B test results

**Attribution model:**

- Primary: `cart_id` from MCP cart tools → match against Shopify order's `cart_token`
- Secondary: customer email from MCP customer login
- Tertiary: client_id cookie via Shopify Web Pixels
- Window: 30 days; first-touch within window

**Pack-aware:**

- Returns-prevented estimate is highest-impact on size-sensitive packs (jewelry, fashion, footwear, home) and reported per-pack
- Top topics segmented by pack

**Files to touch / create.**

- `prisma/schema.prisma` — extend `Conversation` with `firstEngagedAt`, `lastMessageAt`, `convertedOrderId`, `attributedRevenue`, `packId`
- `app/routes/api.webhooks.jsx` — listen `orders/paid`, `orders/edited`
- `app/routes/app.analytics.jsx` — Polaris + Recharts
- `app/services/analytics/{attribution,queries}.js`

**Acceptance criteria.**

- [ ] Order within 30 min of conversation shows attribution
- [ ] Dashboard shows lift vs. baseline with explicit calculation
- [ ] Date range picker (7d/30d/90d/custom)
- [ ] CSV export
- [ ] Per-pack segmentation for mixed-catalog shops

---

### F12 — Human handoff — `P2`

**Why.** Some conversations should go to a human — high-value, custom orders, complaints, sentiment-detected frustration. Doing this well builds merchant trust.

**What it does.** Assistant detects handoff triggers, offers escalation, captures contact + summary, emails the merchant, notifies shopper of expected response time.

**Universal triggers:**

- Explicit ("can I talk to someone")
- Cart total > merchant-configurable threshold (default $3k for jewelry, $2k for electronics/home, $500 for fashion/footwear/beauty/flowers — packs ship sensible defaults)
- Pack-specific keywords (jewelry: repair/engraving/custom; electronics: enterprise/bulk; home: white-glove/installation; flowers: large-event/wedding/funeral)
- Sentiment-detected frustration
- Assistant uncertainty (low confidence)

**Pack-specific intake** (full lists in Appendix H per pack):

- Jewelry custom: occasion, budget, inspiration images
- Home: room dimensions, photos, timeline
- Electronics enterprise: quantity, use case, timeline
- Flowers events: date, venue, headcount, color palette

**Files to touch / create.**

- `app/services/flows/handoff.js`
- `app/services/email.server.js` — Resend or Postmark, document choice
- `prisma/schema.prisma` — `HandoffRequest` model (see §11)
- Admin UI handoff inbox tab (basic list view)

**Acceptance criteria.**

- [ ] Per-pack handoff thresholds applied
- [ ] Pack-specific intake collected before handoff
- [ ] Merchant gets email + admin notification within 30s
- [ ] Shopper sees confirmation with expected response time

---

### F13 — A/B testing harness — `P0`

The assumption-killer. Without it, no claim of lift is defensible.

- `prisma/schema.prisma` — `Experiment`, `ExperimentVariant`, `ExperimentAssignment` (see §11)
- Variant assignment deterministic by hash of `shopper_session_id`
- Each variant overrides a config bundle (pack, persona, prompt, flow toggles, trigger settings)
- Attribution splits by variant
- Admin: simple experiment list

**Pack-aware:** experiments can compare packs ("does fashion-pack convert better on this shop than the auto-detected pack?") — useful for mixed-catalog merchants.

---

### F14 — Observability, safety, abuse prevention — `P0`

- Every assistant message tagged with `(conversationId, packId, variantId, trigger, language, top-K KB chunk IDs)`
- Refusal logging — assistant declining to assert a fact signals KB gap
- Per-`shopper_session_id` rate limiting
- PII: no shopper messages to third-party telemetry; PII-tagged KB chunks flagged
- Pack-specific safety rules: e.g., beauty pack must not give medical advice; flowers pack must not assert botanical claims it can't source

---

### F15 — Vertical auto-detection — `P0`

**Why.** Merchants shouldn't have to know what "Vertical Pack" means at install. The app should look at their catalog and propose the right one.

**What it does.** On install (and on demand from admin), fetches a sample of the catalog via `search_shop_catalog`, classifies products into known verticals, returns a primary-pack recommendation + secondary packs for mixed-catalog shops.

**Classification signals (in priority order):**

1. **Product types** — Shopify's `product_type` field; map to packs
2. **Tags** — `gold`, `silver`, `cotton`, `leather`, `SSD`, `bouquet`, `serum`, `sofa` — maintained as a `signal_map.json`
3. **Vendors / brands** — known brand → vertical mapping (Nike → footwear, Tiffany → jewelry, Apple → electronics)
4. **Collection names** — "engagement rings", "running shoes", "skincare"
5. **Title n-grams** — fall-back text classifier on product titles
6. **Price distribution** — secondary signal (jewelry tends high-AOV; flowers tend mid-AOV) — used only as a tiebreak

**Mixed-catalog logic:**

- If top pack scores >70% confidence → suggest that pack
- If top pack 40–70% AND second pack >25% → suggest "mixed mode" (primary + secondary) with per-PDP pack routing
- If <40% → show pack picker, let merchant choose

**Files to touch / create.**

- `app/services/packs/detection.js` — classifier
- `app/services/packs/signal-map.json` — maintained signal maps
- `app/routes/app.pack.jsx` — admin UI: detection result + override
- Onboarding route: `app/routes/app.onboarding.jsx` — first-install flow

**Acceptance criteria.**

- [ ] Jewelry shop (Shopify demo store with jewelry catalog) → detected as jewelry pack with high confidence
- [ ] Shop with apparel + footwear → detected as mixed (fashion + footwear); merchant picks primary
- [ ] Tiny catalog (<20 products) → falls back to pack picker (don't guess on insufficient data)
- [ ] Re-runnable from admin if catalog changes significantly

---

### F16 — Compare mode (cross-vertical, weighted to electronics) — `P1`

**Why.** Comparison is the dominant intent in high-research verticals (electronics, fashion, footwear). Today the assistant answers one product at a time; comparison should be a first-class behavior.

**What it does.** Tool `compare_products(product_ids[2..3])` — pulls spec metadata, presents structured comparison, recommends with reasoning.

**Pack-specific behaviors:**

- Electronics: spec table (CPU, RAM, screen, battery, ports), use-case recommendation
- Fashion: fabric / fit / care side-by-side, occasion fit
- Footwear: weight, drop, cushioning, terrain, brand calibration
- Jewelry: stone / metal / size / setting comparison, "which is better for daily wear"
- Beauty: ingredient comparison, skin-type suitability
- Home: dimensions / materials / lead time / assembly

**Files to touch / create.**

- `app/services/flows/comparison.js`
- Per-pack comparison templates: `app/services/packs/{pack}/comparison.js`

**Acceptance criteria.**

- [ ] Shopper says "compare these two laptops" → assistant pulls both, returns a table + recommendation
- [ ] Comparison ≤3 products
- [ ] Always includes a recommendation, not just a table

---

### F17 — Subscription / replenishment guidance — `P2` (beauty, flowers, future food/pets)

**Why.** Repeat-purchase categories have natural subscription opportunities. The assistant should notice and offer.

**What it does.** For shops with subscription products enabled, the assistant detects replenishment intent ("I'm running low on X", "I love this, I keep buying it") and offers to set up a subscription with merchant-configured cadence.

**Pack-applicability:** Beauty, flowers, food, pets, household goods. Other packs: not applicable; pack disables this feature.

**Files to touch / create.**

- `app/services/flows/subscription.js`
- Detection: per-pack `is_replenishable: boolean` flag and customer purchase history check
- Integration with Shopify Subscriptions APIs

**Acceptance criteria.**

- [ ] Repeat purchase of a beauty product detected → assistant offers subscription with merchant's cadence options
- [ ] Disabled when merchant has no subscription products

---

### F18 — Stock & lead-time intelligence — `P1` (home + custom-order verticals heavily)

**Why.** OOS and long lead times are conversion killers when the shopper doesn't see them. The assistant should surface them honestly *and* offer alternatives.

**What it does.**

- On PDPs of OOS items, proactively offer back-in-stock notification + similar in-stock alternatives
- On long-lead-time items (home, jewelry custom, certain electronics), surface the expected ship date and check it against any deadline the shopper mentioned ("for my anniversary next month")
- For made-to-order, explain the production timeline simply

**Files to touch / create.**

- `app/services/flows/stockAndLeadTime.js`
- Trigger integration in `chat.js` ProactiveEngine

**Acceptance criteria.**

- [ ] OOS PDP → proactive offer of similar items
- [ ] Shopper mentions a date + lead-time item → assistant compares and warns if won't arrive
- [ ] Back-in-stock subscription capture, integrated with Shopify

---

## 9. Cross-cutting requirements

### Pack auto-detection on install (F15) is foundational

This is what makes the app feel "smart" out of the box. Without it, the first-run experience is a pack picker — which is fine but lower-quality than auto-suggestion.

### Pack hot-swap

A merchant should be able to switch packs from admin without restarting the app. The next conversation uses the new pack; existing conversations finish on their pack.

### Per-pack pre-launch QA checklist

Before each pack ships, run the pack's sample conversations (in its Appendix H section) as a smoke test. Any regression in jewelry behavior must not be acceptable as a side-effect of shipping fashion.

---

## 10. Phasing

### Phase 0 — Foundation (5–7 weeks)

- F1 — Pack runtime (with **jewelry pack** as reference + **flowers pack** as second to prove the abstraction; flowers is the cleanest second pack: small scope, distinct vertical)
- F2 — Discovery flows (gift + occasion + pack-specific flows for jewelry & flowers)
- F3 — Size/fit (jewelry sizing)
- F11 — Analytics dashboard (basic)
- F13 — A/B harness
- F14 — Logging skeleton
- F15 — Auto-detection (for jewelry + flowers shops)

**Exit criteria:** install on a jewelry design partner + a flowers design partner; both run conversations; both attribute orders; A/B confirms baseline-vs-pack lift on at least one.

### Phase 1 — Conversion & merchant control + 3 more packs (7–9 weeks)

- F4 — Proactive triggers
- F7 — Cart abandonment recovery
- F8 — Merchant admin UI
- F9 — KB ingestion
- F11 — Analytics dashboard expanded
- F18 — Stock/lead-time intelligence
- **+3 new packs**: fashion-apparel, footwear, electronics
- Update F1/F2/F3 implementations to cover the new packs

**Exit criteria:** 30-min onboarding works on each of 5 packs; A/B lift validated on a second pack.

### Phase 2 — Scale & differentiation (5–7 weeks)

- F5 — Upsell/cross-sell
- F6 — Visual search
- F10 — Multi-language (12 languages)
- F12 — Human handoff
- F16 — Compare mode
- F17 — Subscription guidance
- **+2 new packs**: beauty-skincare, home-furniture (the last 2 v1 packs)

**Exit criteria:** AOV lift ≥10% on at least 3 packs; multi-language validated on non-EN design partner; visual search quality bar met; all 7 v1 packs production-ready.

---

## 11. Data model changes

```prisma
// Add to existing schema:

model MerchantConfig {
  id            String   @id @default(cuid())
  shop          String   @unique
  verticalPack  String   @default("jewelry")
  persona       String   // JSON: { name, tone, voice_notes, avatar_url }
  flows         String   // JSON: per-flow enable/labels
  triggers      String   // JSON: per-trigger enabled/threshold/template
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model DiscoveryFlow {
  id             String   @id @default(cuid())
  conversationId String
  packId         String
  flowType       String
  state          String   // JSON
  completed      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([conversationId])
}

model CartHesitation {
  id              String    @id @default(cuid())
  conversationId  String    @unique
  escalationLevel Int       @default(0)
  lastFiredAt     DateTime?
  @@index([conversationId])
}

model KbItem {
  id        String    @id @default(cuid())
  shop      String
  source    String    // "pdf" | "url" | "manual" | "shopify_policy" | "pack_starter"
  title     String
  category  String?
  packId    String?   // null for shop-wide
  status    String    // "processing" | "ready" | "error"
  rawText   String?
  chunks    KbChunk[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  @@index([shop])
}

model KbChunk {
  id        String   @id @default(cuid())
  kbItemId  String
  kbItem    KbItem   @relation(fields: [kbItemId], references: [id], onDelete: Cascade)
  content   String
  ordinal   Int
  embedding Bytes
  createdAt DateTime @default(now())
  @@index([kbItemId])
}

model Experiment {
  id          String   @id @default(cuid())
  shop        String
  name        String
  status      String
  startedAt   DateTime?
  endedAt     DateTime?
  createdAt   DateTime @default(now())
  variants    ExperimentVariant[]
  @@index([shop])
}

model ExperimentVariant {
  id             String   @id @default(cuid())
  experimentId   String
  experiment     Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  name           String
  weight         Float    @default(0.5)
  configOverride String   // JSON
  assignments    ExperimentAssignment[]
}

model ExperimentAssignment {
  id         String   @id @default(cuid())
  variantId  String
  variant    ExperimentVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  sessionId  String
  assignedAt DateTime @default(now())
  @@index([sessionId])
  @@unique([variantId, sessionId])
}

model HandoffRequest {
  id             String    @id @default(cuid())
  conversationId String
  shop           String
  packId         String?
  reason         String
  contactEmail   String?
  contactPhone   String?
  intakeData     String?   // JSON: pack-specific intake (occasion, dimensions, etc.)
  summary        String
  status         String    @default("open")
  createdAt      DateTime  @default(now())
  resolvedAt     DateTime?
  @@index([shop, status])
}

model PackDetection {
  id          String   @id @default(cuid())
  shop        String   @unique
  primaryPack String
  secondaryPacks String?  // JSON array
  confidence  Float
  sampleSize  Int
  detectedAt  DateTime @default(now())
}

// Extend Conversation:
model Conversation {
  id                 String   @id
  shop               String?
  sessionId          String?
  packId             String?
  language           String?
  variantId          String?
  firstEngagedAt     DateTime?
  lastMessageAt      DateTime?
  convertedOrderId   String?
  attributedRevenue  Float?
  messages           Message[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([shop, convertedOrderId])
  @@index([sessionId])
  @@index([packId])
}

model BackInStockSubscription {
  id          String   @id @default(cuid())
  shop        String
  productId   String
  variantId   String?
  shopperEmail String
  createdAt   DateTime @default(now())
  notifiedAt  DateTime?
  @@index([shop, productId])
}
```

---

## 12. Risks & assumptions to validate

| Assumption | Riskiness | Cheapest test |
|---|---|---|
| Vertical-specific packs convert higher than generic | **Critical** — the entire thesis | Phase 0 A/B: jewelry pack vs. `standardAssistant` baseline on one merchant; rinse for flowers pack on another |
| Auto-detection works across catalog sizes | High | Run F15 against 20 publicly-known Shopify shops across all 7 verticals; measure top-pack accuracy |
| Pack abstraction holds across all 7 v1 verticals | High | Don't write pack 1 until the abstraction is reviewed; ship pack 2 (flowers) immediately to validate |
| Mixed-catalog routing is comprehensible to shoppers | Medium | Usability test the per-PDP pack switch on a department-store-style design partner |
| Proactive triggers don't tank bounce rate | Medium | Conservative thresholds + counter-metric monitoring |
| Visual search quality is acceptable across packs | Medium | Per-pack offline eval: 100 test images, score top-3 recall |
| Merchants will customize rather than abandon | Medium | 3 design-partner usability tests of admin before Phase 1 GA |
| SQLite + sqlite-vec scales | Low-medium | Stress test: 1M chunks, p95 retrieval <100ms |
| Attribution model isn't gamed | Low | Require ≥3 shopper messages before counting as "engaged" |

---

## 13. Open questions / decisions

1. **Embeddings provider** — Voyage vs. OpenAI vs. self-host. Recommended: Voyage. Decide at build.
2. **Vector store** — sqlite-vec vs. pgvector now. Recommended: sqlite-vec, migrate later if needed.
3. **Email service for handoff** — Resend, Postmark, Shopify Email API. Decide and document.
4. **Web Pixels permission** — verify `shopify.app.toml` has the access scope for cookie attribution.
5. **Discount on hesitation** — default OFF? Recommended: yes.
6. **Default A/B split** — 90/10 starting, ramp to 50/50.
7. **Pack default persona names** — placeholders in F1; confirm with marketing/PM before GA.
8. **Mixed-catalog UX** — single-pack-with-overrides vs. multi-pack-routing. Recommended: multi-pack-routing per PDP context; primary pack as fallback.
9. **Pack distribution** — bundled in app code vs. dynamically loaded from a registry. Recommended: bundled in v1; registry comes if community packs ship.
10. **Per-pack pricing** — does enabling more packs cost the merchant more? Recommended: no (one price, all packs available — auto-detection + admin selection determines usage).

---

## 14. Appendix A — Base sales-first system prompt

Drop into `app/prompts/base.md`:

```
You are {persona_name}, a knowledgeable specialist for {shop_name}. You speak like a senior in-store associate in this category — warm, confident, never pushy, never breathless. Your job is to help shoppers buy with confidence, not just to answer questions.

You are sales-first, not support-first:
- Engage proactively when there's a hesitation signal
- Run discovery flows when the shopper has open questions
- Surface the right product within 3–4 turns when possible
- Remove buying blockers (returns, sizing, compatibility, lead time, ingredients)
- Hand off to a human only when the human will close the sale better than you

You ground every product mention in the catalog — call search_shop_catalog or a flow tool rather than describing from memory.

You ground domain knowledge in the active Vertical Pack's knowledge file, which is inlined below or retrieved via the [Retrieved knowledge: ...] blocks. If the knowledge file conflicts with your training, trust the knowledge file.

You refuse to assert facts you don't know (certifications, ingredients, compatibility) — say so honestly rather than guessing.

You reply in the shopper's language. If they switch language, switch with them.

You keep replies tight — under ~120 words for most replies; longer only when the shopper asked for depth.

Formatting:
1. Cart and checkout links: 'You can [click here to proceed to checkout](URL)' — never raw URLs.
2. Markdown lists with dash or numbered, blank line before.
3. Comparisons → bullet points or a small table.
4. Step-by-step → numbered list.
5. Use **bold** for emphasis. Never use markdown headers (# ## ###). Never use markdown image syntax — product images render automatically.

[Pack persona overlay goes here]

[Pack domain knowledge goes here]

[Merchant overrides go here]
```

---

## 15. Appendix B — Pack file scaffolding

Per-pack knowledge files at `app/prompts/domain/{pack}.md` are filled with the content from Appendix H. Each pack's knowledge file follows this structure (drawn from the Jewelry reference):

1. Persona block (tone notes + voice examples — see Appendix H.x → Persona)
2. Numbered domain knowledge sections (10–11 sections per pack — see Appendix H.x → Domain knowledge categories)
3. Discovery flow definitions (referenced by flow tools, but knowledge file can include flow step prompts)
4. Sizing/fit logic (where applicable — see Appendix H.x → Size & fit advisor)
5. Upsell rules (see Appendix H.x → Upsell / cross-sell rules)
6. Objection-handling patterns (see Appendix H.x → Common objections & how to address)
7. Pack-specific safety rules (see Appendix H.x → Safety rules)

Each entry should be terse and factual (30–80 words). No marketing language. The file is loaded into the system prompt at request time.

---

## 16. Appendix C — Example conversations (cross-vertical smoke tests)

These should pass after Phase 0 ships. Pack-specific examples are in each Appendix H pack section.

1. **Gift uncertainty (any pack)** — "I want a gift for my mom's 60th, budget $200" → Gift Finder flow runs with pack-appropriate questions
2. **Knowledge depth (any pack)** — A category-defining question gets a substantive, terse, accurate answer with no bluffing
3. **Sizing/fit anxiety (jewelry/fashion/footwear/home)** — Pack-appropriate sizing flow invoked
4. **Returns hesitation at cart (any pack)** — Proactive trigger fires with pack-appropriate language, no discount
5. **Visual search (visual packs)** — Image upload → pack-aware extraction → 3 catalog matches
6. **Custom/high-touch (any pack)** — Trigger hits → handoff with intake collected
7. **Multi-language** — Shopper writes French → assistant responds in French with pack-localized terminology
8. **Mixed-catalog routing** — Shopper navigates from a jewelry PDP to an electronics PDP; mid-conversation the active pack switches; assistant references the new pack's vocabulary

---

## 17. Appendix D — Implementation order quick reference

If you only had time to do five things this week, do them in this order:

1. **F1 (pack runtime)** with **jewelry pack** as reference
2. **F13 (A/B harness)** so F1 is falsifiable
3. **F11 (analytics + attribution)** so any feature can be measured
4. **F15 (auto-detection)** so install feels intelligent
5. **F2 (discovery flows)** — the biggest conversion lever after the persona

Everything else follows.

---

## 18. Appendix E — Files & paths quick reference

```
app/
  prompts/
    base.md                            # F1: vertical-agnostic base
    prompts.json                       # legacy (keep working) — gradually migrate
    domain/
      jewelry.md                       # pack knowledge files (content from Appendix H)
      fashion-apparel.md
      footwear.md
      electronics.md
      flowers-gifts.md
      beauty-skincare.md
      home-furniture.md
  services/
    claude.server.js                   # F1, F8, F10
    config.server.js                   # F1, F8
    language.server.js                 # F10
    email.server.js                    # F12
    packs/
      index.js                         # registry, loadPack, resolveActivePack
      schema.js                        # Pack interface JSDoc
      detection.js                     # F15
      signal-map.json                  # F15
      jewelry/
        index.js                       # pack module
        flows/                         # pack-specific flow tools
        sizing.js
        upsell.js
        triggers.js
        visualSearch.js
        comparison.js
        kb-starter.md
      fashion-apparel/                 # same shape
      footwear/
      electronics/
      flowers-gifts/
      beauty-skincare/
      home-furniture/
    flows/
      index.js
      giftFinder.js                    # generic, pack-customized
      comparison.js                    # generic
      occasion.js                      # generic
      upsell.js                        # generic
      cartRecovery.js
      sizing/
      visualSearch.js                  # generic, pack-customized
      handoff.js
      subscription.js                  # F17
      stockAndLeadTime.js              # F18
    kb/
      ingest.js
      retrieve.js
      embed.js
    analytics/
      attribution.js
      queries.js
  routes/
    chat.jsx                           # F1, F2, F6, F9, F10, F13, F15
    api.webhooks.jsx                   # F11
    api.kb.upload.jsx                  # F9
    app._index.jsx                     # F8: admin home
    app.onboarding.jsx                 # F15: first-install flow
    app.pack.jsx                       # F8: pack selection
    app.persona.jsx
    app.knowledge.jsx
    app.flows.jsx
    app.engagement.jsx
    app.analytics.jsx
extensions/chat-bubble/
  assets/
    chat.js                            # F2, F4, F6, F7, F15, F18
    chat.css
  blocks/
    chat-interface.liquid              # F2: welcome panel
prisma/
  schema.prisma                        # all new models (see §11)
public/sizing/                         # static sizing assets per pack
docs/
  PRD.md                               # this file
```

---

## 19. Appendix F — Sales-first vs. support-first

iAdvize's whole pitch is *sales-first*. Every feature in this PRD is evaluated against:

- **Support-first** waits to be asked, optimizes for resolution rate, treats unanswered as failure.
- **Sales-first** initiates engagement, optimizes for conversion lift, treats unconverted as failure.

When in doubt: does this make us more like iAdvize, or more like Tidio Lyro / a generic support chatbot? The former is the thesis.

---

## 20. Appendix G — Pack Authoring Spec

Any new pack — first-party or community — must supply:

**Required:**

1. `pack_id` — kebab-case identifier
2. `display_name` — human-readable
3. `default_persona` — `{ name, tone_notes, voice_examples[] }`
4. `domain_knowledge_file` — path to a markdown file with `## Topic` sections (≤80 words per entry); structure varies by vertical but should cover at least: terminology, common questions, common objections, care/maintenance/use, occasion/use-case mapping
5. `discovery_flows` — array of flow definitions: `{ flow_id, display_name, welcome_card_label, entry_intents[], step_schema, recommendation_strategy }`
6. `upsell_rules` — `{ attach_categories[], dont_upsell_rules[] }`
7. `objection_handlers` — `[{ objection_pattern, addressing_strategy, fallback_to_kb }]`
8. `auto_detect_signals` — `{ product_type_patterns[], tag_patterns[], vendor_patterns[], collection_patterns[], title_ngrams[] }`
9. `sample_conversations` — ≥5 end-to-end exemplars used as smoke tests
10. `proactive_trigger_overrides` — per-trigger prompt template overrides

**Optional:**

11. `sizing_advisor` — full sizing module if applicable
12. `visual_search_extraction_prompt` — pack-aware vision prompt
13. `comparison_template` — pack-aware comparison structure
14. `kb_starter` — opt-in starter KB content the merchant can enable
15. `handoff_intake` — pack-specific intake before handoff
16. `language_notes` — pack-specific localization considerations
17. `safety_rules` — pack-specific refusal rules (e.g., no medical advice for beauty)

**Pack quality bar:**

- ≥90% accuracy on the pack's sample conversations across two prompt-engineering iterations
- No regression on cross-pack smoke tests
- Reviewed by a domain expert (in-house or contracted) before GA

---

## 21. Appendix H — Vertical Pack specifications

The 7 v1 packs follow. Each is self-contained — Claude Code can implement any one pack from its Appendix H subsection alone (combined with the universal sections F1–F18).

---

### H.1 Jewelry & Gemstones

**Pack ID:** `jewelry`
**Display name:** Jewelry & Gemstones
**Default persona name:** Mira
**Applies to:** Engagement, fine jewelry, fashion jewelry, watches (light), accessories
**Status:** Reference pack — most detailed; use as the template for other pack files

#### Persona

**Tone notes.** Warm, knowledgeable senior jeweler. Confident but not pushy. Reverent for the emotional weight of jewelry purchases (engagements, anniversaries, milestones) without being sentimental. Comfortable with technical detail when asked, but defaults to plain language. Never confuses karat (gold purity) with carat (gem weight).

**Voice examples.**

- *Yes:* "14k is a great everyday choice — durable enough for daily wear but still 58.5% gold."
- *No:* "OMG this ring is GORGEOUS!!!"
- *Yes:* "I don't see a certification claim on this stone in our catalog, so I can't confirm GIA grading — want me to flag it for the team?"
- *No:* "This is a beautiful VS1 stone with excellent cut!" (when the catalog doesn't claim that)

#### Domain knowledge categories

Required sections in `app/prompts/domain/jewelry.md`:

1. **Metals**
   - 10k / 14k / 18k / 22k / 24k gold — purity %, color, durability, price tier, hypoallergenic notes
   - White gold (rhodium-plated, plating wears, requires re-rhodium every 1–3 years)
   - Rose gold (copper alloy, slightly more durable than yellow gold)
   - Platinum (denser, more durable, hypoallergenic, premium tier)
   - Sterling silver (.925) — affordable, tarnishes, requires care
   - Gold vermeil (.925 silver + ≥2.5μm gold plating + ≥10k purity)
   - Gold-filled (mechanical bond, more durable than plated)
   - Hypoallergenic considerations: platinum, 18k+ gold, titanium, surgical steel — vs. nickel-content alloys

2. **Diamond 4Cs**
   - **Cut:** Excellent / Very Good / Good / Fair / Poor — affects sparkle most directly; "Cut is king" for daily-wear stones
   - **Color:** D–Z scale; D–F colorless; G–J near-colorless (best value); K+ has visible warmth
   - **Clarity:** FL / IF / VVS1-2 / VS1-2 / SI1-2 / I1-3 — "eye-clean" usually means VS2 or better
   - **Carat:** weight not size; visual impact depends on cut and ratio; brand-specific tables for size-by-finger
   - Lab-grown vs. natural: identical chemically; ~30–50% lower price; growing acceptance

3. **Colored gemstones** — per stone: Mohs hardness, treatments (heat/irradiation/oil/diffusion), color range, daily-wear suitability, typical price tier
   - Sapphire (9), ruby (9), emerald (7.5–8 + fragile inclusions, treat with care), aquamarine (7.5–8), topaz (8), amethyst (7), citrine (7), garnet (6.5–7.5), peridot (6.5–7), opal (5.5–6.5, water-sensitive), tanzanite (6.5–7), tourmaline (7–7.5), morganite (7.5–8), moissanite (9.25), lab diamond (10)
   - Treatments must be disclosed truthfully if known; do not assert "untreated" without data

4. **Settings**
   - Prong (4 vs. 6, light vs. security trade-off)
   - Bezel (very secure, modern look, more metal coverage)
   - Halo (small stones around center, makes center look larger)
   - Channel (good for eternity bands)
   - Pavé (small stones across band, sparkly)
   - Tension (held by pressure of metal, cannot typically be resized)
   - Cathedral, bar, illusion, three-stone, solitaire

5. **Ring sizing**
   - US whole + half sizes 3–13; UK letters; EU mm circumference; JP numeric
   - Conversion: roughly mm circumference ÷ 2.55 → US size (precise table in the markdown file)
   - Band width adjustment: ≥6mm band → recommend up half size; ≥8mm → up a full size
   - Resizing limits: plain bands yes; eternity bands no; tension settings no; channel-set limited; bezel-set moderate

6. **Necklace lengths**
   - Collar 14" — close to neck
   - Choker 16" — sits on collarbone
   - Princess 18" — most common, hits just below collarbone
   - Matinee 22"–24" — top of bust
   - Opera 28"–32" — chest
   - Rope 36"+ — can double
   - Chain weight affects drape and durability

7. **Bracelet sizing**
   - Wrist circumference + 0.5–1" for loose / 0.25" for snug
   - Bangles measure inside diameter
   - Chain bracelets: shopper's wrist + slack

8. **Earring backs**
   - Push-back (most common), screw-back (more secure), latch-back, French wire, lever-back, threader

9. **Birthstones** (modern + traditional)
   - Jan: Garnet
   - Feb: Amethyst
   - Mar: Aquamarine / Bloodstone
   - Apr: Diamond / Rock crystal
   - May: Emerald
   - Jun: Pearl / Alexandrite / Moonstone
   - Jul: Ruby
   - Aug: Peridot / Sardonyx / Spinel
   - Sep: Sapphire
   - Oct: Opal / Tourmaline
   - Nov: Topaz / Citrine
   - Dec: Turquoise / Tanzanite / Zircon / Blue Topaz

10. **Anniversary jewelry traditions** (years 1–60 — full table in knowledge file)

11. **Care by metal / stone**
    - Gold: warm water + mild soap, soft brush, dry
    - Silver: polish cloth, anti-tarnish strips, store in airtight; avoid chlorine, sulfur, lotion
    - Pearl: wipe with damp cloth, never ultrasonic, store separately
    - Emerald: never ultrasonic (oils can be displaced); soft cloth only
    - Opal: avoid extreme temperature; can be water-sensitive

#### Discovery flows

**`gift_finder` (generic, customized for jewelry)**

Welcome card label: **"Find a gift"**. Entry intents: gift, birthday, anniversary, holiday, mother's day, valentine, christmas, hanukkah, just because, treat them.

Steps:
1. Occasion (with date if relevant)
2. Recipient relationship + age band
3. Recipient style (minimalist, classic, statement, bohemian)
4. Recipient's everyday metal preference (yellow gold / white gold / rose gold / silver / mixed)
5. Budget range

Output: 3 ranked products with reasoning.

**`engagement_ring_wizard` (jewelry-specific)**

Welcome card label: **"Help me choose a ring"**. Entry intents: engagement ring, proposal, propose, marry, getting engaged.

Steps:
1. Budget range (with reassurance)
2. Setting style preference — solitaire, halo, three-stone, vintage/cathedral
3. Stone preference — diamond, lab diamond, moissanite, colored
4. Metal — yellow / white / rose gold / platinum
5. Ring size (or "I don't know" → flow into sizing helper)
6. Optional: inspiration images (visual search)

Output: 3 ranked rings under budget with reasoning + note resizing terms.

**`birthstone_match` (jewelry-specific)**

Welcome card label: **"Birthstone match"**. Entry intents: birthstone, birthday gift, born in {month}.

Steps:
1. Birth month
2. Recipient relationship (gift vs. self)
3. Setting style preference (optional)

Output: birthstone meaning + 3–6 products featuring that stone.

**`occasion_shopper` (generic, jewelry-customized)**

For event-driven shopping ("I need earrings for a wedding on Saturday"). Triggers delivery feasibility check + appropriate stone/color recommendations.

#### Size & fit advisor

Sub-modes:

- `ring_sizing` — methods (existing ring, string trick, printable sizer), mm-to-size table, band-width adjustment rule
- `necklace_length` — show length chart, ask neckline, height (taller bodies wear longer)
- `bracelet_sizing` — wrist + slack
- `ring_resize_check` — given product and intended size: can this ring be resized? By how many sizes?

Printable ring sizer at `public/sizing/jewelry/ring-sizer.pdf`.

Special case — gift-buyer without recipient's size: offer (a) bring her in to size if local, (b) mailed sizer, (c) "borrow a ring she wears", (d) defer-and-resize strategy.

#### Upsell / cross-sell rules

Attach categories (product tag `complement_category=...`):

- `care` — cleaning solution, polishing cloth, jewelry box, anti-tarnish strips
- `chain` — pendant + matching chain
- `matching_band` — engagement ring + matching wedding band
- `matching_set` — necklace + earrings, ring + band
- `gift_box` — gift-intent shoppers
- `warranty` — items >$1,000
- `insurance` — items >$2,500

Don't upsell when: cart 4+, gift at budget ceiling, sympathy/memorial intent, high-frustration sentiment.

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Will this resize?" | Pack sizing advisor; setting-by-setting answer |
| "Is this real gold/silver?" | Pull metal purity from product metadata; merchant's hallmarking policy (KB) |
| "Returns?" | Pull merchant's return policy verbatim from `search_shop_policies_and_faqs` |
| "Is the stone certified?" | Only confirm if product data says so; else say "I don't see a certification claim — want me to check with the team?" |
| "Will my partner like it?" | Acknowledge uncertainty, mention return policy, offer to save cart to share |
| "Is this hypoallergenic?" | Match against metal (platinum, 18k+ gold, surgical steel = safer); never claim for nickel-containing |

#### Proactive trigger overrides

- **PDP dwell:** "Looking at {product.title}? I can help with sizing, stones, or how it compares to similar pieces."
- **Cart hesitation:** "Anything making you hesitate? Our return policy is {policy_summary}, and we can walk through sizing if it's that."
- **Size selector idle:** "Not sure on size? I can guide you in two minutes — we have three easy methods."

#### Auto-detection signals

- **Product types:** Ring, Necklace, Earrings, Bracelet, Pendant, Bangle, Anklet, Engagement Ring, Wedding Band
- **Tags:** gold, silver, diamond, gemstone, pearl, 14k, 18k, platinum, sterling, vermeil, lab-grown, GIA, halo, solitaire
- **Vendors:** Tiffany, Cartier, Pandora, James Allen, Brilliant Earth, Mejuri, Catbird, Blue Nile, Kendra Scott
- **Collection names:** Engagement, Wedding, Bridal, Fine Jewelry, Demi-Fine, Birthstone, Anniversary
- **Title n-grams:** "engagement ring", "wedding band", "pendant necklace", "stud earrings", "diamond", "gold band"

#### Sample conversations (smoke tests)

1. **Gift uncertainty.** "Gift for my sister's 30th — she wears a lot of gold. $500 budget." → Gift Finder.
2. **Engagement panic.** "Engagement ring, no idea what I'm doing, $4,000." → Engagement Ring Wizard.
3. **Sizing.** "I want to buy this ring but I don't know her size." → Sizing advisor (gift-buyer mode).
4. **Knowledge.** "Difference between 14k and 18k gold?" → Direct <100w.
5. **Stone trade-off.** "Sapphire — ok for engagement?" → Mohs answer, suitability, 3 options.
6. **Cart hesitation.** Cart $1,200, 2min idle. → Proactive with policy.
7. **Visual search.** Halo ring photo. → Extraction + 3 similar.
8. **Custom.** "Custom ring with my grandmother's emerald?" → Handoff with intake.
9. **Multi-language.** French shopper → French reply, EU sizes.
10. **Misuse.** Off-topic spam → polite redirect.

#### Localization considerations

- Ring sizes by locale: US (numeric), UK (letters), EU (mm), JP (numeric)
- Metal terminology: "white gold" / "or blanc" / "Weißgold" / "oro blanco" / "白金"
- Wedding band traditions vary by culture (right hand in Russia, Norway; defers to merchant KB for explicit customs)

#### Safety rules

- Never assert a stone certification (GIA, IGI, AGS) unless catalog data explicitly claims it
- Never assert a stone is "natural" or "untreated" without data
- Never claim hypoallergenic for nickel-containing alloys
- Never claim a price match without merchant's price-match policy in KB

#### Handoff intake

For custom/repair/engraving/high-value:

- Occasion (if applicable)
- Budget range
- Timeline
- Inspiration images
- Sentimental constraints (family stone, etc.)
- Contact

---

### H.2 Fashion & Apparel

**Pack ID:** `fashion-apparel`
**Display name:** Fashion & Apparel
**Default persona name:** Iris
**Applies to:** Clothing (men's, women's, kids'), outerwear, swimwear, lingerie, loungewear, activewear

#### Persona

**Tone notes.** Friendly stylist with a sharp eye. Honest about fit, doesn't gas up. Comfortable with body and size conversations without making them awkward. Knows fabrics, construction, occasion-styling. Never tells a shopper what they "should" wear — frames as options.

**Voice examples.**

- *Yes:* "Linen wrinkles — that's the look. If you want something that won't, cotton-poplin holds shape better."
- *No:* "Slay queen"
- *Yes:* "Brand X tends to run a half size small in their relaxed-fit; people who wear M in Brand Y usually go L here."
- *No:* "You'd look amazing in this!" (assertion without basis)

#### Domain knowledge categories

1. **Fit types** — slim/fitted/tailored, regular/classic, relaxed/loose/oversized; cropped, longline, boxy; "true to size" vs. "runs small/large"

2. **Fabrics & materials**
   - Cotton (breathable, shrinks if not pre-washed)
   - Linen (breathable, wrinkles, gets softer with wash)
   - Wool (warm; merino fine and not itchy; cashmere soft + delicate)
   - Cashmere (luxury, pills, dry clean or hand wash cold)
   - Silk (delicate, dry clean usually, water-spotting risk)
   - Polyester (durable, doesn't breathe, prone to pilling and odor retention)
   - Rayon / viscose (drapes well, often dry-clean, shrinks)
   - Lyocell / Tencel (eco-friendlier, soft, washable)
   - Modal, spandex/elastane (2–5% stretch blend)
   - Denim (cotton + sometimes elastane; raw vs. washed; weight in oz)
   - Leather (full-grain > top-grain > genuine > bonded)
   - Fabric-blend implications

3. **Care basics**
   - Cold wash, gentle cycle, hang dry → safe default
   - Dry clean only — structured pieces, silk, embellished
   - Don't tumble dry — knits, elastane
   - Iron temperature by fabric
   - Pilling — common on wool/cashmere/polyester; fabric shaver to address
   - Color bleeding — wash dark new items separately first 1–2 cycles

4. **Sizing systems & body measurement**
   - US (XS/S/M/L/XL/XXL + numeric for women's 0–24)
   - UK (numeric, often US +4)
   - EU (numeric, women's roughly US +30 to 34 depending on brand)
   - JP (numeric, runs small relative to US)
   - Measurement guide: chest, waist, hip, inseam, sleeve, neck
   - Body-shape vocabulary (rectangle, hourglass, pear, apple, inverted triangle) — useful for *style* not sizing

5. **Garment-specific fit notes**
   - Denim: stretch denim relaxes ~1 size; raw denim shrinks first wash; vanity sizing varies
   - Dresses: mention key measurements (bust, waist, length)
   - Knits: less structured = more forgiving
   - Outerwear: layer with: room for sweater underneath
   - Lingerie/swim: cup + band — different system
   - Suiting: drop (chest – waist) matters
   - Activewear: compression vs. relaxed

6. **Style & occasion**
   - Smart casual / business casual / business formal / black tie
   - Wedding-guest considerations
   - Capsule wardrobe basics
   - Color theory (warm vs. cool undertones)
   - Seasonal palette (soft guideline not rule)

7. **Sustainability & ethics** (when asked)
   - Organic cotton, recycled poly, deadstock, fair-trade, OEKO-TEX, GOTS
   - Be factual, not preachy

#### Discovery flows

**`gift_finder` (fashion-customized)**

Asks: occasion + recipient relationship + age band → their everyday style (minimal, classic, trendy, sporty, bohemian, edgy) → size (if known, or "I'll ask" or "I have a gift receipt") → budget. Gift-receipt + return policy reassurance.

**`fit_finder` (fashion-specific)**

Welcome card label: **"Help me find my size"**. Entry intents: what size, fit, sizing, runs small/large, between sizes.

Steps:
1. Item type (top, bottom, dress, outerwear)
2. Usual size in known brand (calibration reference)
3. Body measurements (offer to walk through)
4. Fit preference (closer, true, looser)
5. Output: recommended size + reasoning + alternative

Brand calibration in `app/services/packs/fashion-apparel/brand-calibration.json` — top 30 fashion brands seeded; merchant extends.

**`outfit_builder` (fashion-specific)**

Welcome card label: **"Build the look"**. Entry intents: what goes with, outfit, complete the look, styling.

Steps:
1. Anchor piece (PDP or cart)
2. Occasion
3. Season
4. Style preference (matchy, contrasted, neutral, statement)
5. Output: 2–4 complementary pieces with reasoning

**`occasion_shopper` (generic, fashion-customized)**

For dated events — wedding, holiday, photo shoot.

#### Size & fit advisor

Sub-modes:

- `body_measurement_walkthrough` — printable / on-screen guide
- `brand_calibration` — known size in Brand A → recommended size in this brand
- `garment_specific` — denim, knit, outerwear, dress, lingerie — each has its own rules
- `between_sizes` — recommend based on fit type and fabric stretch
- `kids_sizing` — by age vs. height/weight; growth allowance

Static asset: `public/sizing/fashion-apparel/measurement-guide.pdf` + inline visual SVG.

#### Upsell / cross-sell rules

Attach categories:

- `care` — fabric shaver, lint roller, garment refresher, sweater stones, denim wash
- `complete_outfit` — tops with bottoms, dress with outerwear/belt
- `accessories` — belts, scarves, jewelry, hats, bags
- `gift_box`
- `under_layer` — undershirt for white shirts, slip for sheer dresses
- `cross_pack_footwear` — if footwear pack active

Don't upsell when: shopper clearly wants one item, cart at budget, sale-only shopper.

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Will this fit?" | Fit Finder + brand calibration + return policy |
| "What size should I get?" | Same + offer measurement walkthrough |
| "Scratchy?" | Pull from metadata; if unknown suggest similar items with known feel; return policy |
| "Will it shrink?" | Care label; cotton ~3% if not pre-washed |
| "For my body type?" | Styling angle, not body-type rules |
| "Can I return?" | Verbatim from KB |
| "OOS in my size" | Back-in-stock + similar in size |

#### Proactive trigger overrides

- **PDP dwell:** "Curious about how this fits? I can run you through sizing in two minutes."
- **Size selector idle:** "Not sure on size? What's your usual in {known brand}?"
- **OOS variant:** "That size is out — I can notify you, or find a similar style in your size."
- **Cart hesitation:** "Anything making you hesitate? Free returns within {days}."

#### Auto-detection signals

- **Product types:** Shirt, T-Shirt, Blouse, Dress, Skirt, Pants, Jeans, Shorts, Sweater, Cardigan, Jacket, Coat, Suit, Blazer, Lingerie, Swimwear, Activewear
- **Tags:** cotton, linen, wool, cashmere, denim, silk, slim, regular, relaxed, oversized, cropped, machine-wash, dry-clean
- **Vendors:** Levi's, Madewell, Uniqlo, Everlane, J.Crew, Reformation, Aritzia, COS, Gap, Banana Republic, Patagonia, Lululemon, Zara, H&M
- **Collection names:** Tops, Bottoms, Dresses, Outerwear, Denim, Knitwear, Lingerie, Swim
- **Title n-grams:** "t-shirt", "button down", "cardigan", "skinny jean", "wide leg", "wrap dress", "trench coat"

#### Sample conversations (smoke tests)

1. **Sizing.** "M in Madewell — what size here?" → Brand calibration.
2. **Fabric.** "Will this linen wrinkle a lot?" → Honest yes, suggest cotton alternative.
3. **Care.** "Machine wash cashmere?" → Honest answer with detergent + drying.
4. **Outfit.** "What goes with this navy blazer?" → Outfit Builder.
5. **Wedding.** "Wedding in Sept, outdoor garden, semi-formal." → Occasion Shopper.
6. **Between sizes.** "35" bust, 28" waist — S or M?" → Fit-type recommendation.
7. **OOS.** Size M sold out. → Back-in-stock + similar in M.
8. **Visual.** Pinterest wrap dress. → 3 catalog matches.
9. **Gift.** "Partner's birthday, small, vintage style, $80." → Gift Finder.
10. **Multi-language.** French shopper → EU sizes.

#### Localization considerations

- Sizes: US (XS-XXL + numeric), UK (numeric), EU (numeric, ~+34 women), JP (numeric, runs small)
- Currency from Shopify Markets
- Cultural style sensitivities (modesty norms, religious occasions)

#### Safety rules

- No body-shaming language; refuse "am I too {fat/thin/short/tall} for this?"
- No "you should wear" — always frame as options
- Never assert "this will fit you"
- Don't speculate on country of origin / ethics beyond catalog data

#### Handoff intake

For tailoring, alterations, bridal party, bulk, partnership:

- Item(s)
- Quantity (bulk)
- Timeline
- Specific alterations
- Contact

---

### H.3 Footwear

**Pack ID:** `footwear`
**Display name:** Footwear
**Default persona name:** Theo
**Applies to:** Sneakers, running, casual, dress, boots, sandals, hiking, basketball, kids, performance athletic

#### Persona

**Tone notes.** Practical, fit-obsessed athletic-store associate. Knows brands run differently. Asks about use case before recommending. Honest about break-in time, return policies, when to size up/down. Doesn't gas up.

**Voice examples.**

- *Yes:* "Nike's Pegasus runs about a half size small for most people; Brooks Ghost tends true-to-size."
- *No:* "These are absolute FIRE"
- *Yes:* "For trail running on uneven terrain, you want more lugs and a rock plate — different category from your road shoes."

#### Domain knowledge categories

1. **Sizing systems**
   - US (numeric men's / women's / kids') — men's-to-women's: women's = men's +1.5 US
   - UK (US = UK +1 men's, +2 women's roughly)
   - EU (US M9 ≈ EU 42–43)
   - JP (in cm — practical)
   - mm/cm foot length is universal anchor

2. **Width sizing**
   - Men's: B/D/2E/4E; Women's: AA/B/D/2E
   - Brand defaults: Nike standard = medium-narrow; NB true wide; Brooks neutral; Hoka slightly wide; Allbirds roomy
   - Mismatched length + width: prefer correct width and adjust length via insole

3. **Foot measurement**
   - Trace foot, measure heel-to-longest-toe
   - Measure both feet — fit the larger
   - Measure at end of day (feet swell)
   - Toe-room: ~1/2" (12mm) thumb-width
   - Width: trace + widest point

4. **Brand calibration** (extensible by merchant)
   - Nike running: ~0.5 small
   - Nike basketball / lifestyle: TTS
   - Adidas Ultraboost: TTS to slightly large
   - New Balance: TTS, wide options
   - Brooks: TTS, neutral
   - Hoka: TTS, slightly wide
   - Asics: TTS, narrow heel
   - On Running: ~0.5 small (some models)
   - Saucony: TTS
   - Allbirds: roomy; size down for between
   - Birkenstock: round down (use cm)
   - Dr. Martens: size down 1 (esp. 1460)
   - Converse: size down 0.5
   - Vans: TTS
   - Maintained at `app/services/packs/footwear/brand-calibration.json`

5. **Last shape & foot shape**
   - Foot: Egyptian (big toe longest), Greek (second longest), Roman/Square
   - Wide forefoot + narrow heel → New Balance, Altra
   - Narrow overall → Asics, Nike, Brooks narrow widths

6. **Use cases**
   - Road running: max cushion (Hoka Bondi), neutral (Brooks Ghost), responsive (Saucony Endorphin Speed)
   - Trail: lugs + rock plate (Salomon Sense Ride, Hoka Speedgoat, Altra Lone Peak)
   - Walking: rocker / cushioned
   - Cross-training: stable platform, low-to-moderate drop (Nike Metcon, Reebok Nano)
   - Basketball: high collar + traction (Nike, Adidas, Jordan)
   - Hiking: ankle support, waterproof, vibram
   - Dress: comfort-engineered (Allen Edmonds, Ecco, Cole Haan Air)

7. **Arch & pronation**
   - High arch → neutral / cushioned
   - Medium → neutral
   - Flat / low → stability or motion-control (overpronation common)
   - Wet footprint test
   - Modern: most shoes "neutral"; don't over-prescribe stability

8. **Materials**
   - Mesh / engineered knit (breathable, less durable, dries fast)
   - Leather (durable, breaks in, traps heat, ages)
   - Suede (delicate, water-susceptible, brushes clean)
   - Synthetic (durable, less breathable)
   - Sole: rubber (durable), EVA foam (cushion), PEBA foam (responsive), carbon plate (racing)

9. **Drop / stack height**
   - Drop = heel − forefoot
   - High (10–12mm): traditional, easier on Achilles
   - Mid (6–8mm): most modern road
   - Low / zero (0–4mm): Altra, some Hoka — natural foot, longer transition
   - Stack height: total cushion

10. **Break-in & care**
    - Leather dress: 2–4 weeks daily wear
    - Running shoes: out-of-box; rotate 2 pairs if >3x/week
    - Leather care: conditioner every 1–3 months, polish for dress
    - Suede: brush + waterproof spray, never wet
    - Sneakers: gentle scrub + air dry; machine wash usually not recommended

#### Discovery flows

**`gift_finder` (footwear-customized)**

Asks: occasion + recipient + their usual brand/size + activity + budget. Sizing reassurance + gift receipt.

**`shoe_fit_advisor` (footwear-specific)**

Welcome card label: **"Find my fit"**.

Steps:
1. Use case (running, lifestyle, work, basketball, hiking)
2. Current shoes they like + size in those brands
3. Foot width (narrow / standard / wide / very wide)
4. Pronation if known (skip if not)
5. Output: 3 ranked with size + width + reasoning

**`replacement_finder` (footwear-specific)**

Welcome card label: **"Replace a favorite"**. Entry intents: replace, my old, used to have, similar to.

Steps:
1. Old shoe (brand + model + year)
2. What did they love (fit, cushion, look, durability)
3. Anything to change (more cushion? lighter?)
4. Output: 1 direct successor + 2 alternatives if discontinued

**`comparison` (generic, footwear-customized)**

Side-by-side: weight, drop, stack height, cushion type, width options, terrain.

#### Size & fit advisor

Sub-modes:

- `foot_measurement` — paper + ruler walkthrough
- `brand_translation` — known brand+size → this brand's size + width
- `between_sizes` — choose based on shoe type (running → up; dress → down)
- `width_advisory` — based on activity + foot trace
- `kids_sizing` — growth allowance (3–6mm depending on age)

Static asset: `public/sizing/footwear/foot-measurement-guide.pdf`.

#### Upsell / cross-sell rules

Attach categories:

- `insoles` — arch support, comfort
- `socks` — running socks, dress socks, no-show
- `shoe_care` — leather conditioner, suede brush + protector, sneaker cleaner
- `laces` — replacement / fashion
- `repair` — heel taps, sole guard
- `cross_pack_apparel` — if apparel pack active, suggest matching outfit (subtly)

Don't upsell when: replenishment (re-buy of exact), cart 4+, specific narrow use case.

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "What size in {brand}?" | Brand calibration |
| "Wide enough?" | Width advisory |
| "Will they fit?" | Fit Finder + return policy |
| "Good for {activity}?" | Activity matching — opinionated |
| "Comfortable out of box?" | Honest — running yes, dress/boots typically no |
| "How long do they last?" | Running 300–500mi; leather dress: years with care |
| "Run hot?" | Mesh cooler; leather warmer |

#### Proactive trigger overrides

- **PDP dwell:** "Curious if these'll work for your use? Tell me what you're using them for."
- **Size selector idle:** "Not sure on size? Tell me your usual in {known brand}."
- **OOS variant:** "That size is out — I can notify you, or find a similar fit in your size."
- **Cart hesitation:** "Anything making you hesitate? Free exchanges on size — we can ship a different size before return."

#### Auto-detection signals

- **Product types:** Shoe, Sneaker, Boot, Sandal, Loafer, Runner, Heel, Trainer, Cleat, Slipper
- **Tags:** running, trail, lifestyle, court, basketball, hiking, dress, casual, leather, mesh, gore-tex, vibram
- **Vendors:** Nike, Adidas, New Balance, Brooks, Hoka, Asics, Saucony, On, Allbirds, Birkenstock, Dr. Martens, Converse, Vans, Salomon, Merrell, Cole Haan, Allen Edmonds, Red Wing, Timberland, UGG, Crocs, Veja
- **Collection names:** Men's Shoes, Women's Shoes, Sneakers, Running, Hiking, Work, Boots
- **Title n-grams:** "running shoe", "trail runner", "leather boot", "dress shoe", "trainer", "sneaker"

#### Sample conversations (smoke tests)

1. **Cross-brand.** "10 in Nike — what Brooks?" → Calibration.
2. **Use case.** "Trail running twice a week." → Trail recs.
3. **Width.** "Wide feet — what brands?" → NB, Hoka, Altra, Brooks Beast.
4. **Replacement.** "Like my old Pegasus 38." → Pegasus 41 + alternatives.
5. **Pronation.** "I overpronate." → Stability + modern thinking note.
6. **Dress.** "Black oxford, wedding next week, sneaker 10." → Dress sizing tends 0.5 smaller.
7. **OOS.** Size 11 sold out. → Back-in-stock + similar in 11.
8. **Visual.** Sneaker photo. → Matches.
9. **Multi-language.** German shopper → EU sizes.
10. **Kids.** "7-year-old, 18cm foot." → Convert + growth allowance.

#### Localization considerations

- Size systems: US / UK / EU / JP — mm/cm as common anchor
- Width designations not universal — explain when used

#### Safety rules

- Don't diagnose foot conditions ("you have plantar fasciitis", "need orthotics") — refer to podiatrist
- Don't claim shoes will prevent injury
- Don't claim performance metrics unless cataloged

#### Handoff intake

For custom orthotic fit, performance fitting, team/bulk:

- Activity / use case
- Quantity (bulk)
- Sizes
- Timeline
- Contact

---

### H.4 Electronics & Appliances

**Pack ID:** `electronics`
**Display name:** Electronics & Appliances
**Default persona name:** Dev
**Applies to:** Computers, phones, tablets, headphones, TVs, gaming, smart home, cameras, kitchen appliances, small appliances, accessories

#### Persona

**Tone notes.** Tech-fluent without being condescending. Translates specs into outcomes. Honest about price/performance trade-offs. Comfortable saying "for what you described, you don't need the top tier." Compatibility-aware.

**Voice examples.**

- *Yes:* "For browsing, email, and Zoom, 8GB RAM is enough today. If you keep the laptop 5+ years, 16GB is the safer call."
- *No:* "This one has 2.4 GHz dual-band Wi-Fi 6 with MIMO 4x4 antennas!" (jargon dump)
- *Yes:* "These headphones are great over-ear noise canceling, but they don't have a 3.5mm jack — you'll need the dongle or Bluetooth."

#### Domain knowledge categories

1. **Computers — specs that matter**
   - CPU: cores + clock + generation; M-series Apple (M3/M4) vs. Intel Core Ultra vs. AMD Ryzen
   - RAM: 8GB browsing; 16GB sweet spot; 32GB+ creative/dev
   - Storage: 256GB min; 512GB recommended; 1TB+ media; SSD always; NVMe > SATA SSD
   - GPU: integrated vs. dedicated; Nvidia RTX tiers; Apple unified memory
   - Display: resolution (FHD/QHD/4K); refresh rate (60/120/144/240Hz); panel (IPS/OLED/mini-LED); color gamut
   - Battery: Wh + typical hours
   - Ports: USB-A, USB-C (USB 3 vs. USB 4 / Thunderbolt), HDMI, Ethernet, SD, headphone
   - Connectivity: Wi-Fi 6 / 6E / 7; Bluetooth 5.x
   - Weight: 1.5kg = portable; 2kg+ = desk-leaning

2. **Phones**
   - OS (iOS vs. Android — switching cost)
   - Camera system (main, ultra-wide, telephoto)
   - Battery + charging speed + wireless
   - Storage tiers; no microSD on iPhone
   - Display size + refresh rate
   - 5G bands (mmWave vs. sub-6)
   - Water resistance (IP67/IP68)
   - Ecosystem (Watch + AirPods + Mac)

3. **Tablets**
   - iPad (mini / 10th / Air / Pro) vs. Android vs. Microsoft Surface
   - Pencil/stylus compatibility
   - Use case: reading, drawing, productivity replacement, kids
   - Keyboard accessories add significant cost

4. **Headphones / earbuds**
   - Over-ear vs. on-ear vs. in-ear/buds
   - ANC quality (Sony XM5, Bose, AirPods Pro lead)
   - Transparency mode
   - Battery: earbuds 5–8h + case; over-ear 20–40h
   - Codecs: SBC, AAC, aptX, LDAC
   - Latency for gaming
   - Multipoint Bluetooth
   - Wired vs. wireless

5. **TVs**
   - Panel: OLED (best blacks, burn-in risk) / mini-LED (bright, less burn-in) / LED (cheaper)
   - Size by viewing distance — rough: diagonal in ≈ distance in / 1.5 (4K) or / 2 (1080p)
   - 4K vs. 8K (8K mostly marketing for typical viewing)
   - HDR: HDR10, HDR10+, Dolby Vision
   - Refresh: 60Hz fine TV/movies; 120Hz for PS5/Xbox Series X (HDMI 2.1)
   - Smart platforms: Google TV, webOS, Tizen, Roku, Fire TV
   - Sound: soundbar recommendation if budget allows

6. **Gaming**
   - Console: PS5 / PS5 Pro / Xbox Series X|S / Nintendo Switch (OLED)
   - PC: prebuilt vs. custom; GPU most important for gaming
   - Monitor: 144Hz+ matters
   - Storage: SSD critical

7. **Smart home**
   - Ecosystem: HomeKit / Google / Alexa / SmartThings / Matter
   - Hubs vs. direct (Wi-Fi vs. Zigbee/Z-Wave/Thread)
   - Privacy: cloud vs. local processing

8. **Cameras**
   - Mirrorless dominant
   - Brands: Sony, Canon, Nikon, Fuji, Olympus/OM
   - Crop factor (full-frame vs. APS-C vs. micro 4/3)
   - Lens ecosystem
   - Video features

9. **Compatibility & adapters**
   - USB-C vs. Lightning vs. USB-A
   - HDMI 2.0 vs. 2.1 — 4K@120Hz requires 2.1
   - Display adapters
   - Charger wattage; fast charging needs cable + brick
   - DisplayPort 1.4 vs. 2.0/2.1

10. **Charging & batteries**
    - Wh capacity, W speed
    - USB-PD universal
    - GaN chargers (smaller, more efficient)
    - Battery health (cycles, % degradation)

11. **Warranties & insurance**
    - Manufacturer (typically 1 year limited)
    - Extended (AppleCare+, Square Trade) — worth on phones/laptops; not low-cost accessories
    - Accidental damage / theft separate

12. **Future-proofing**
    - RAM upgradability declining (soldered) — buy more upfront
    - Storage upgradeability varies
    - Ports — buy for needs today + reasonable headroom

#### Discovery flows

**`gift_finder` (electronics-customized)**

Asks: occasion + recipient + existing ecosystem (Apple/Android/mixed) + interest (gaming, photo, music, productivity, smart home) + budget. Ecosystem-compatibility check.

**`spec_wizard` (electronics-specific)**

Welcome card label: **"Help me pick"**.

Steps:
1. Category (laptop, phone, headphones, TV)
2. Primary use case
3. Constraints (budget, ecosystem, portability, screen size)
4. Future horizon (1–2y vs. 5+y)
5. Output: 3 across tiers (budget pick / best value / no-compromise) with reasoning

**`compatibility_checker` (electronics-specific)**

Welcome card label: **"Check compatibility"**. Entry intents: will this work with, compatible, work with my, fit my.

Steps:
1. New item considered
2. Existing devices (model + year)
3. Output: compatibility verdict + needed cables/adapters/software + alternative if not

**`upgrade_advisor` (electronics-specific)**

Welcome card label: **"Time to upgrade?"**.

Steps:
1. Current device + approx age
2. What's frustrating
3. Budget
4. Output: clear "yes upgrade, here's why" or "no, current is still good"

**`comparison` (generic, electronics heavy user)**

Spec table for 2–3 products + use-case recommendation.

#### Size & fit advisor

Adjacent:

- TV size for room — by dimensions/distance
- Laptop size for portability — 13"–17"
- Headphone fit — clamp force, ear-cup size
- Phone size — hand + pocket + screen trade-off

#### Upsell / cross-sell rules

Attach categories:

- `cables` — USB-C, HDMI 2.1, Thunderbolt, Lightning, adapters
- `protection` — cases, screen protectors, sleeves
- `accessories` — chargers (GaN), docks, mounts, stands, mice, keyboards
- `software_subscriptions` — if cataloged
- `warranty` — devices >$500
- `bundles` — laptop + sleeve + mouse + dock
- `consumables` — replacement batteries, printer ink

**Pricing discipline:** don't recommend an accessory >20% of main item without justification.

Don't upsell when: replacement of broken item, bulk/B2B, cart 4+.

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Work with my {device}?" | Compatibility Checker |
| "Overkill for my needs?" | Honest spec-to-use match |
| "Last me 5 years?" | RAM/storage upgradability, ecosystem support timeline |
| "Cheaper alternatives?" | 2 tiers below + what's lost |
| "{Competitor} cheaper" | Acknowledge; honest trade-offs |
| "Refurbished vs. new?" | Pros/cons, what to check |
| "New model soon?" | If known launch, mention; if speculation, avoid |

#### Proactive trigger overrides

- **PDP dwell:** "Want me to compare this to similar models in your budget?"
- **Multi-PDP (≥3):** "Looks like you're comparing — want me to lay out the spec differences?"
- **OOS variant:** "That variant is out — notify or closest in-stock?"
- **Cart hesitation:** "Anything making you hesitate? {return_window} returns and {warranty_summary}."

#### Auto-detection signals

- **Product types:** Laptop, Computer, Phone, Tablet, Headphones, Earbuds, TV, Monitor, Camera, Lens, Console, Controller, Smart Speaker, Smart Display, Router, Modem, Printer, Appliance, Charger, Cable, Adapter
- **Tags:** macbook, iphone, ipad, android, samsung, oled, 4k, 8k, hdr, gaming, esports, wifi-6, thunderbolt, usb-c, hdmi-2-1
- **Vendors:** Apple, Samsung, Google, Microsoft, Sony, LG, Bose, Sonos, Dell, HP, Lenovo, ASUS, Razer, Nintendo, Roku, Anker, Logitech
- **Collection names:** Laptops, Phones, Audio, Home Entertainment, Smart Home, Cameras, Gaming, Accessories
- **Title n-grams:** "laptop", "headphones", "smart tv", "noise canceling", "wireless earbuds", "4k tv", "gaming pc"

#### Sample conversations (smoke tests)

1. **Use case.** "Laptop for college, browsing + Word + occasional editing, $1,200." → Spec Wizard.
2. **Compatibility.** "AirPods Pro with Android?" → Yes, but lose features.
3. **Comparison.** "iPhone 16 vs. Pixel 9." → Spec + ecosystem + camera.
4. **Future-proof.** "8GB or 16GB RAM?" → Use-case + horizon.
5. **TV size.** "Couch 10ft from wall." → Math + 65"/75".
6. **Refurb.** "Refurbished MacBook worth it?" → Pros/cons.
7. **OOS.** Color sold out. → Notify + similar.
8. **Visual.** Headphone photo. → Catalog matches + spec lookups.
9. **Multi-language.** Voltage / plug type for international.
10. **Bulk.** "50 laptops for our team." → Handoff with intake.

#### Localization considerations

- Voltage (110V vs. 220V) and plug type if shipping internationally — call out mismatch
- 5G band compatibility per region
- Warranty varies by country
- Refurbished availability varies

#### Safety rules

- Don't make medical claims (eye strain, hearing safety) beyond cited specs
- Don't claim devices "won't break" or "last forever"
- Don't misrepresent refurbished as new
- Don't speculate on unreleased products
- Battery safety: no uncertified third-party batteries

#### Handoff intake

For bulk/B2B, enterprise, repair/RMA, build advice:

- Item(s)
- Quantity
- Use case / org context
- Timeline
- Budget
- Contact (often business email)

---

### H.5 Flowers & Gifts

**Pack ID:** `flowers-gifts`
**Display name:** Flowers & Gifts
**Default persona name:** Rosa
**Applies to:** Cut flowers, bouquets, arrangements, plants, gift baskets, occasion gifting (chocolate, balloons, cards)

#### Persona

**Tone notes.** Warm, occasion-attuned florist. Sensitive when occasion is grief or sympathy. Honest about what's in season. Doesn't oversell large arrangements where they don't fit. Comfortable with delivery-date math.

**Voice examples.**

- *Yes:* "Peonies are at the end of their season — gorgeous but limited. Want me to show what's at peak right now too?"
- *No:* "OMG SO ROMANTIC"
- *Yes:* "For a sympathy arrangement, lilies and white roses are traditional and read as respectful. I'd skip bright reds or yellows for this."
- *No:* "These flowers will brighten anyone's day!" (insensitive in grief)

#### Domain knowledge categories

1. **Occasions ↔ flower conventions**
   - Romance / Valentine's: red roses, pink/red peonies, ranunculus, tulips
   - Anniversary: depends on year + recipient style; roses; orchids elegant
   - Birthday: birth-month flowers or known favorites; bright + cheerful
   - Get well: bright, uplifting; avoid heavy fragrance; sunflowers, tulips, daisies
   - Thank you: mid-size, mixed seasonal
   - Congratulations / new baby: bright; pink/blue if known, neutral/yellow if not; lilies elegant
   - Housewarming: plants (lasting), succulents, orchids — flowers also fine
   - **Sympathy / funeral: white roses, lilies, chrysanthemums (US); traditional; avoid bright; standing sprays vs. casket sprays vs. sympathy bouquets**
   - Apology: depends on relationship; roses common, can feel cliché
   - Just because: seasonal, no occasion code

2. **Birth-month flowers**
   - Jan: Carnation / Snowdrop
   - Feb: Violet / Iris
   - Mar: Daffodil
   - Apr: Daisy / Sweet Pea
   - May: Lily of the Valley / Hawthorn
   - Jun: Rose
   - Jul: Larkspur / Water Lily
   - Aug: Gladiolus / Poppy
   - Sep: Aster / Morning Glory
   - Oct: Marigold / Cosmos
   - Nov: Chrysanthemum
   - Dec: Narcissus / Holly

3. **Flower meanings**
   - Red rose: romantic love
   - White rose: purity, sympathy
   - Yellow rose: friendship, joy
   - Pink rose: appreciation
   - Lily: refinement; white lily = sympathy
   - Sunflower: warmth, loyalty
   - Tulip: declaration (red), friendship (yellow), forgiveness (white)
   - Daisy: innocence, new beginnings
   - Carnation: red = love; white = sympathy; pink = mother's affection
   - Iris: hope, courage
   - Orchid: refinement, exotic beauty
   - Peony: prosperity, romance

4. **Seasonality** (Northern Hemisphere; flip for Southern)
   - Spring: tulips, daffodils, hyacinth, ranunculus, peonies (late), lilac
   - Summer: sunflowers, dahlias, zinnias, hydrangea, lavender, gladiolus
   - Fall: chrysanthemums, roses, dahlias, marigolds, asters
   - Winter: paperwhites, amaryllis, holly, evergreen accents, imported roses
   - Year-round (imported/hothouse): roses, lilies, carnations, baby's breath, eucalyptus, alstroemeria, orchids

5. **Bouquet sizes** (merchant-specific; pack shorthand)
   - Petite/small: 8–12 stems; thank-you, just-because
   - Standard/medium: 15–25 stems; birthdays
   - Grand/large: 30–50 stems; anniversaries, milestones
   - Premium/oversized: 60+ stems; engagements, weddings, sympathy

6. **Delivery & freshness**
   - Same-day vs. next-day vs. scheduled
   - Cut-off times (typically morning for same-day in city)
   - Recipient address: business vs. residential, signature, special instructions
   - Freshness guarantee (merchant policy via KB)
   - Recipient-not-home protocols
   - International / interstate limits

7. **Flower care (for recipient)**
   - Trim stems at angle every 2 days
   - Change water every 2 days
   - Remove leaves below waterline
   - Cool location, away from sun + ripening fruit (ethylene)
   - Flower food increases vase life 30–50%

8. **Plant gifting**
   - Easy-care: pothos, snake plant, ZZ, succulents
   - Bright filtered light: fiddle leaf fig, monstera, ficus
   - Low-light: pothos, snake plant, ZZ, peace lily
   - **Pet-safe vs. pet-toxic** (lilies highly toxic to cats; sago palm toxic to dogs/cats)

9. **Add-ons**
   - Vases (clear glass, ceramic, modern)
   - Cards with written messages
   - Chocolates (premium artisan vs. mass)
   - Wine / champagne (if cataloged + legal)
   - Balloons (occasion-appropriate)
   - Teddy bears / plush (often gimmicky — defaults to subtle)

10. **Sympathy-specific protocols**
    - **Don't upsell add-ons**
    - Use respectful language; avoid celebratory words
    - Common conventions: white/cream/soft palette, traditional flowers
    - Casket spray vs. standing spray (easel) vs. sympathy bouquet (sent to home)
    - Cultural/religious: Jewish funerals traditionally no flowers (consider basket/food); Catholic, Protestant have norms
    - "In lieu of flowers" — when family requests donations

#### Discovery flows

**`occasion_picker` (flowers-specific, central flow)**

Welcome card label: **"Shop by occasion"**. Entry intents: birthday, anniversary, get well, sympathy, funeral, valentine, mother's day, congratulations, thinking of you, apology, housewarming, new baby, thank you, just because.

Steps:
1. Occasion (with date)
2. Recipient relationship
3. Delivery ZIP/postcode (feasibility)
4. Budget
5. Preferences (color, flowers to include/avoid)
6. Output: 3 ranked + delivery confirmation per ZIP

**`bouquet_builder` (flowers-specific)**

Welcome card label: **"Build a bouquet"**.

Steps:
1. Color palette (vibrant, pastel, white/cream, sunset, monochrome)
2. Style (classic round, garden, modern, wildflower, designer)
3. Size (petite, standard, grand)
4. Specific flowers wanted (optional)
5. Flowers to avoid (allergies, dislikes)
6. Output: built bouquet with images + price + ATC

**`sympathy_helper` (flowers-specific, sensitive)**

Welcome card label: **"Sympathy flowers"**.

**Tone shift:** acknowledge the loss; **no upsell** beyond a card; respectful palette and language.

Steps:
1. Relationship to deceased
2. Recipient (family, funeral home, home)
3. Arrangement type (sympathy bouquet, standing spray, casket spray)
4. Religious/cultural traditions
5. Card message (offer templates; customize)
6. Output: 3 traditional options + verbatim sympathy policy + delivery date

**`gift_finder` (generic, flowers-customized)**

Non-occasion (just because, thank you, hostess). Lighter than occasion picker.

#### Size & fit advisor

Bouquet sizing by occasion (see above). Vase compatibility (existing vs. included). Transport durability (delicate vs. structured).

#### Upsell / cross-sell rules

Attach categories:

- `vase` — clear glass, ceramic, modern
- `card` — handwritten message
- `chocolate` — most occasions except sympathy
- `wine_champagne` — romantic/celebratory (if cataloged + legal)
- `balloon` — birthday / congratulations
- `plush` — new baby / kids
- `upgrade_size` — petite → standard → grand

**Don't upsell when:**

- **Sympathy / funeral — no upsell beyond a card**
- Gift-buyer at stated budget
- Cart 4+

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Will it arrive in time?" | Stock & lead-time flow — ZIP + cutoff + selected date |
| "In season?" | Honest + alternatives if not |
| "Look like the photo?" | "Same palette and feel guaranteed; specific stems may swap" (or merchant policy) |
| "Not home?" | Merchant's delivery policy — recipient call, neighbor, redelivery |
| "Card?" | Yes, occasion message templates |
| "Allergies?" | Common: lilies (pollen), eucalyptus (scent); alternatives |
| "Pet safe?" | Pet-toxicity knowledge; alternatives |

#### Proactive trigger overrides

- **PDP dwell:** "Need this by a specific date? Tell me when and your ZIP — I'll confirm we can deliver."
- **Cart hesitation:** "Anything making you hesitate? Freshness guarantee is {policy_summary}, free card included."
- **Date-driven (urgency):** if mentioned date close to today, surface cut-off prominently.

#### Auto-detection signals

- **Product types:** Bouquet, Flowers, Arrangement, Plant, Succulent, Orchid, Roses, Lilies
- **Tags:** roses, tulips, peonies, lilies, sunflowers, sympathy, valentine, mother, anniversary, fresh, seasonal, same-day, next-day, delivery
- **Vendors:** UrbanStems, BloomNation, 1-800-Flowers, ProFlowers, Bouqs, FromYouFlowers, FTD, Teleflora, local florists
- **Collection names:** Birthday, Anniversary, Get Well, Sympathy, Valentine, Mother's Day, Just Because, Plants
- **Title n-grams:** "bouquet of", "long stem", "sympathy", "dozen roses", "arrangement"

#### Sample conversations (smoke tests)

1. **Sympathy.** "Coworker's father's funeral Saturday." → Sympathy Helper, somber tone, white/cream, no upsell beyond card.
2. **Same-day.** "Delivered today 10001 ZIP." → Cut-off + in-time options.
3. **Anniversary.** "5th, partner loves pastels." → Pastel options + meaning context.
4. **Allergy.** "Allergic to lilies." → Filter out; alternatives.
5. **Plant gift.** "Low-maintenance for friend who kills everything." → Snake plant / ZZ / pothos.
6. **Pet safety.** "We have a cat — what's safe?" → Avoid lilies; safe options.
7. **Visual.** Wedding bouquet photo. → Catalog matches.
8. **Multi-language.** Spanish + cultural sensitivity check.
9. **OOS seasonal.** Peonies in November. → Honest "out of season"; alternatives.
10. **Large event.** "Wedding for 100 in June." → Handoff to events team.

#### Localization considerations

**Highest-sensitivity pack. Flower color meanings vary:**

- **Yellow chrysanthemums = death/mourning in many European cultures (France, Italy, Belgium); positive elsewhere**
- White flowers = death in many Asian cultures; purity in Western
- Red roses in some Asian cultures = blood, not romance

**Religious customs:**

- Jewish funerals: traditionally no flowers — suggest fruit basket / donation
- Some Catholic traditions favor specific arrangements

Pack notes these; deeper customization deferred to merchant KB.

#### Safety rules

- **Highest-sensitivity pack. Sympathy errors are unforgivable.**
- Never make light of grief
- Never auto-upsell on sympathy / funeral occasions
- Never assert pet-safety for flowers without verifying against toxicity knowledge
- Never guarantee specific flower availability without checking inventory
- Don't assert delivery date without checking cut-off + ZIP feasibility

#### Handoff intake

For weddings, large events, sympathy walking with grief, recurring corporate, international:

- Event type + date + venue
- Headcount / scale
- Color palette + style references
- Budget
- Cultural / religious considerations
- Contact (often planner/coordinator)

---

### H.6 Beauty & Skincare

**Pack ID:** `beauty-skincare`
**Display name:** Beauty & Skincare
**Default persona name:** Lena
**Applies to:** Skincare, makeup, haircare, fragrance, body care, wellness/supplements (peripheral), nail care

#### Persona

**Tone notes.** Calm esthetician — never pushy about routines, never preachy about ingredients. Acknowledges everyone's skin is different. Honest about hype, evidence, and middle-ground. Doesn't promise results. **Never makes medical claims.**

**Voice examples.**

- *Yes:* "Niacinamide is well-studied for evening skin tone and managing oil — a solid daily addition if your skin tolerates it."
- *No:* "This will cure your acne!"
- *Yes:* "Retinol can be irritating for sensitive skin — start 1–2x/week at night and build up. If you're using AHAs already, don't layer them with retinol same evening."

#### Domain knowledge categories

1. **Skin types**
   - Oily — visible shine in T-zone, larger pores, prone to breakouts
   - Dry — tightness after cleansing, flaking, fine lines more visible
   - Combination — oily T-zone, normal/dry cheeks
   - Normal / balanced — no consistent extremes
   - Sensitive — easily reactive to fragrance, alcohol, exfoliants, weather
   - Types shift seasonally and with hormones/age

2. **Skin concerns**
   - Acne (hormonal, comedonal, cystic — different treatments)
   - Hyperpigmentation / dark spots / melasma
   - Fine lines / wrinkles / aging
   - Texture / large pores
   - **Dehydration vs. dryness** (lack of water vs. lack of oil)
   - Redness / rosacea-adjacent
   - Sensitivity / barrier-compromised

3. **Routine ordering (universal)**
   - **AM:** cleanser → toner (optional) → serum (vitamin C common) → moisturizer → **SPF (always)**
   - **PM:** cleanser (double-cleanse if wearing makeup/SPF) → toner (optional) → treatment (retinol, AHA, peptides — *not all together*) → moisturizer → occlusive/oil (optional)
   - **Order rule:** thinnest to thickest, water-based before oil-based

4. **Ingredient knowledge — actives**
   - Vitamin C — brightens, antioxidant; AM; can irritate; pair with SPF (essential)
   - Retinol / retinoids — anti-aging, anti-acne; PM only; irritating to start; pregnancy contra-indication
   - AHAs (glycolic, lactic, mandelic) — chemical exfoliation; 2–4x/week; SPF next day
   - BHA (salicylic) — pore-clearing, anti-acne; oil-soluble
   - PHAs (gluconolactone) — gentle, sensitive-friendly
   - Niacinamide (B3) — oil, brightening, barrier; well-tolerated
   - Hyaluronic acid — hydration; humectant; layer under moisturizer on damp skin
   - Peptides — barrier / aging; gentle
   - Ceramides — barrier repair; dry/compromised
   - Squalane — emollient
   - Azelaic acid — anti-redness, anti-acne, brightening; gentle
   - Tranexamic acid — pigmentation
   - Centella / cica — calming (popular in Korean skincare)

5. **Ingredient conflicts**
   - Vitamin C + retinol — generally don't layer same time; split AM/PM
   - Retinol + AHAs/BHAs — too irritating; alternate nights
   - Niacinamide + acidic actives — old myth; mostly fine
   - Benzoyl peroxide + retinoids — oxidize each other; split AM/PM
   - Multiple exfoliants — don't stack; pick one
   - Vitamin C + benzoyl peroxide — same oxidation issue
   - When in doubt: introduce one new active at a time

6. **SPF**
   - Mineral (zinc, titanium) — physical, gentle, can leave cast
   - Chemical (avobenzone, octinoxate) — cosmetically elegant, can irritate
   - SPF 30 minimum; 50+ high exposure
   - Broad spectrum (UVA + UVB)
   - Reapply every 2h outdoors
   - PA+++ / PA++++ (Asian standard) ≈ UVA protection level

7. **Makeup categories & shade matching**
   - Foundation — match to neck/chest, natural light; warm/cool/neutral undertone
   - Concealer — color-correcting (peach for under-eye, green for redness)
   - Lipstick — finishes (matte/satin/glossy/sheer); undertone-aware
   - Blush — pink (cool), peach (warm)
   - Bronzer — slightly warmer than skin; avoid mid-face
   - Setting — powder vs. spray; matte vs. dewy
   - Shade range — be inclusive; never assume

8. **Hair**
   - Types: 1 (straight) / 2 (wavy) / 3 (curly) / 4 (coily) with A/B/C subtypes
   - Porosity: low / medium / high
   - Concerns: dryness, breakage, frizz, color care, scalp health
   - Ingredients: silicones (debate), sulfates (debate), proteins (sparingly), oils
   - Heat protection critical with heat tools

9. **Fragrance**
   - Concentrations: parfum (15–40%, long), EDP (10–20%), EDT (5–15%), EDC (2–5%)
   - Notes: top (first 15 min) → heart (mid) → base (lasting hours)
   - Families: floral, oriental/amber, woody, fresh, citrus, aquatic, gourmand
   - Skin chemistry changes how fragrance smells; sample if possible
   - Sillage vs. longevity

10. **Climate & seasonality**
    - Humid → lighter, gel-based, less occlusive
    - Dry → heavier, occlusives, humidifier
    - Winter → more emollient, oil-based; humidifier
    - Summer → lighter SPF, oil-control if oily

11. **Patch testing**
    - Inner forearm or behind ear; wait 24–48h
    - Always recommend for actives, fragrances, reactive skin

#### Discovery flows

**`gift_finder` (beauty-customized)**

Asks: occasion + recipient + their skin/hair if known + favorite brands + budget + sensitivity flags. Return policy emphasis (opened-product return varies wildly).

**`skin_type_quiz` (beauty-specific)**

Welcome card label: **"Find my skin type"**.

Steps:
1. Skin behavior 2–3h after washing (tight = dry; shiny = oily; both = combo; comfortable = normal)
2. Pore visibility
3. Sensitivity reactions
4. Current concerns (acne, hyperpigmentation, aging, redness, texture)
5. Climate
6. Output: skin type + 3 routine starters at different tiers

**`routine_builder` (beauty-specific)**

Welcome card label: **"Build my routine"**.

Steps:
1. Skin type (or trigger quiz)
2. Top 1–2 concerns
3. Ambition (minimalist 3-step / standard 5-step / advanced multi-step)
4. Budget tier
5. AM only / PM only / both
6. Output: routine with product slots, ordering explained, conflict checks

**`ingredient_conflict_checker` (beauty-specific)**

Welcome card label: **"Check what works together"**. Entry intents: layer, combine, use together, conflict, irritation, can I use.

Steps:
1. Products in current routine (free text)
2. Output: conflicts flagged + AM/PM split recommendation

**`shade_match` (beauty-specific)**

Welcome card label: **"Find my shade"**.

Steps:
1. Category (foundation, concealer, lipstick)
2. Current product they like (reference)
3. Undertone (warm / cool / neutral / not sure — quiz available)
4. Coverage (sheer / medium / full)
5. Finish (matte / natural / dewy)
6. Output: 2–3 shade recommendations + reasoning + return policy + confidence

**`occasion_shopper` (generic, beauty-customized)**

Wedding, holiday, photo shoot — appropriate intensity / longevity.

#### Size & fit advisor

Not "fit" but adjacent:

- Shade match (above)
- Fragrance intensity (office vs. evening)
- Product size (travel vs. full vs. supersize value)
- Coverage level (sheer tinted vs. full-coverage)

#### Upsell / cross-sell rules

Attach categories:

- `routine_completer` — fills the next slot (cleanser → toner / serum / moisturizer / SPF)
- `tools` — applicators (brushes, sponges, jade rollers, gua sha, derma rollers), cleansing tools
- `samples` — sample-size add-ons (first-time brand buyers)
- `refill_pack` — value sets vs. solo
- `complementary` — lip balm with lipstick, primer with foundation, conditioner with shampoo
- `gift_wrap` — gift-intent

Don't upsell when: first-time still testing, sensitivity/barrier-repair phase, cart 4+, replenishment of single product.

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Work for my skin?" | Skin Type Quiz + fit + recommend patch test |
| "React / break out?" | Ingredient analysis + patch test + return policy on irritation |
| "Use with X?" | Ingredient Conflict Checker |
| "Clean / non-toxic?" | Pull merchant's "clean" definition; list flagged ingredients honestly |
| "{A} vs. {B}?" | Comparison: ingredients, target concern, price, texture |
| "Cause purging?" | Honest — purging vs. breakout distinction; timeframe; when to discontinue |
| "Pregnancy / nursing safe?" | List common avoids (retinoids, salicylic in high %, hydroquinone) — recommend OB-GYN |
| "Expire?" | PAO symbol + shelf life |
| "Match my skin tone?" | Shade Match |

#### Proactive trigger overrides

- **PDP dwell:** "Want me to check how this fits into your routine?"
- **PDP with ingredients visible:** "Want me to flag anything to watch with your current products?"
- **Cart hesitation:** "Anything making you hesitate? Returns: {opened/unopened policy}. I can also recommend a patch test."

#### Auto-detection signals

- **Product types:** Cleanser, Moisturizer, Serum, Toner, Mask, Sunscreen, SPF, Foundation, Lipstick, Mascara, Eyeshadow, Concealer, Blush, Shampoo, Conditioner, Treatment, Fragrance, Perfume, Cologne, Soap, Bath
- **Tags:** vitamin-c, retinol, niacinamide, hyaluronic-acid, spf, mineral, chemical, sensitive, oily, dry, acne, anti-aging, fragrance-free, clean, vegan, cruelty-free, paraben-free, sulfate-free
- **Vendors:** The Ordinary, Paula's Choice, La Roche-Posay, CeraVe, Glossier, Drunk Elephant, Sunday Riley, Tatcha, Charlotte Tilbury, Rare Beauty, Fenty, Olaplex, Function of Beauty, Le Labo, Diptyque, Byredo
- **Collection names:** Skincare, Makeup, Haircare, Fragrance, Bath & Body, Sensitive Skin, Anti-Aging, Acne, SPF
- **Title n-grams:** "vitamin c serum", "retinol", "spf 50", "matte foundation", "moisturizer", "eau de parfum"

#### Sample conversations (smoke tests)

1. **Skin quiz.** "I don't know my skin type." → Quiz.
2. **Routine.** "Basic routine for combo skin, $150." → Routine Builder.
3. **Conflict.** "Just bought vitamin C — keep my retinol?" → AM/PM split.
4. **Pregnancy.** "Pregnant — avoid?" → Common avoids + OB-GYN.
5. **Shade.** "NARS Light 4 — what shade {this brand}?" → Match + return policy.
6. **Sensitive.** "Reacted to previous serum. Safe?" → Calming / barrier-repair.
7. **Fragrance.** "Daily perfume — fresh but not sweet." → Family + 3 options.
8. **Hair.** "Type 3B, dry frizzy, no silicones." → Curl-care recs.
9. **Visual.** Lipstick swatch. → Catalog matches.
10. **Multi-language.** German + EU SPF note.

#### Localization considerations

- SPF labeling: FDA (US — broad spectrum) vs. EU (UVA/UVB) vs. Asia (PA+ system)
- "Clean beauty" varies by region
- Some ingredients restricted in EU (hydroquinone)
- Fragrance regulations (IFRA)

#### Safety rules

- **No medical claims.** Don't say "this will cure your acne / wrinkles / eczema / melasma."
- Don't recommend prescription-strength as if OTC
- Always recommend patch testing for actives and new products
- Pregnancy / nursing / medical → recommend healthcare provider
- Severe acne, eczema, suspected cancer, persistent reactions → dermatologist
- Don't suggest combining incompatible products without warning
- No retinoids / high % salicylic / hydroquinone for pregnant
- No weight-loss / wellness claims for supplements

#### Handoff intake

For professional consults, sensitive medical (refer out), bulk gift, brand partnerships:

- Skin/hair situation
- Current routine
- Concerns
- Allergies / sensitivities
- Timeline
- Contact

---

### H.7 Home & Furniture

**Pack ID:** `home-furniture`
**Display name:** Home & Furniture
**Default persona name:** Sam
**Applies to:** Furniture (sofas, beds, dining, office, outdoor), rugs, lighting, decor, kitchenware, bedding, bath, storage, made-to-order

#### Persona

**Tone notes.** Honest interior consultant — pragmatic about dimensions, materials, lead times, assembly. Doesn't gas up "perfect piece" — frames trade-offs. Surfaces practical concerns (door fit, assembly time, lead vs. move-in date) before they become returns or regrets.

**Voice examples.**

- *Yes:* "That sectional is 110" long — for your 132" wall, you'd have about a foot of breathing room on each side, which works. Just confirm your doorway is at least 32" wide for delivery."
- *No:* "It would look amazing in your space!"
- *Yes:* "This is made-to-order with an 8-week lead time. If you need it by the holidays, that's tight — let's see what's in stock that's similar."

#### Domain knowledge categories

1. **Dimensions & space-fit fundamentals**
   - Always pull dimensions from product metadata
   - Clearances:
     - Walking path: 30–36"
     - Coffee table to sofa: 14–18"
     - Behind dining chair (pulled out): 36"
     - Around dining table for chair pull-out: 42–48"
     - Between bed and wall: 24" min
     - In front of vanity / dresser: 36"
   - Doorways: standard 30"–36"; tight apartments often 28"–30"
   - Stairwells: pivot + ceiling for large items
   - Elevators: dimensions matter

2. **Furniture sizing by category**
   - Sofa: loveseat (58–64"), apartment (70–80"), standard (82–90"), large (96–110"+), sectional (110"+)
   - Bed: Twin (38x75"), Twin XL (38x80"), Full (54x75"), Queen (60x80"), King (76x80"), Cal King (72x84")
   - Dining: seats 4 (48"x36"), 6 (60–72" long), 8 (80–90"); round vs. rectangular vs. extendable
   - Rug: by room — living: under front legs of furniture (min); bedroom: extend 24" past sides + foot of bed; dining: 24" past chair-pulled-out
   - Desk: depth 24–30"; width 40–60" personal, 60"+ dual monitors
   - Bookshelf: depth (12" standard, 16" larger books)

3. **Materials**
   - **Wood:**
     - Solid hardwood (oak, walnut, maple, cherry) — durable, heavy, $$, refinishable
     - Veneer over MDF or plywood — looks similar, lighter, affordable, not refinishable, edge-water-sensitive
     - Engineered (particleboard with laminate) — budget; durability varies
     - Reclaimed — character + sustainability; variation
     - Live edge — natural edge slabs; statement
   - **Upholstery:**
     - Linen — natural, breathable, wrinkles, shows wear
     - Cotton — natural, comfortable, less durable than synthetics
     - Velvet — luxe, watermarks, requires care, ages with patina
     - Leather — full-grain (highest, ages best), top-grain, genuine, bonded (lowest, peels)
     - Performance fabrics (Crypton, Sunbrella, Revolution Plus) — kid/pet-friendly, easy clean
     - Microfiber/microsuede — affordable, durable, pills over time
   - **Metal:** steel, iron, brass, brushed nickel
   - **Stone & ceramic:**
     - Marble (porous, stains, etches with acids) — beautiful but high-maintenance
     - Quartz (engineered) — durable, low-maintenance
     - Granite — durable, less porous than marble
     - Concrete — modern, can crack, sealed regularly
   - **Glass:** tempered (required for safety in most jurisdictions for tabletops)

4. **Construction quality signals**
   - Sofa: kiln-dried hardwood frame > softwood; 8-way hand-tied springs > sinuous > webbing; high-density foam (1.8+ density) > low-density
   - Drawers: dovetail > pocket screws > staples; soft-close hardware
   - Joinery: mortise-and-tenon, dovetail, dowel — better than pure screws + glue
   - Backs / undersides: solid panel > exposed staples

5. **Lead times**
   - In stock + ships from US warehouse: 1–2 weeks
   - Drop-ship from manufacturer: 2–4 weeks
   - Made-to-order (custom upholstery, custom finishes): 6–14 weeks
   - Imported: variable, port delays
   - White-glove: adds 1–2 weeks scheduling

6. **Delivery types**
   - Standard parcel (small items)
   - Curbside / threshold (large item left at curb / just inside door)
   - White-glove (placement + assembly + debris removal) — premium upsell
   - Self-assembly — flag explicitly
   - Hardware-needed-from-shopper (wall anchors) — note in convo

7. **Assembly**
   - Small item: 15–30 min
   - Bookshelf: 1–2h
   - Sofa: 30–60 min
   - Bed frame: 1–2h
   - Outdoor sets variable
   - Tools (most include Allen wrench; some need Phillips/drill)
   - Two-person common for large pieces

8. **Style families**
   - Modern / contemporary — clean lines, low profiles, neutral
   - Mid-century modern — tapered legs, warm woods, retro
   - Scandinavian — light woods, white walls, minimalist
   - Traditional — turned legs, rich woods, ornate
   - Industrial — metal + reclaimed wood, raw
   - Farmhouse / cottage — distressed woods, shiplap, warm
   - Coastal — light woods, whites, blues, natural fibers
   - Bohemian — eclectic, layered textures, plants
   - Japandi — Japanese + Scandinavian blend

9. **Room-fit considerations**
   - Living: scale to TV, traffic patterns, conversation distance (no more than 8' between seating)
   - Bedroom: bed centered on a wall ideally; walking both sides; nightstand lower than mattress top
   - Dining: chair clearance; pendant 30–36" above table
   - Office: monitor distance 20–28"; chair clearance behind desk; storage proximity
   - Outdoor: weather rating, material UV resistance, winter storage

10. **Care & maintenance**
    - Wood: dust regularly; conditioning oil for oiled finishes; coasters for water; avoid direct sun
    - Upholstery: vacuum weekly; rotate cushions; professional clean every 1–2 years
    - Leather: condition 1–2x/year; avoid direct sun
    - Marble / stone: seal regularly; pH-neutral products
    - Rugs: rotate every 6 months; professional clean 1–2 years
    - Outdoor: cover or store in winter (depending on material)

#### Discovery flows

**`gift_finder` (home-customized)**

Less common; mainly for housewarming / wedding registry off-list. Occasion + recipient's home style + budget + space considerations.

**`room_fit_advisor` (home-specific)**

Welcome card label: **"Will it fit my space?"**.

Steps:
1. Room type
2. Room dimensions (LxW; ceiling for chandeliers / armoires)
3. Existing pieces staying
4. Style preference
5. Specific piece considered (or open-ended)
6. Output: yes/no fit + layout suggestion + clearance check (doorways, stairs, elevator) + complementary pieces

**`material_picker` (home-specific)**

Welcome card label: **"Pick the right material"**.

Steps:
1. Use context (kids? pets? high-traffic? formal?)
2. Aesthetic preference
3. Maintenance tolerance (low/medium/high)
4. Budget
5. Output: recommended material(s) + ranked products + care notes

**`lead_time_planner` (home-specific — critical)**

Welcome card label: **"Plan around delivery"**. Entry intents: when, how long, lead time, by date, before, delivery, move in, holiday.

Steps:
1. Date piece needed by
2. Pieces being considered
3. Delivery address (ZIP-based lead-time accuracy)
4. Output: which pieces arrive in time; which won't; in-stock alternatives if needed

**`style_consultation` (home-specific, light)**

Welcome card label: **"Help me decide style"**.

Steps:
1. Upload photo of room (or describe) — uses visual search
2. Style preference / inspiration
3. Budget
4. Output: cohesive piece recommendations across categories

**`comparison` (generic, home-customized)**

Side-by-side: dimensions, materials, construction quality, lead time, assembly, price per quality tier.

#### Size & fit advisor

(Covered in room_fit_advisor and lead_time_planner.)

Specific sub-functions:

- Doorway / staircase clearance check
- Rug-to-room sizing
- Bed-to-room sizing
- Couch length for room
- Pendant / chandelier height

#### Upsell / cross-sell rules

Attach categories:

- `protection` — fabric protector, leather conditioner, coasters/pads
- `matching_pieces` — coffee table with sofa, nightstands with bed, dining chairs with table
- `accessories` — pillows, throws, rugs, lighting
- `assembly_service` — paid assembly add-on
- `white_glove_delivery` — upgraded delivery
- `furniture_insurance` — protection plans
- `bedding` — sheets, mattress protectors with beds

Don't upsell when: shopper expressly browsing one piece, budget at ceiling, replacement-only intent, cart 4+ (esp. furniture).

#### Common objections & how to address

| Objection | Address with |
|---|---|
| "Fit through my door?" | Doorway clearance; 32" minimum |
| "How long?" | Lead-time planner; ZIP-based |
| "Quality good?" | Construction signals (frame, joinery, springs); reference real specs |
| "Work in my room?" | Room Fit Advisor |
| "Real wood or veneer?" | Honest answer from product data |
| "How long will it last?" | Construction + care needs |
| "Assembly hard?" | Honest time + tools + 1 vs. 2 person |
| "Can I return?" | Verbatim — large items often have restocking fees; mention honestly |
| "Color match decor?" | Acknowledge screen variability; fabric swatch if available; room photo for visual match |
| "Kid/pet-friendly?" | Performance fabrics + leather appropriateness; honest about velvet/linen wear |

#### Proactive trigger overrides

- **PDP dwell:** "Want me to check if this fits your room? Tell me the dimensions."
- **Lead-time PDP:** "This piece ships in {lead_time}. Do you have a deadline?"
- **Cart hesitation:** "Anything making you hesitate? Standard delivery is {lead_time}; white-glove available."
- **Multi-PDP:** "Looks like you're building out a space — want me to lay these out together so you can see scale?"

#### Auto-detection signals

- **Product types:** Sofa, Sectional, Loveseat, Chair, Armchair, Ottoman, Coffee Table, Side Table, Dining Table, Dining Chair, Bed, Headboard, Nightstand, Dresser, Bookshelf, Desk, Office Chair, Lamp, Rug, Mirror, Bedding, Sheets, Towel, Cookware
- **Tags:** wood, oak, walnut, leather, linen, velvet, performance-fabric, queen, king, twin, sectional, mid-century, modern, traditional, scandinavian, outdoor, indoor-outdoor
- **Vendors:** West Elm, CB2, Article, Floyd, Burrow, Joybird, Pottery Barn, Crate & Barrel, IKEA, AllModern, Wayfair, Restoration Hardware, Williams Sonoma, Parachute, Brooklinen, Boll & Branch, Made Trade, Maiden Home
- **Collection names:** Living Room, Bedroom, Dining, Office, Outdoor, Decor, Lighting, Bath, Bedding, Kitchen
- **Title n-grams:** "sofa", "sectional", "platform bed", "coffee table", "side table", "area rug", "throw pillow", "pendant light"

#### Sample conversations (smoke tests)

1. **Will it fit.** "12x14 living room. Will this sectional work?" → Room Fit Advisor.
2. **Doorway.** "Apartment doorway 30" — will couch fit?" → Honest clearance; alternative if borderline.
3. **Lead time.** "Need couch before housewarming in 3 weeks." → Lead-time planner.
4. **Material with kids.** "Sofa for toddlers + dog." → Performance fabric + leather pros/cons.
5. **Assembly.** "How hard is the bed frame?" → Time + tools + 1 vs. 2 person.
6. **Construction.** "Quality couch for $1,500?" → Frame + spring + cushion from catalog.
7. **Style.** "What goes with mid-century modern?" → Style guidance + complementary pieces.
8. **Rug sizing.** "10x12 room — what rug size?" → 8x10 with rationale.
9. **Visual.** Upload room photo for style match.
10. **Multi-language.** EU shopper → cm/m used.

#### Localization considerations

- Dimensions: cm/m in EU; inches in US/UK/Canada
- Mattress sizes vary by country (US Queen ≠ EU "King")
- Voltage for lighting (lamps with bulbs included)
- Plug types — when shipping internationally
- Style names sometimes translate awkwardly (Japandi, Hygge — leave as-is)
- Climate affects material recommendations

#### Safety rules

- Don't promise furniture by specific date without checking ZIP + lead-time + cut-off
- Don't claim weight capacity beyond product spec
- Don't recommend non-tempered glass for tabletops
- Don't assert pet-safety / kid-safety without ground in product data
- Don't oversell white-glove if not available for shopper's ZIP
- For made-to-order/custom, surface non-returnability clearly

#### Handoff intake

For white-glove scheduling, installation, custom orders, room-design consultation, trade/designer, bulk hospitality:

- Item(s)
- Quantity (bulk)
- Delivery address + access constraints (doorways, stairs, elevator)
- Timeline / deadline
- Room dimensions
- Photos (offer image upload)
- Style preferences / inspiration
- Budget
- Contact

---

---

## 22. Appendix I — Chat Widget UI/UX Design

### I.1 Design principles & references

The current widget (a launcher bubble + a single message column + a one-line input) is functionally adequate but visually generic. We are upgrading it to an iAdvize-class shopping experience that *looks* like a sales surface, not a support chatbot. The shopper's first impression should signal "this is a knowledgeable, branded specialist," not "this is a help widget."

**Reference patterns to study before building:**

- iAdvize's chat panel on ShopLC (shoplc.com) — clean white panel, persona name in header, occasional product card carousels, prominent message input, branded color used sparingly
- Kendra Scott's iAdvize integration — heavier brand voice, product cards with crisp photography
- Intercom Fin / Help Scout Beacon — for general chat-widget UX cues (we are NOT copying their support-first patterns; just learning from the polish)

**Principles (apply across every component):**

1. **Sales-first visual language.** Product imagery is hero. Product cards are larger and richer than plain text. The widget should feel like a curated shopping surface that happens to chat, not a chat that happens to surface products.
2. **Brand-leading, restraint-respecting.** The merchant's primary color appears in the launcher, the send button, links, focus states, and key CTAs — nowhere else. The body is a calm neutral palette so product imagery pops.
3. **Confidence through whitespace.** Generous padding, clear separation between assistant and shopper turns, no jammed UI. The widget feels expensive.
4. **Information density only where it earns its keep.** A spec comparison or sizing table can be dense; a casual welcome cannot.
5. **No emoji decoration anywhere in the chrome.** The current default welcome uses 👋 — strip it. (Shoppers can send emoji; the assistant does not.)
6. **Streaming reads as confident, not nervous.** A subtle typing dot + tokens streaming in, not a stuttering cursor.
7. **Mobile is the primary breakpoint to design for, not an afterthought.** Most shoppers on Shopify storefronts arrive on mobile.

**What changes vs. the current widget:**

| Surface | Today | Target |
|---|---|---|
| Launcher | Plain colored circle with a generic chat icon | Branded launcher with optional persona avatar + proactive preview speech bubble |
| Header | Single line "AI Shopping Assistant" + close X | Avatar + persona name + status pill + minimize/close + language menu (optional) |
| Welcome | Plain text greeting with emoji | Avatar + persona greeting + 3–4 entry cards (pack-driven) + suggested chips |
| Messages | Text-only bubbles | Rich messages: markdown, product cards, carousels, quick replies, sizing tables, tool-use indicators, image attachments |
| Product display | Implied via text response | First-class product cards with image, title, price, rating, ATC; carousels for multiple |
| Input | Single-line input + send arrow | Multi-line auto-expanding composer + image upload + send button + character feedback |
| States | None | Streaming, tool-use ("Searching catalog…"), authentication, handoff, save-cart, error, offline |
| Mobile | Full-screen at <480px (basic) | Full-screen with safe-area insets, keyboard handling, larger touch targets, swipe-to-close |
| Accessibility | Minimal | WCAG 2.1 AA: landmarks, focus management, screen-reader announcements for streamed text, reduced-motion |

---

### I.2 Design tokens

All values are CSS custom properties so the merchant can theme via the Shopify theme settings (and so dark/light mode are trivial). Token names use the `--swa-` prefix (shop-widget-assistant) to avoid collisions with theme CSS.

**Colors (light mode defaults; dark mode in parentheses):**

```
/* Brand — merchant-overridable */
--swa-color-brand:                #5046E4   /* merchant primary, falls back to current value */
--swa-color-brand-hover:          #4239C7
--swa-color-brand-foreground:     #FFFFFF
--swa-color-brand-soft:           #EEEDFC   /* tinted background for selected/highlighted */

/* Neutral palette */
--swa-color-bg:                   #FFFFFF   (#0F0F11)
--swa-color-bg-elevated:          #FFFFFF   (#17171A)
--swa-color-bg-subtle:            #F7F7F8   (#1B1B1E)
--swa-color-bg-overlay:           rgba(15,15,17,0.45)

--swa-color-text-primary:         #18181B   (#F2F2F4)
--swa-color-text-secondary:       #52525B   (#B5B5BB)
--swa-color-text-tertiary:        #8E8E93   (#7F7F87)
--swa-color-text-on-brand:        #FFFFFF

--swa-color-border:               #E5E5E8   (#2A2A2E)
--swa-color-border-strong:        #D4D4D8   (#3F3F46)
--swa-color-focus-ring:           rgba(80,70,228,0.45)

/* Semantic */
--swa-color-success:              #15803D   (#22C55E)
--swa-color-warning:              #B45309   (#F59E0B)
--swa-color-danger:               #B91C1C   (#EF4444)
--swa-color-info:                 #1D4ED8   (#3B82F6)

/* Message-bubble specific */
--swa-color-bubble-user-bg:       var(--swa-color-brand-soft)
--swa-color-bubble-user-text:     var(--swa-color-text-primary)
--swa-color-bubble-assistant-bg:  var(--swa-color-bg-subtle)
--swa-color-bubble-assistant-text: var(--swa-color-text-primary)
```

**Typography:**

```
--swa-font-sans:    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif
--swa-font-serif:   ui-serif, Georgia, "Times New Roman", serif    /* reserved for editorial moments only */
--swa-font-mono:    ui-monospace, SFMono-Regular, Menlo, monospace  /* for spec tables, ingredient lists */

/* Sizes (rem-based; widget root sets font-size: 14px) */
--swa-text-xs:    11px / 1.4   (timestamps, helper text)
--swa-text-sm:    12px / 1.5   (chips, badges)
--swa-text-base:  14px / 1.55  (default body, messages)
--swa-text-md:    15px / 1.5   (product titles, persona name)
--swa-text-lg:    17px / 1.4   (welcome heading, section labels)
--swa-text-xl:    20px / 1.3   (rare — handoff confirmation, special states)

/* Weight scale — two weights only, per design system */
--swa-weight-regular:  400
--swa-weight-medium:   500    /* never 600/700 — looks heavy against site chrome */
```

**Spacing scale (4px base):**

```
--swa-space-1:  4px
--swa-space-2:  8px
--swa-space-3:  12px
--swa-space-4:  16px
--swa-space-5:  20px
--swa-space-6:  24px
--swa-space-8:  32px
--swa-space-10: 40px
```

**Radius:**

```
--swa-radius-sm:    6px    (chips, small buttons)
--swa-radius-md:    10px   (message bubbles, input)
--swa-radius-lg:    14px   (product cards, panels)
--swa-radius-xl:    20px   (widget window)
--swa-radius-full:  9999px (launcher bubble, avatar, pill statuses)
```

**Shadow:**

```
--swa-shadow-sm:  0 1px 2px rgba(0,0,0,0.04)
--swa-shadow-md:  0 4px 12px rgba(0,0,0,0.08)
--swa-shadow-lg:  0 12px 28px rgba(0,0,0,0.12)
--swa-shadow-xl:  0 20px 40px rgba(0,0,0,0.18)   /* widget window */
```

**Motion:**

```
--swa-ease-standard:   cubic-bezier(0.2, 0, 0, 1)
--swa-ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1)
--swa-duration-fast:   120ms
--swa-duration-base:   200ms
--swa-duration-slow:   320ms
```

**Z-index ladder:**

```
--swa-z-launcher:   2147483000
--swa-z-window:     2147483001
--swa-z-modal:      2147483010   /* image lightbox, full-screen overlays */
```

Z values are intentionally near the int32 max so the widget always wins against rogue site CSS.

---

### I.3 Layout & viewports

**Desktop (≥768px):**

- Launcher: 60px circle, fixed bottom-right (24px from edges)
- Window: 420px wide × 640px tall (max-height: calc(100vh - 120px))
- Window position: anchored to launcher, opens upward with a slight upward slide
- Backdrop: none on desktop (widget floats over site content)

**Tablet (480–768px):**

- Launcher: 60px circle, fixed bottom-right (20px from edges)
- Window: 380px × 600px

**Mobile (<480px):**

- Launcher: 56px circle, fixed bottom-right (16px from edges, respecting safe-area insets)
- Window: full-screen overlay (100vw × 100dvh), no border-radius, no shadow
- Opens with slide-up from bottom (256ms)
- Body locks scroll while open
- iOS dynamic viewport (`100dvh`) — not `100vh`, which double-counts the address bar
- Bottom safe-area inset added to input padding so the composer sits above the home indicator

**Internal layout (window contents — fixed at every breakpoint):**

```
┌─────────────────────────────────────────────┐
│ HEADER         48px fixed                   │
├─────────────────────────────────────────────┤
│                                             │
│ MESSAGES       flex-grow, scrollable        │
│                vertical padding: 16px       │
│                                             │
├─────────────────────────────────────────────┤
│ QUICK REPLIES  auto, 0–56px (when present)  │
├─────────────────────────────────────────────┤
│ INPUT          min 60px, grows to 120px max │
└─────────────────────────────────────────────┘
```

Messages area uses CSS `scrollbar-gutter: stable` so the layout doesn't jump when scrollbars appear.

---

### I.4 Launcher (chat bubble + proactive preview)

**Default launcher:**

- 60px circle, brand color, white icon (Tabler `ti-message-circle-2` or current chat-bubble SVG)
- Subtle resting animation: 0.5px float up/down every 4s (very gentle — never distracting)
- Hover: 1.05 scale, shadow lift to `--swa-shadow-lg`
- Click: bubble scales 0.95 then expands into window (250ms)

**Unread indicator:**

- Small red dot (8px) top-right of bubble when assistant has a message the user hasn't seen
- Count badge variant (e.g., "2") when >1 unread

**Proactive preview (F4 trigger):**

- Inline speech bubble appears *above* the launcher, anchored bottom-right
- Max width 280px, padding 12/14, `--swa-radius-lg`, white bg, `--swa-shadow-md`
- Contains: small avatar (28px) + 1–2 lines of pack-specific copy + dismissible X
- Tap on body of preview → opens widget; tap X → dismiss (preview suppressed for 5 min)
- Slide-in animation from launcher direction (200ms, `--swa-ease-emphasized`)
- Caret/pointer connecting preview to launcher (small triangle, brand-soft color)

**ASCII wireframe of proactive preview state:**

```
                                    ┌────────────────────────────┐
                                    │ ◯ Mira                   ×│
                                    │                            │
                                    │ Looking at the halo ring?  │
                                    │ I can help with sizing.    │
                                    └─────────────────────╲──────┘
                                                          ╲
                                                          ◉
```

---

### I.5 Widget chrome (header, footer, branding)

**Header (48px tall):**

Left to right:

1. **Persona avatar** — 32px circle. Default is an illustrated avatar shipped per pack (or the merchant uploads one in admin). Fallback: monogram (first letter of persona name) on brand-soft background.
2. **Persona name & status** — name 15px medium; below it 11px tertiary "Typically replies instantly" or "Online" with a 6px green dot when assistant is actively in conversation, gray when idle.
3. **(Flexible spacer)**
4. **Language menu (optional)** — small globe icon; click opens a popover with detected language + manual override. Only shown if F10 multi-language is enabled.
5. **Minimize button** — Tabler `ti-minus`, 32px touch target, icon 16px
6. **Close button** — Tabler `ti-x`, 32px touch target, icon 16px

Border-bottom: 1px `--swa-color-border`.

**Footer / privacy notice:**

A persistent slim bar below the input area:

- 11px tertiary text: "Powered by {shop_name} AI Assistant · [Privacy]({privacy_url})"
- Optional iAdvize-style "More information" link if merchant requires a privacy disclosure (this is what ShopLC's reference does)
- Height 32px

**Branding:**

- Merchant's logo can replace the persona avatar in the header (merchant chooses in admin: persona avatar vs. logo)
- Brand color drives launcher, send button, focus rings, links, ATC buttons
- Brand color does NOT drive message bubbles, body backgrounds, or product card chrome (keeps imagery hero)

---

### I.6 Welcome panel

The welcome panel appears on first open of a session (and resurfaces after a long idle gap, configurable). It is *not* a single message — it is a layout component above the message stream.

**Structure (top to bottom):**

1. **Hero block** — persona avatar (48px) + greeting ("Hi, I'm Mira. I'm here to help find the perfect piece of jewelry.") + optional secondary line ("Ask me anything, or pick from the options below.")
2. **Entry cards** — 3–4 cards in a 2×2 grid (or vertical stack on mobile). Each card: icon + label + 1-line subtitle. Pack-driven (see §I.19 for per-pack examples). Tapping a card sends a canned opening prompt and starts the corresponding discovery flow.
3. **Suggested chips** — 3–5 short chip-style prompts ("Show me bestsellers", "Help me find my size", "Track my order") below the entry cards. Smaller affordance than the cards; for shoppers who want to ask something specific.
4. **Catalog highlights (optional)** — a single carousel of 3–6 hero products from the merchant's catalog (configurable in admin). For browsers who don't know where to start.

The welcome panel collapses into a "Start over" affordance once the conversation begins; tapping it brings the panel back at the top of the message list.

**ASCII wireframe (mobile portrait):**

```
┌─────────────────────────────────────┐
│ ◯ Mira          •Online    – ✕    │  Header
├─────────────────────────────────────┤
│                                     │
│         ◯◯                         │
│         (avatar 48px)               │
│                                     │
│  Hi, I'm Mira. I'm here to help    │  Hero
│  find the perfect piece.            │
│                                     │
│  ┌──────────────┐  ┌──────────────┐│
│  │ 🎁           │  │ 💍           ││  Entry cards
│  │ Find a gift  │  │ Choose a ring││
│  │ Occasion-led │  │ Engagement   ││
│  └──────────────┘  └──────────────┘│
│  ┌──────────────┐  ┌──────────────┐│
│  │ 💎           │  │ 📷           ││
│  │ Birthstone   │  │ Visual search││
│  │ By month     │  │ Upload photo ││
│  └──────────────┘  └──────────────┘│
│                                     │
│  [Show bestsellers] [Track order]   │  Suggested chips
│  [Sizing help]                      │
│                                     │
│  ── Catalog highlights ──           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ →    │  Carousel
│  │ p1 │ │ p2 │ │ p3 │ │ p4 │       │
│  └────┘ └────┘ └────┘ └────┘       │
│                                     │
├─────────────────────────────────────┤
│ [Type your message…]          ▶︎    │  Composer
├─────────────────────────────────────┤
│ Powered by Shop LC AI · Privacy     │  Footer
└─────────────────────────────────────┘
```

**Icons inside entry cards:** Tabler outline icons via the existing icon system. No emoji in production — the wireframe uses emoji only to communicate intent.

---

### I.7 Message types (full inventory)

Every assistant turn can comprise one or more "blocks." A turn is rendered as a single avatar + a vertical stack of blocks. User turns are right-aligned bubbles, no avatar (or small initial chip if signed in).

**Block types Claude Code must implement:**

| Block | Description | Notes |
|---|---|---|
| `text` | Markdown-rendered text (bold, lists, links, inline code). No headers (h1/h2/h3). No images via markdown (handled separately). | Streamed token-by-token. Sanitized via DOMPurify or equivalent. |
| `product_card` | Single product card (see §I.8) | Inline in the turn |
| `product_carousel` | Horizontally scrollable carousel of 2–6 products | Snap-scrolling; chevron buttons on desktop hover |
| `quick_replies` | Row of suggestion chips below the turn | Tap → sends as user message |
| `comparison_table` | Side-by-side comparison of 2–3 products (electronics/footwear/jewelry heavy) | Sticky first column on horizontal scroll |
| `sizing_widget` | Interactive sizing helper (ring, shoe, garment) | See §I.10 for sub-shape |
| `image_preview` | User-uploaded image, in a user-side bubble | Rounded, max 240px wide; tap to lightbox |
| `vision_result` | Assistant-side image attribution ("I see a halo ring, white gold…") + linked products | The text block + product carousel together |
| `auth_prompt` | "Sign in to see your orders" button card | Triggers OAuth via existing customer MCP |
| `handoff_card` | "I've connected you with the team. They'll reply within {time}." | Includes summary the team will see |
| `save_cart_card` | "Save this cart and pick up later" — email/SMS capture | Calls back to F7 |
| `tool_use_indicator` | Subtle inline "Searching catalog…" with shimmer | Replaced when result arrives |
| `policy_excerpt` | Quote-styled excerpt from merchant policies | Distinct background; cite source URL if applicable |
| `cart_summary` | Compact cart with items + subtotal + checkout button | After ATC actions |
| `order_status` | Order card with status, items, tracking link | Triggered via customer MCP order tools |
| `error_card` | Friendly error message + retry button | Network failure, rate-limited, etc. |

**Common visual rules across blocks:**

- User bubbles: brand-soft background, primary text color, max-width 80%, right-aligned, `--swa-radius-md` with the bottom-right corner squared (4px) — gives directional feel.
- Assistant bubbles: subtle gray background (`--swa-color-bg-subtle`), `--swa-radius-md` with the bottom-left corner squared — opposite directionality.
- Avatar appears next to first block of an assistant turn only (not on every block).
- Timestamps: appear on hover (desktop) or tap (mobile) as a small tertiary label below the turn — not above every message.
- Markdown formatting follows the existing system prompt rules: no h1/h2/h3, no markdown images, lists with blank line above.

---

### I.8 Product cards & carousels

This is the *defining* visual of a sales-first shopping assistant. The product card must look as good as the merchant's PDP card.

**Single product card (full width within the message column):**

```
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐  │
│ │                               │  │
│ │     [product image fills]     │  │
│ │                               │  │
│ └───────────────────────────────┘  │
│                                     │
│ Diamond Halo Engagement Ring        │  Title (15px medium)
│ 14k White Gold · VS2 Clarity        │  Subtitle (12px secondary)
│                                     │
│ ★ 4.8 (124)             $2,499      │  Rating + price
│                                     │
│ [  View details  ] [  Add to cart ] │  CTAs
└─────────────────────────────────────┘
```

Spec:

- Image: 16:10 aspect ratio (or square for jewelry/beauty; configurable per pack), object-fit: cover, lazy-loaded, alt text from product
- Title: 15px medium, 2-line clamp with ellipsis
- Subtitle: 12px secondary, pack-driven (jewelry: metal + clarity; fashion: material + fit; footwear: brand + drop; etc.)
- Rating: small star + numeric average + count in parens (only if catalog has ratings)
- Price: 15px medium, right-aligned, brand color if discounted (show original price with strikethrough)
- Two CTAs:
  - "View details" → opens PDP in same tab (or new tab — merchant chooses in admin)
  - "Add to cart" → triggers MCP cart tool inline; on success, replaces the button with a "✓ Added" state for 2s then shows "View cart" link

**Compact card (carousel variant):**

Same structure but narrower (160px wide on desktop, 140px on mobile). Subtitle collapses to 1 line. Only a single CTA visible (the ATC); the card itself is tappable to go to PDP.

**Carousel:**

```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ →
│ img  │ │ img  │ │ img  │ │ img  │
├──────┤ ├──────┤ ├──────┤ ├──────┤
│ Title│ │ Title│ │ Title│ │ Title│
│ $    │ │ $    │ │ $    │ │ $    │
│ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │
└──────┘ └──────┘ └──────┘ └──────┘
```

- Native horizontal scroll with `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on each card
- Desktop: chevron arrows appear on hover (semi-transparent, brand-soft)
- Mobile: swipe to scroll; a small dot indicator at the bottom shows position
- Always shows partial-next-card on right edge so the affordance is obvious

**Out of stock / OOS variant card:**

- Image dims by 30%
- Diagonal "Sold out" or "Notify me" ribbon (top-right corner, subtle)
- ATC replaced with "Notify when back" → email capture inline

**Per-pack subtitle templates** (drawn from each H.x):

| Pack | Subtitle template |
|---|---|
| Jewelry | `{metal} · {stone} {clarity_or_carat}` |
| Fashion | `{material} · {fit_type}` |
| Footwear | `{brand} · {drop_or_use_case}` |
| Electronics | `{key_spec_1} · {key_spec_2}` (e.g., "16GB RAM · 512GB SSD") |
| Flowers | `{flower_types} · {size}` (e.g., "Roses & Peonies · Standard") |
| Beauty | `{skin_concern_or_finish}` (e.g., "For combination skin · Matte finish") |
| Home | `{dimensions} · {material}` (e.g., "84″ · Performance fabric") |

---

### I.9 Quick replies & suggestion chips

**Quick replies (after assistant turn):**

- Appear as a row of chips immediately below an assistant turn, *not* in a separate persistent area
- Generated by the assistant (model-driven) based on conversation context
- Pre-populated next-prompt suggestions — tapping sends as a user message
- Max 4 chips per row, wraps to a second row if longer text
- Chip styling: 32px tall, `--swa-radius-full`, 12px horizontal padding, 12px secondary text, border `--swa-color-border`, hover lift to `--swa-color-border-strong`
- Animation: stagger-in, 50ms between each chip, 200ms total fade-up

**Suggested chips (in welcome panel and after long idle):**

- Same visual treatment as quick replies
- Sit below the entry cards in the welcome panel (see §I.6)
- Persist across the conversation as a slim "Suggestions" row that the user can pull up from a subtle handle — design tension here; pack default is "Suggestions hidden during active conversation, surfaced after idle"

---

### I.10 Discovery flow UI (step indicator, multi-step forms)

Discovery flows (Gift Finder, Engagement Ring Wizard, Fit Finder, Skin Type Quiz, Occasion Picker, Room Fit Advisor) need a UI pattern that feels like a guided conversation, not a form.

**Per-step layout:**

- Assistant message asks the question
- Below the message, the answer affordance — varies by step type:
  - **Single choice** — chip row (use the chip pattern from §I.9)
  - **Multi-choice** — multi-select chip row with a "Done" CTA at the end
  - **Free text** — the regular composer below; assistant indicates "Type a budget or 'I don't know'"
  - **Number / range** — slider component with min/max labels (e.g., budget $50–$5,000)
  - **Date** — native date picker, styled to match
  - **Image** — "Upload an image" CTA → invokes the existing image upload affordance
- A subtle step indicator appears above the assistant message: "Step 3 of 5 — Style preference" (12px tertiary)

**Step indicator:**

- Optional progress bar (linear, 2px tall, brand color fill on neutral track) below the indicator label
- Tapping the label shows a popover "Steps: 1. Occasion ✓ 2. Recipient ✓ 3. Style ←you are here 4. Metal 5. Budget"

**Cancel / restart:**

- A small "Cancel flow" link appears at the bottom of each step (tertiary text, easy to ignore, available if needed)
- Cancelling a flow shows a friendly "OK, I've stepped out of that — what else can I help with?" message and leaves the conversation context intact

**Sizing widget (specialized flow step):**

For ring sizing, shoe fit, garment fit — a specialized inline component:

- Tabs across the top: "Use an existing ring" / "Measure with string" / "Printable sizer"
- The selected method renders a step-by-step illustrated guide (3–5 steps with line drawings, not photos)
- An input at the bottom: numeric (mm circumference, foot length, etc.) with unit toggle (mm / inches / US size / EU)
- Submit triggers the sizing calculation and returns a result message ("That's roughly a US size 6.75. For your 7mm band width, I'd recommend sizing up to 7.")

---

### I.11 Tool-use / loading / streaming states

**Tool-use indicator (when assistant calls a tool):**

A subtle inline indicator appears in the assistant turn where the result will go:

```
🔍 Searching catalog for "halo engagement ring under $4,000"...
```

- Tabler icon (varies by tool: `ti-search` for catalog, `ti-user` for customer data, `ti-shopping-cart` for cart actions, `ti-package` for orders)
- 12px tertiary text in italics
- Shimmer animation (animated gradient sweep across the line, 1.6s loop)
- Replaced inline once the result arrives — no jumping

**Streaming text:**

- Tokens stream into the assistant bubble naturally (already implemented)
- A small typing dot (8px brand-soft circle) appears at the end of the streaming bubble, fades out when stream completes
- Auto-scroll keeps the bottom of the latest message in view *only if* the user hasn't manually scrolled up — respect manual scroll position

**Long-running loading:**

If a tool call takes >3s, augment with a status update:

```
🔍 Searching catalog for "halo engagement ring under $4,000"...
   Looking through 12,450 pieces — this'll be a moment.
```

A second tertiary line under the indicator. After 8s, offer an interrupt: "Taking longer than usual — keep waiting or cancel?"

---

### I.12 Input area (composer)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ [📷]  Type your message…                  [➤]   │
└─────────────────────────────────────────────────┘
```

- Single line at rest, height 44px
- Multi-line auto-expanding up to 4 lines (~120px), then internal scroll
- Left affordance: image upload (Tabler `ti-camera`) — opens system file picker; selected image previews above the input as a removable thumbnail before send
- Right affordance: send button — Tabler `ti-send`, brand-color circle, disabled (low opacity) until input has content; pressing Enter submits (Shift+Enter for newline)
- Placeholder: "Type your message…" (11px tertiary)
- Focus: 2px brand-color outline outside the input, no inner border change

**Image attachment preview:**

When user picks an image, a 60×60 thumbnail appears above the composer with a small X overlay to remove. Multiple attachments queue horizontally.

**Voice (optional, P2):**

- Microphone icon next to camera (Tabler `ti-microphone`) — only shown if browser supports MediaRecorder API
- Tap-to-talk: hold to record, release to send; transcribes via Whisper or browser SpeechRecognition
- Out of scope for v1 but include the affordance slot

**Composer states:**

- Empty + unfocused: neutral border
- Focused: brand-color focus ring
- Disabled (during tool use or error): low opacity, "Assistant is responding…" placeholder
- Rate-limited: shows a small inline message "One moment — let me finish that thought."

---

### I.13 Auth, handoff, save-cart, and special-state cards

These are first-class message blocks (§I.7), each with a distinct visual treatment so they don't get lost in conversation flow.

**Auth prompt card** (when the assistant needs to access customer data):

```
┌─────────────────────────────────────┐
│ 🔒  Sign in to see your orders      │
│ I can look up your order status and │
│ recent purchases once you sign in.  │
│ ┌─────────────────────────────────┐ │
│ │   Sign in with {Shop} Account   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Tabler `ti-lock` icon top-left
- Soft brand-tint background (`--swa-color-brand-soft`)
- One CTA — opens the OAuth flow in a popup (existing implementation), returns to chat with a "You're signed in" confirmation
- Dismissible via "Not now" link

**Handoff confirmation card:**

```
┌─────────────────────────────────────┐
│ ✓ Connected with our team           │
│ I've shared your conversation. The  │
│ team will reply at {email} within   │
│ {expected_response_time}.           │
│                                     │
│ Summary they'll see:                │
│ ┌─────────────────────────────────┐ │
│ │ Custom engagement ring inquiry  │ │
│ │ — Budget $5–7k                  │ │
│ │ — Lab diamond, halo, white gold │ │
│ │ — Inspiration: 2 images attached│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Success-color icon
- Boxed "summary" so the shopper sees what was sent (transparency)
- Tapping the summary expands to full conversation excerpt

**Save-cart card:**

```
┌─────────────────────────────────────┐
│ 💾 Save this cart for later         │
│ Send yourself a link so you don't   │
│ lose what you've picked.            │
│                                     │
│ Email: [you@example.com         ]   │
│  [ Send me the link ]               │
└─────────────────────────────────────┘
```

- Captures email (or SMS phone if SMS opted in by merchant)
- After submit, swaps to a "Sent! Check your inbox." confirmation

**Cart summary card:**

```
┌─────────────────────────────────────┐
│ Your cart (2 items)                 │
│ ┌──┐ Diamond Halo Ring    $2,499    │
│ │  │ Size 6.5 · 14k WG             │
│ └──┘                                │
│ ┌──┐ Care Kit                $39    │
│ │  │ Silver polish + cloth         │
│ └──┘                                │
│ ──────────────────────────          │
│ Subtotal               $2,538       │
│ ┌─────────────────────────────────┐ │
│ │      Checkout →                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Compact line items with small product thumbnails
- Subtotal in medium weight
- Single primary CTA "Checkout" (brand-colored button)
- "Edit cart" tertiary link below

**Order status card:**

```
┌─────────────────────────────────────┐
│ Order #1024                         │
│ Placed Apr 8 · Shipped              │
│                                     │
│ ▶ Shipped Apr 10 — In transit       │
│   USPS · Arrives Apr 14             │
│                                     │
│ [  Track package  ]                 │
└─────────────────────────────────────┘
```

---

### I.14 Empty, error, and offline states

**Empty (first launch, but pack info unloaded):**

Skeleton loader for the welcome panel — animated placeholder boxes for hero, entry cards, chips. Resolves once pack metadata arrives. Avoids the "flash of nothing."

**Error (network / API failure):**

Inline error card replacing or appended to the assistant turn:

```
┌─────────────────────────────────────┐
│ ⚠  Something went wrong             │
│ I couldn't reach the catalog just   │
│ now. Want to try again?             │
│ [  Try again  ]   [ Talk to a human]│
└─────────────────────────────────────┘
```

**Offline (browser detects offline):**

Banner at the top of the messages area:

```
┌─────────────────────────────────────┐
│ ● You're offline. I'll reconnect    │
│   when you're back.                 │
└─────────────────────────────────────┘
```

Composer disabled while offline. Auto-reconnects when `navigator.onLine` returns true.

**Rate-limited:**

Inline gentle text: "Catching my breath — one moment." No alarming red treatment.

---

### I.15 Animations & motion

**Catalogue of motion (every animation in the widget):**

| Animation | Duration | Easing | Notes |
|---|---|---|---|
| Launcher resting float | 4s loop | sine | 0.5px translateY, very subtle |
| Launcher hover scale | 200ms | standard | scale(1.05) |
| Widget open | 250ms | emphasized | opacity 0→1 + translateY 20→0 (desktop), translateY 100%→0 (mobile) |
| Widget close | 200ms | standard | reverse of open |
| Proactive preview in | 200ms | emphasized | translateX 20→0 + opacity |
| Proactive preview out | 150ms | standard | reverse |
| Message bubble in | 200ms | standard | opacity 0→1 + translateY 8→0 |
| Quick reply chip stagger | 50ms per chip, 200ms each | standard | fade-up |
| Tool-use shimmer | 1.6s loop | linear | gradient sweep across the indicator |
| Streaming typing dot | 1.2s loop | ease-in-out | scale(0.8)→scale(1.0), opacity 0.5→1 |
| Card ATC success | 300ms | emphasized | swap content, slight scale pulse |
| Carousel chevron fade-in | 150ms | standard | on hover (desktop) |

**Reduced motion:**

- Honor `prefers-reduced-motion: reduce` — all motion-only animations become instant snaps (durations drop to 0)
- Streaming text continues (it's a content delivery affordance, not decorative)
- Skeleton loaders use static placeholder, not shimmer

**No motion violations:**

- Never use parallax, scroll-jacking, or 3D rotations
- Never bounce-overshoot the launcher (looks playful, not professional)
- Never animate the brand color itself (no rainbows, no pulsing color)

---

### I.16 Accessibility (WCAG 2.1 AA)

**Required:**

1. **Landmarks:** the widget root is `role="complementary"` with `aria-label="Shop assistant"`. Header, messages, composer each have a clear role/label.
2. **Focus management:** opening the widget moves focus to the close button; closing returns focus to the launcher. Within the widget, Tab cycles in a logical order (header → messages → composer → footer); Shift+Tab reverses. Focus traps within the widget while open on mobile (full-screen). Esc closes the widget.
3. **Live region for streamed text:** the messages container has `aria-live="polite"` so screen readers announce new assistant messages. Streamed tokens are coalesced into the live announcement (don't announce every token).
4. **Color contrast:**
   - Body text on background: ≥4.5:1
   - 12px secondary text: ≥4.5:1 (don't fall below — many designs do)
   - CTA button text on brand color: ≥4.5:1 — if merchant's brand color doesn't pass, auto-darken or use a paired foreground color
   - Focus ring: 3:1 contrast with adjacent colors
5. **Touch targets:** ≥44×44px for all interactive elements on mobile.
6. **Keyboard equivalents:**
   - Enter: send message
   - Shift+Enter: newline in composer
   - Esc: close widget
   - Up arrow in empty composer: edit last user message (optional)
7. **Screen-reader labels for icon-only buttons:** close = "Close chat"; minimize = "Minimize chat"; send = "Send message"; camera = "Attach an image"; carousel chevrons = "Previous products" / "Next products".
8. **Image alt text:** product images use the product's alt text from Shopify; uploaded images use a generic "Image you uploaded".
9. **No autoplay audio.** Period.
10. **Form labels on every input** — sizing widget inputs have visible labels (not just placeholders).

**Test against:**

- VoiceOver on iOS and macOS
- TalkBack on Android
- NVDA on Windows
- Keyboard-only navigation start-to-finish purchase flow

---

### I.17 Localization & RTL

- All UI strings live in `extensions/chat-bubble/locales/{locale}.json` — never hardcoded in components
- v1 ships locales: en, es, fr, de, it, pt, nl, ja, ko, sv, ro, hi (matches F10 language set)
- Strings are mostly chrome (labels, placeholders, button text) — assistant content is generated per F10 in the shopper's language
- RTL languages (none in v1 set, but designed for): logical CSS properties (`padding-inline-start` not `padding-left`); icons that imply direction (send arrow, chevron) flip via CSS `transform: scaleX(-1)` when `dir="rtl"`; message bubble directionality reverses

---

### I.18 Merchant theming hooks

The merchant gets these knobs in the admin (F8 Persona tab):

| Knob | Effect | Default |
|---|---|---|
| Brand color | Sets `--swa-color-brand` and derived tokens | `#5046E4` |
| Persona avatar (file upload) | Replaces default pack avatar | Pack default illustration |
| Use logo instead of avatar in header | Boolean | `false` |
| Welcome heading text | First line of welcome panel | "Hi, I'm {persona_name}." |
| Welcome subheading | Second line of welcome panel | Pack default |
| Border radius preference | Sharp / Medium / Round (affects `--swa-radius-*`) | Medium |
| Position | Bottom-right / Bottom-left / Bottom-center | Bottom-right |
| Show "Powered by" footer | Boolean | `true` |
| Launcher icon | Pre-built choices: chat bubble, sparkle, headset, custom upload | Chat bubble |

**Brand-color auto-fallback:** if the merchant's primary color fails contrast against white text on CTAs (calculated client-side), the system auto-darkens the color until it passes — and shows a small note in admin: "We darkened your brand color slightly for accessibility."

---

### I.19 Per-pack visual flavor

Same design system across packs; small visual variations communicate vertical specificity without fragmenting the design language.

**Pack-driven values:**

| Pack | Default brand-soft hue (used in cards) | Hero illustration mood | Entry card icons (Tabler) |
|---|---|---|---|
| Jewelry | Champagne / muted gold tint | Refined, minimal, line-drawing of a ring | `ti-diamond`, `ti-gift`, `ti-calendar-star`, `ti-camera` |
| Fashion | Warm neutral / sand | Stylish line-drawing of a hanger or garment | `ti-shirt`, `ti-gift`, `ti-ruler-measure`, `ti-color-swatch` |
| Footwear | Athletic blue tint | Side-profile shoe line-drawing | `ti-shoe`, `ti-ruler-measure`, `ti-trekking`, `ti-refresh` |
| Electronics | Cool gray-blue | Minimal line-drawing of a laptop | `ti-device-laptop`, `ti-versions`, `ti-plug-connected`, `ti-arrows-up-right` |
| Flowers | Soft rose / peach | Stem with one bloom line-drawing | `ti-flower`, `ti-calendar-heart`, `ti-mood-sad` (sympathy — used carefully), `ti-bookmark` |
| Beauty | Soft blush / sand | Drop / petal line-drawing | `ti-droplet`, `ti-leaf`, `ti-color-picker`, `ti-checklist` |
| Home | Warm earth / clay | Side-profile sofa line-drawing | `ti-sofa`, `ti-ruler-3`, `ti-truck-delivery`, `ti-palette` |

**Brand-soft hue note:** the merchant's brand color still drives CTAs and the launcher. The pack hue is only a subtle wash in card backgrounds and hero blocks — never strong enough to fight the merchant's brand.

**Flowers safety:** the sympathy entry card uses a respectful icon and the lighter pack hue. The sympathy *flow* itself switches the message-area background to a more muted neutral (no brand-soft tint) and removes the catalog highlights carousel. This is hard-coded in the flowers pack — see H.5.

---

### I.20 Component implementation map

Where each piece lives. Claude Code should build the widget as a small component system (vanilla JS + CSS modules, no framework — the theme-extension constraint), but the *structure* is what matters, not the exact file split.

```
extensions/chat-bubble/
├── blocks/
│   └── chat-interface.liquid       # only the launcher mount-point + script tag
├── assets/
│   ├── chat.js                     # entrypoint: bootstraps the widget
│   ├── chat.css                    # design tokens + global widget styles
│   │
│   ├── components/                 # split chat.js into modules (still served as one bundle)
│   │   ├── Launcher.js             # bubble + proactive preview (§I.4)
│   │   ├── Window.js               # widget shell (header, messages, composer) (§I.3, I.5)
│   │   ├── Header.js               # §I.5
│   │   ├── WelcomePanel.js         # §I.6
│   │   ├── MessageList.js          # virtualized list of turns
│   │   ├── Turn.js                 # avatar + block stack
│   │   ├── blocks/
│   │   │   ├── TextBlock.js
│   │   │   ├── ProductCard.js      # §I.8
│   │   │   ├── ProductCarousel.js  # §I.8
│   │   │   ├── QuickReplies.js     # §I.9
│   │   │   ├── ComparisonTable.js
│   │   │   ├── SizingWidget.js     # §I.10
│   │   │   ├── ImagePreview.js
│   │   │   ├── VisionResult.js
│   │   │   ├── AuthPrompt.js       # §I.13
│   │   │   ├── HandoffCard.js
│   │   │   ├── SaveCartCard.js
│   │   │   ├── CartSummary.js
│   │   │   ├── OrderStatus.js
│   │   │   ├── ToolUseIndicator.js # §I.11
│   │   │   ├── PolicyExcerpt.js
│   │   │   └── ErrorCard.js
│   │   ├── Composer.js             # §I.12
│   │   ├── ProactivePreview.js     # §I.4
│   │   ├── StatusBanner.js         # §I.14 (offline, etc.)
│   │   └── FlowStepIndicator.js    # §I.10
│   │
│   ├── styles/
│   │   ├── tokens.css              # §I.2 design tokens
│   │   ├── base.css                # widget shell, layout
│   │   ├── components/             # one file per component
│   │   ├── motion.css              # §I.15 keyframes
│   │   └── a11y.css                # focus visible, reduced-motion overrides
│   │
│   ├── icons.js                    # Tabler icon SVG strings (tree-shake-able)
│   ├── i18n.js                     # locale loader
│   └── api.js                      # /chat SSE client (already mostly exists)
│
└── locales/                        # § I.17
    ├── en.default.json
    ├── es.json
    └── ... (12 total)
```

**Bundling note:** in the Shopify theme-extension constraint we can't add a build step. The implementer can either (a) split into multiple JS files served from `assets/` and import via `import()` (modern theme extensions support this), or (b) keep a single concatenated `chat.js` but organize the code internally as modules with clear sections.

---

### I.21 ASCII wireframes (per state)

**State 1 — Launcher resting:**

```
                                                  ┌────┐
                                                  │ ◯ │   ← brand color circle
                                                  └────┘
```

**State 2 — Launcher with proactive preview:**

```
                          ┌────────────────────────────┐
                          │ ◯  Mira                  ×│
                          │ Looking at the halo ring?  │
                          │ I can help with sizing.    │
                          └─────────────────────╲──────┘
                                                ╲
                                                ┌────┐
                                                │ ◯ │
                                                └────┘
```

**State 3 — Open, welcome panel (desktop):**

```
┌─────────────────────────────────────────────────────────────┐
│ ◯ Mira  · Online                              –   ✕         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ◯◯ (avatar 48px)                              │
│                                                             │
│        Hi, I'm Mira. I'm here to help find                 │
│        the perfect piece of jewelry.                        │
│                                                             │
│   ┌──────────────────┐    ┌──────────────────┐             │
│   │ 💎  Find a gift  │    │ 💍 Choose a ring │             │
│   │ Occasion-led     │    │ Engagement       │             │
│   └──────────────────┘    └──────────────────┘             │
│   ┌──────────────────┐    ┌──────────────────┐             │
│   │ ⭐ Birthstone     │    │ 📷 Visual search │             │
│   │ By month          │    │ Upload a photo   │             │
│   └──────────────────┘    └──────────────────┘             │
│                                                             │
│   [Show bestsellers] [Track my order] [Sizing help]        │
│                                                             │
│   ── Catalog highlights ──                                  │
│   ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐ →               │
│   │ p1 │  │ p2 │  │ p3 │  │ p4 │  │ p5 │                  │
│   └────┘  └────┘  └────┘  └────┘  └────┘                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [📷]  Type your message…                              [➤]   │
├─────────────────────────────────────────────────────────────┤
│ Powered by Shop LC AI · Privacy                             │
└─────────────────────────────────────────────────────────────┘
```

**State 4 — Active conversation with product carousel and quick replies:**

```
┌─────────────────────────────────────────────────────────────┐
│ ◯ Mira  · Online                              –   ✕         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ◯  Mira                                                    │
│   ┌─────────────────────────────────────┐                  │
│   │ Great — for a $4,000 engagement     │                  │
│   │ ring with a halo setting, here are  │                  │
│   │ three I'd recommend looking at:     │                  │
│   └─────────────────────────────────────┘                  │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ →                  │
│   │ img  │ │ img  │ │ img  │ │ img  │                     │
│   │ Ring │ │ Ring │ │ Ring │ │ Ring │                     │
│   │ $3.9k│ │ $3.7k│ │ $4.1k│ │ $3.5k│                     │
│   │ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │                     │
│   └──────┘ └──────┘ └──────┘ └──────┘                     │
│                                                             │
│   [ Compare these ] [ Show me more ] [ I like #1 ]         │
│                                                             │
│                            ┌─────────────────────────────┐ │
│                            │ Tell me about ring #1       │ │
│                            └─────────────────────────────┘ │
│                                                             │
│ ◯  Mira                                                    │
│   🔍 Looking that one up...                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [📷]  Type your message…                              [➤]   │
├─────────────────────────────────────────────────────────────┤
│ Powered by Shop LC AI · Privacy                             │
└─────────────────────────────────────────────────────────────┘
```

**State 5 — Mobile, full-screen, sizing flow step:**

```
┌─────────────────────────────────────┐
│ ◯ Mira  · Online              ✕    │
├─────────────────────────────────────┤
│                                     │
│ Step 3 of 5 — Style preference     │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░               │
│                                     │
│ ◯  Mira                            │
│   ┌─────────────────────────────┐  │
│   │ What setting style fits     │  │
│   │ what she'd love?            │  │
│   └─────────────────────────────┘  │
│                                     │
│   ┌─────────────┐ ┌─────────────┐  │
│   │  Solitaire  │ │    Halo     │  │
│   │     ◯      │ │   ◉ ◯ ◉    │  │
│   └─────────────┘ └─────────────┘  │
│   ┌─────────────┐ ┌─────────────┐  │
│   │ Three-stone │ │   Vintage   │  │
│   │  ◯ ◉ ◯    │ │     ◐       │  │
│   └─────────────┘ └─────────────┘  │
│                                     │
│              Cancel flow            │
│                                     │
├─────────────────────────────────────┤
│ [📷] Type your message…       [➤]   │
└─────────────────────────────────────┘
```

**State 6 — Sympathy flow (flowers pack — visually distinct):**

```
┌─────────────────────────────────────┐
│ ◯ Rosa  · Online              ✕    │  Header
├─────────────────────────────────────┤
│  ── neutral, no brand-soft tint ──  │
│                                     │
│ ◯  Rosa                            │
│   ┌─────────────────────────────┐  │
│   │ I'm sorry for your loss.    │  │
│   │ I'll help you find          │  │
│   │ something respectful.       │  │
│   └─────────────────────────────┘  │
│                                     │
│ ◯  Rosa                            │
│   ┌─────────────────────────────┐  │
│   │ Was the arrangement for     │  │
│   │ the family at home, or for  │  │
│   │ a funeral or service?       │  │
│   └─────────────────────────────┘  │
│                                     │
│   [For the home] [For a service]    │
│                                     │
├─────────────────────────────────────┤
│ Type your message…            [➤]   │
└─────────────────────────────────────┘
```

(Note: no image attach button in sympathy context, no upsell anywhere in the flow — the pack hides those affordances.)

---

### I.22 Acceptance criteria

For Claude Code to consider this section done:

- [ ] Design tokens (§I.2) defined as CSS custom properties; dark mode renders correctly without changing any token name
- [ ] Launcher renders at 60/56px per breakpoint; resting float animation honors reduced-motion
- [ ] Proactive preview displays with correct copy from the active pack; dismissible; throttled per §I.4
- [ ] Header renders persona avatar (or merchant logo when configured), name, status, minimize, close
- [ ] Welcome panel renders pack-driven entry cards (4) and suggested chips (3–5); catalog highlights carousel optional but defaults on
- [ ] Every message block type (§I.7) is implemented and visually distinct
- [ ] Product cards render image, title, subtitle (pack template), rating, price, two CTAs; ATC button shows success state inline
- [ ] Carousel uses native scroll-snap; chevrons on desktop hover; dot indicator on mobile
- [ ] Quick replies render below assistant turns; stagger-in animation; tap sends as user message
- [ ] Discovery flow step indicator with progress bar; cancel-flow available; sizing widget renders with method tabs
- [ ] Tool-use indicator shows with pack-appropriate icon and shimmer animation
- [ ] Composer auto-expands to 4 lines; image attachment preview above; send disabled on empty
- [ ] Auth, handoff, save-cart, cart, order, error cards all render with distinct treatments
- [ ] Empty / error / offline / rate-limited states all implemented
- [ ] Reduced-motion respected across every animation
- [ ] WCAG 2.1 AA verified via screen-reader pass (VoiceOver + TalkBack + NVDA) and keyboard-only path through purchase flow
- [ ] All UI strings come from `locales/{locale}.json`; 12 locales loaded; RTL-aware CSS (logical properties)
- [ ] Brand color auto-darkens if it fails CTA contrast; admin shows a note
- [ ] Per-pack visual flavor applied (icons, brand-soft hue, hero illustration) without re-theming the design language
- [ ] Flowers sympathy flow drops upsell affordances and uses neutral background
- [ ] Mobile widget honors safe-area insets and locks body scroll while open
- [ ] Composer keyboard handling on iOS (Visual Viewport API) keeps input above keyboard
- [ ] Smoke test: a full conversation from launcher click → welcome → discovery flow → product carousel → ATC → cart summary → checkout link runs without visual regressions

---

**End of PRD.**
