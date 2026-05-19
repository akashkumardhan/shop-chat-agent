# Design spec: Chat Widget UI Overhaul

**Status:** Draft 1
**Last updated:** 2026-05-19
**Scope:** The shopper-facing chat widget UI for `shop-chat-agent` — launcher, header, welcome, conversation surfaces, product cards, edge states. Backend pack runtime, discovery flow logic, analytics, and merchant admin UI are explicitly out of scope for this spec.
**Relationship to PRD:** PRD Appendix I is treated as inspiration; this spec replaces it. PRD goals (sales-first, branded, mobile-first, accessible) are preserved.

---

## 1. Summary

We rebuild the chat widget UI as an AI-first shopping surface. The brand identity is **"[Shop Name] AI"** (or "Shopping Assistant" as fallback); the product no longer uses per-pack personas in the visible chrome. A single animated gradient orb with a sparkle becomes the product's ownable visual at every size.

The widget is rebuilt around three principles that depart from the current implementation:

1. **Sales-first, not support-first.** Product imagery is hero, the ATC action wins on every product surface, the welcome panel offers a context-led primary action rather than a directory of options.
2. **AI-transparent.** The status line says "AI-powered". Tool-use indicators show the actual search inputs being run, not generic spinners. The product is honest about what it is.
3. **Mobile-first.** Every surface is designed against a 320–360px viewport before desktop layout.

---

## 2. Goals & success criteria

**Goals:**

- Make the widget feel like an AI shopping assistant, not a generic support chat.
- Reduce shopper cognitive load on first open by ≥30% (measured by time-to-first-tap on the welcome panel).
- Establish a single, ownable visual identity that survives pack-level theming.
- Cover every realistic widget state — including the unsexy ones (offline, error, returning, minimized-with-pending).

**Success criteria (acceptance — also see §16):**

- All six brainstormed surfaces (launcher, header, welcome, conversation, product, edge states) ship with the specified behavior.
- Widget passes WCAG 2.1 AA on focus management, contrast, keyboard navigation, and reduced-motion.
- Widget renders correctly on iOS Safari (with safe-area insets and dynamic viewport), Android Chrome, and desktop Chrome/Safari/Firefox.

---

## 3. Visual personality

**Default framework:** **Style B — Modern Clean.** All-sans, crisp borders, subtle shadows, brand color reserved for price/CTA/focus. Closest to Shopify Polaris aesthetic; widely familiar to merchants and shoppers.

**Pack flex variables (token-level overrides per vertical):**

| Variable | Default | Editorial-leaning packs (jewelry, premium home) | Warm-leaning packs (flowers, gifts, consumer beauty) |
|---|---|---|---|
| `--swa-radius-md` | 10px | 4px | 16px |
| `--swa-color-bg` | #FFFFFF | #FAF7F2 | #FFFBF5 |
| `--swa-font-display` | sans | Georgia / serif accent on shop name | sans |
| Orb palette | indigo / violet / pink | amber / rose / gold | rose / coral / amber |
| Card shadow | subtle | none (uses border only) | softer / larger |

Pack flex is applied as a token override block; no structural component changes per vertical.

---

## 4. Design tokens

Token namespace: `--swa-*` (shop-widget-assistant). All defined as CSS custom properties on `.shop-ai-chat-container` so a merchant theme can scope-override safely.

### 4.1 Color

```
/* Brand — merchant-overridable */
--swa-color-brand:                #5046E4
--swa-color-brand-hover:          #4239C7
--swa-color-brand-soft:           #EEEDFC
--swa-color-brand-foreground:     #FFFFFF

/* Neutral palette (light) */
--swa-color-bg:                   #FFFFFF
--swa-color-bg-subtle:            #F4F4F5
--swa-color-bg-elevated:          #FAFAFA
--swa-color-text-primary:         #18181B
--swa-color-text-secondary:       #555555
--swa-color-text-tertiary:        #888888
--swa-color-border:               #E5E5E8
--swa-color-border-strong:        #D4D4D8
--swa-color-focus-ring:           rgba(80,70,228,0.45)

/* Semantic */
--swa-color-success-bg:           #F0FDF4
--swa-color-success-fg:           #14532D
--swa-color-warning-bg:           #FFF7ED
--swa-color-warning-fg:           #9A3412
--swa-color-danger-bg:            #FEF2F2
--swa-color-danger-fg:            #B91C1C
--swa-color-info-bg:              #EEEDFC
--swa-color-info-fg:              #4239C7

/* Bubbles */
--swa-color-bubble-user-bg:       var(--swa-color-brand-soft)
--swa-color-bubble-user-text:     var(--swa-color-text-primary)
--swa-color-bubble-assistant-bg:  var(--swa-color-bg-subtle)
--swa-color-bubble-assistant-text:var(--swa-color-text-primary)

/* Orb (animated nebula — pack-tunable) */
--swa-orb-color-1:                #6366F1
--swa-orb-color-2:                #8B5CF6
--swa-orb-color-3:                #EC4899
--swa-orb-color-4:                #3B82F6
```

Dark mode (honors `prefers-color-scheme`; no manual toggle in v1) flips bg/text/border tokens — semantic and brand tokens hold.

### 4.2 Typography

```
--swa-font-sans:    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif
--swa-font-mono:    ui-monospace, SFMono-Regular, Menlo, monospace
--swa-font-display: var(--swa-font-sans)   /* serif accent allowed per pack flex */

--swa-text-xs:    11px / 1.4
--swa-text-sm:    12px / 1.5
--swa-text-base:  14px / 1.55
--swa-text-md:    15px / 1.5
--swa-text-lg:    17px / 1.4

--swa-weight-regular:  400
--swa-weight-medium:   500
--swa-weight-semibold: 600    /* used for prices, primary CTA text only */
```

Composer font-size is **16px on mobile** (suppresses iOS zoom-on-focus); body remains 14px.

### 4.3 Spacing, radius, shadow, motion

```
--swa-space-1: 4px  --swa-space-2: 8px   --swa-space-3: 12px
--swa-space-4: 16px --swa-space-5: 20px  --swa-space-6: 24px
--swa-space-8: 32px --swa-space-10: 40px

--swa-radius-sm: 6px    --swa-radius-md: 10px
--swa-radius-lg: 14px   --swa-radius-xl: 20px
--swa-radius-full: 9999px

--swa-shadow-sm: 0 1px 2px rgba(0,0,0,0.04)
--swa-shadow-md: 0 4px 12px rgba(0,0,0,0.08)
--swa-shadow-lg: 0 12px 28px rgba(0,0,0,0.12)
--swa-shadow-xl: 0 20px 40px rgba(0,0,0,0.18)

--swa-ease-standard:    cubic-bezier(0.2, 0, 0, 1)
--swa-ease-emphasized:  cubic-bezier(0.05, 0.7, 0.1, 1)
--swa-duration-fast:    120ms
--swa-duration-base:    200ms
--swa-duration-slow:    320ms

--swa-z-launcher: 2147483000
--swa-z-window:   2147483001
--swa-z-modal:    2147483010
```

When `prefers-reduced-motion: reduce` is set: durations collapse to 0ms, orb animation pauses, no slide-ins (use opacity fade only).

---

## 5. Layout & viewports

| Viewport | Window | Launcher |
|---|---|---|
| Mobile (<480px) | 100vw × 100dvh full-screen overlay, no radius, no shadow. Slide-up from bottom (256ms). Safe-area insets honored. | 56px circle, bottom-right, 16px from edges |
| Tablet (480–768px) | 380 × 600px, anchored to launcher | 56px circle, 20px from edges |
| Desktop (≥768px) | 420 × 640px, max-height calc(100vh - 120px), anchored to launcher, opens with upward slide | 60px circle, 24px from edges |

**Internal layout (consistent across breakpoints):**

```
┌─────────────────────────────────────┐
│ HEADER         48px                 │  fixed
├─────────────────────────────────────┤
│                                     │
│ MESSAGES       flex, scrollable     │  scrollbar-gutter: stable
│                                     │
├─────────────────────────────────────┤
│ QUICK-REPLY DOCK   0 or auto, ≤56px │  refreshed per assistant turn
├─────────────────────────────────────┤
│ COMPOSER       60–120px             │  auto-expanding to 4 lines
├─────────────────────────────────────┤
│ FOOTER         24px                 │  privacy/branding line
└─────────────────────────────────────┘
```

When `dvh` is unavailable, fall back to `vh` with a JS-set `--viewport-height` (current implementation pattern).

---

## 6. Launcher

### 6.1 Resting state

- 56–60px circle (per viewport), gradient nebula background (see §6.4), centered ✦ sparkle in white, soft shadow (`--swa-shadow-md`).
- Subtle resting micro-motion: 0.5px vertical float over 4s; orb gradient shifts every 8s. Both paused under `prefers-reduced-motion`.
- Hover (desktop): scale 1.05, shadow lifts to `--swa-shadow-lg`.
- Click: scale 0.95 then expands into window (`--swa-duration-slow`, `--swa-ease-emphasized`).

### 6.2 Pending-reply expansion

When the assistant has an unread message and the widget is minimized:

- Launcher transforms from circle → pill with shop name + 8px red dot ("Shop LC AI ●").
- Slide-in expansion (`--swa-duration-base`).
- Auto-collapses back to circle after 10s of no interaction.
- A 28-character preview bubble appears above the pill (the new message's first line) for the same 10s window.

### 6.3 Proactive preview bubble

Anchored 16px above the launcher, ≤280px wide, `--swa-radius-lg`, white bg, `--swa-shadow-md`, with a caret pointing to the launcher.

Contents: small orb (28px) + 1–2 lines of pack/trigger-specific copy + dismissible `×`.

**Copy resolution per trigger:**

| Trigger confidence | Copy style |
|---|---|
| High (size selector idle, OOS variant, exit intent) | **Action-Direct** — "Not sure about size? I can walk you through it in under a minute." |
| Low (long site dwell, no PDP) | **Contextual-Soft** — "Looking at the Halo Solitaire? Happy to answer anything." |
| Fallback (no specific signal) | **Open-Friendly** — "Hi — any questions I can help with?" |

**Frequency policy:**

- Max 1 preview per 5 minutes.
- Max 2 previews per session.
- Dismissed previews suppressed 24h on the same page URL.
- Exit-intent trigger ignores all caps (single fire per page).

**Counter-metric:** bounce-rate on PDPs with active proactive triggers is auto-tracked and surfaced to the merchant admin. If proactive triggers increase bounce >2% absolute, the system flags it; merchant can disable.

### 6.4 The orb (visual signature)

A single component renders at four sizes: `60px` launcher, `32px` header, `22px` turn-avatar, `16px` favicon.

```css
.swa-orb {
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #FFFFFF 0%, transparent 40%),
    radial-gradient(circle at 70% 70%, var(--swa-orb-color-3) 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, var(--swa-orb-color-4) 0%, transparent 50%),
    linear-gradient(135deg, var(--swa-orb-color-1), var(--swa-orb-color-2));
  background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
  animation: swa-orb 8s ease infinite;
}
.swa-orb::after { content: '✦'; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
```

Sparkle ✦ scales with orb size; omitted at 16px (favicon — just the gradient).

---

## 7. Header

- 48px tall, border-bottom 1px `--swa-color-border`.
- Layout, left → right:
  1. Orb avatar (32px).
  2. Title block: `{shop_name} AI` in 13px medium; below, status `● Online · AI-powered` in 10px tertiary. Fallback title `Shopping Assistant` if no shop name.
  3. Flexible spacer.
  4. Minimize button (32px touch target, 16px icon).
  5. Close button (32px touch target, 16px icon).
- Status dot color: `--swa-color-success-fg` when assistant is online, `--swa-color-text-tertiary` when idle, amber when reconnecting, no dot when offline.
- **No persona name. No language menu (deferred to F10 / Phase 2).**

---

## 8. Welcome panel

The welcome panel is a layout component above the message stream — not a regular message turn. It appears on first open of a session and resurfaces after a long idle gap (configurable; default 30 min).

### 8.1 Layout (context-led, hybrid focused)

Top to bottom:

1. **Hero** — orb (52px) + greeting line ("Hi — what brings you in?") + context line ("Looking at the Halo Solitaire" — present when page context is identified).
2. **Primary action** — one hero CTA card with title, one-line subtitle, primary button. Picked by the welcome resolver based on page context.
3. **"— or —"** divider.
4. **Alternatives** — 3 chip-style prompts below.

When page context confidence is too low for a primary action: the panel falls back to the **Conversational** layout — assistant text bubble acknowledging context (or generic "Hi — what brings you in?") + 3–4 chip alternatives. No hero card.

### 8.2 Welcome resolver service

Server-side function called when widget opens or transitions to welcome state.

```js
resolveWelcome({
  page_type,        // 'home' | 'pdp' | 'collection' | 'cart' | 'checkout' | 'search' | 'blog' | 'unknown'
  pack_id,          // 'jewelry' | 'fashion-apparel' | ...
  page_context,     // { product_id?, collection_id?, has_cart?, cart_value? }
  has_prior_convo,  // bool — affects greeting copy
}) → {
  greeting: string,           // "Hi — what brings you in?" | "Welcome back."
  context_line: string|null,  // "Looking at the Halo Solitaire" | null
  primary_action: {
    flow_id: string,
    label: string,            // "Help with sizing"
    subtitle: string,         // "Walk through ring sizing in under a minute."
    button_text: string,      // "Start the size guide →"
  } | null,                    // null → fall back to conversational
  chips: Array<{
    intent: string,
    label: string,            // ≤24 chars
    is_primary?: boolean,     // brand-tinted styling
  }>                          // 3–4 chips
}
```

Resolution rules (per pack; pack supplies its own table; example for `jewelry`):

| (page_type, signals) | primary_action | chips |
|---|---|---|
| `pdp` + size-sensitive | `sizing` | compare-similar, gift-mode, bestsellers |
| `pdp` + lead-time item | `delivery-check` | compare-similar, sizing |
| `cart` + hesitation signals | `walk-cart` | returns-policy, save-for-later |
| `collection` | _null_ (fallback) | narrow-by-price, gift-mode, bestsellers |
| `home` / `search` | _null_ (fallback) | gift-mode, bestsellers, returns |

Chips are sourced from the active pack's `discovery_flows`, filtered to ≤24 chars; intent fires the same canned opening prompt the chip's flow expects.

### 8.3 Returning user variant

When `has_prior_convo` is true and the prior conversation was within 7 days:

- Greeting: "Welcome back."
- Faded prior turns appear above with a `— 2 days ago —` divider.
- Resume card replaces the primary-action card: title "Pick up where you left off?", subtitle summarizing the prior conversation, two buttons: **Continue** (primary, brand) and **Start fresh** (ghost). "Start fresh" archives the prior conversation (does not delete).
- Chips below: contextually relevant to the prior topic.

---

## 9. Conversation surfaces

### 9.1 Message turns

A turn is an avatar + a vertical stack of one or more blocks.

- **User turn:** right-aligned, no avatar, bubble `--swa-color-brand-soft` bg with primary text. Border-radius `12px 12px 4px 12px`. Max 80% width.
- **Assistant turn:** left-aligned, orb avatar (22px) on first block only. Bubble `--swa-color-bg-subtle` bg. Border-radius `12px 12px 12px 4px`. Max 88% width.
- Markdown allowed: bold, lists, links, inline code. **Disallowed:** h1/h2/h3, markdown images. Render via DOMPurify-equivalent sanitizer.
- No per-message timestamps. A single `— X minutes ago —` divider appears only when the user reopens after a gap.

### 9.2 Block inventory

| Block | Behavior |
|---|---|
| `text` | Markdown-rendered, streamed token-by-token. Sanitized. |
| `product_card` | Full-width card (§10.1). |
| `product_carousel` | Horizontally scrollable, 1.5-card peek (§10.2). |
| `tool_use` | Slim shimmer pill (§9.3). |
| `quick_replies` | Lives in the dock, not inline (§9.4). |
| `sizing_widget` | Multi-step interactive (§9.5). |
| `comparison_mini` | 2 products inline (§9.6). |
| `compare_sheet_link` | Stub linking to full sheet for 3+ (§9.6). |
| `image_preview` | User-uploaded image in user-side bubble, max 240px, tap-to-lightbox. |
| `vision_result` | Assistant text describing image + product carousel. |
| `auth_prompt` | Inline sign-in card; OAuth popup. Full spec §11.7. |
| `handoff_card` | §12.4. |
| `save_cart_card` | Email + optional SMS capture to save cart. Full spec §11.6. |
| `policy_excerpt` | Quote-styled excerpt with cite link. |
| `cart_summary` | In-widget cart with qty/remove/discount/express + Checkout. Full spec §11.2. |
| `order_status` | Order card with status pill, items, tracking link, Reorder. Full spec §11.5. |
| `error_card` | Friendly error + retry action (§12.2). |

### 9.3 Tool-use indicator

A slim shimmer pill, not a block.

```
⚙ Searching   size 7 · 4–5mm bands
```

- Background: gradient shimmer animation across `--swa-color-bg-subtle` → `--swa-color-bg-elevated` → `--swa-color-bg-subtle`.
- Search inputs (the params after "Searching") are rendered in monospace and reflect the actual tool call arguments — not a generic "Searching catalog…" string.
- When tool resolves, pill is replaced by the result block (no fade — instant swap so the conversation feels responsive).
- Tool-failure (empty results) replaces the pill with a text bubble: "Didn't find a match for {query}. Try {alt}, or drop {constraint}." — never silent.

### 9.4 Quick reply dock

Sticky region between message stream and composer.

- Refreshed on every assistant turn — chips from the prior turn are discarded.
- Hidden when the user begins typing (focus + non-empty input).
- Brand-tinted chip = recommended next action (max 1 per dock).
- Neutral chip = alternative.
- Tap → sends the chip's label as a user message (or invokes a specific flow intent if the chip is tied to one).

### 9.5 Sizing widget

Interactive multi-step block inline in the conversation stream.

- Step indicator at top: thin dot row, completed steps brand-colored, future steps gray.
- One question at a time, chip-selector for answers (or a small numeric input where free-form is needed).
- **Completed steps compress to one-line summaries** ("Width: Standard · Brand: Nike size 10") so the stream stays readable across 4–6 steps.
- Always offers a fallback action ("Don't know yours? Print a sizer →") so progress is never blocked.
- On completion, returns a result (recommendation + 1–3 product cards in size). Result message includes a small "Restart sizing" link.

### 9.6 Comparison

- **Inline mini-table** for 2 products: title row + 3–4 attribute rows + 1-line verdict. Lives in the conversation stream as a block.
- **Full compare sheet** for 3+ products: slides up from the bottom of the widget (similar to a bottom sheet on mobile). Sticky first column on horizontal scroll. Verdict line pinned at the bottom. Dismissing closes the sheet and inserts a `compare_sheet_link` stub in the conversation ("Compare: Halo · 3-Stone · Solitaire ↗") so the shopper can reopen.

### 9.7 Composer

- Single-line auto-expands to 4 lines max. Beyond that, vertical scroll inside the composer.
- Enter sends; Shift+Enter newline.
- 16px font size on mobile (suppresses iOS zoom-on-focus).
- Send button uses `--swa-color-brand`; disabled state `--swa-color-border-strong` when input is empty.
- Paperclip (📎) icon for image upload (visual search — F6 backend not in this spec; UI affordance is present from v1).
- Esc closes the widget (desktop only). Cmd/Ctrl+/ focuses the input.

### 9.8 Auto-scroll behavior

- Stream auto-scrolls to bottom by default during assistant streaming.
- If the user scrolls up by >100px from the bottom while streaming, auto-scroll is suspended.
- A floating `↓ New messages` pill appears at the bottom; tapping it resumes auto-scroll.

---

## 10. Product card & carousel

### 10.1 Single product card

```
┌─────────────────────────────────────┐
│ [STATUS BADGE]                      │
│                                     │
│       [product image]               │  4:3 (default) or 1:1 (jewelry/beauty)
│                                     │
├─────────────────────────────────────┤
│ Product title (1–2 lines)   $XX     │
│ Pack subtitle (1 line)              │
│ ★ 4.8 · 124 reviews                 │
│                                     │
│ [    Add to cart                  ] │
└─────────────────────────────────────┘
```

- **Whole card is tappable** → opens PDP (same tab by default; merchant-configurable in admin to use new tab).
- **Single primary CTA: "Add to cart"** — full-width within the card, `--swa-color-text-primary` background, white text. Equal-weight "View details" button is dropped.
- **Status badge slot:** small pill in the image area's top-left corner. Values: `In stock` (no badge — default), `Low stock`, `Ships in {N} days`, `Made to order · {N} weeks`, `Backorder`, `Sold out` (greys the ATC + relabels to "Notify me").
- **Pack subtitle** is supplied by the active pack:
  - jewelry: `{metal} · {clarity}`
  - fashion: `{material} · {fit}`
  - footwear: `{brand} · {drop}`
  - electronics: `{brand} · {key spec}`
  - flowers: `{stems_count} stems · {delivery_window}`
  - beauty: `{volume} · {skin_type}`
  - home: `{material} · {dimensions}`
- **Rating** rendered only if catalog has ratings (≥3 reviews). Format: `★ 4.8 · 124 reviews`.
- **Discount display:** if `compare_at_price > price`, show `<strikethrough>$X</strikethrough> $Y` with sale price in `--swa-color-brand`; add a small `Save $Z` badge next to the price.
- **Inline variant picker:** when product has 2–5 variants, render variant chips below the subtitle. Tapping a variant updates price/availability/ATC inline. When >5 variants, no inline picker — the card routes to PDP for selection.

### 10.2 ATC button states

State machine (from initial render):

1. **Default:** `Add to cart` (brand-color bg, white text).
2. **Loading** (during cart mutation): button text replaced with a small spinner; disabled.
3. **Success** (3 seconds after success): `✓ Added — View cart` (success-bg, success-fg). Card shows a subtle pulse animation.
4. **Settled** (after 3s): `Added — View cart` text link (no button styling), positioned where the button was. Persistent.
5. **Error:** banner above the button: "Couldn't add to cart. Retry?" with retry action. Button returns to Default.

### 10.3 Carousel variant

- Horizontal scroll with **1.5-card peek** (1 full card + 0.5 next-card visible) at the rightmost edge so the affordance is obvious without chevrons.
- Cards: 150px wide on mobile, 170px on desktop. Image-heavy (60% of card height).
- Each card has a small floating "+" ATC button in the bottom-right corner of the image. Tapping it adds to cart without leaving the carousel (same state machine as 10.2 but compressed: button briefly turns into ✓ then resets).
- Tapping the card body opens PDP.
- Snap-scrolling. No chevron controls. On desktop, hover shows a faint left/right arrow overlay.

---

## 11. Customer actions inside the widget

The widget is sales-first, which means the customer should be able to complete most of the buying journey *inside* the widget — discover, compare, add to cart, manage cart, sign in, look up orders — without bouncing back and forth between the chat and the storefront. The only required transition out is the Shopify-hosted checkout page (and a few low-frequency account flows). Every transition out is announced and preserves state so the customer returns to a coherent conversation.

### 11.1 Action inventory

| Action | Where it lives | Leaves widget? |
|---|---|---|
| Browse / discover products | Conversation (product cards, carousels) | No |
| Add to cart | Product card ATC button | No |
| Select variant | Inline variant chips on product card (2–5 variants) | No |
| View cart | `cart_summary` block | No |
| Update quantity | Inline qty stepper in `cart_summary` | No |
| Remove line item | × on each line in `cart_summary` | No |
| Apply discount code | "Have a code?" expander in `cart_summary` | No |
| Begin checkout | "Checkout →" button | **Yes** — Shopify checkout |
| Express checkout (Shop Pay / Apple Pay / Google Pay) | Buttons above main checkout when eligible | **Yes** — native sheet/redirect |
| Sign in (customer) | `auth_prompt` card → OAuth popup | Popup only — widget stays |
| Look up orders | "Show my orders" intent → `order_status` cards | No |
| Track shipment | Tracking link inside `order_status` | **Yes** — carrier URL (new tab) |
| Reorder past purchase | "Reorder" button on `order_status` | No (adds to cart, opens `cart_summary`) |
| Save cart for later | `save_cart_card` (email capture) | No |
| Hand off to human | `handoff_card` | No |
| Upload image (visual search) | Composer 📎 → `image_preview` | No |

### 11.2 Cart summary block

Rendered as an assistant turn block. Triggered after ATC ("View cart" link → expands), or by intent ("show my cart", "what's in my cart").

```
┌─────────────────────────────────────┐
│ Cart · 3 items                $148  │  Header
├─────────────────────────────────────┤
│ [img] Halo Solitaire           ×    │  Line item
│       14k White · Size 7            │
│       [−] 1 [+]               $99   │
├─────────────────────────────────────┤
│ [img] Care Kit                 ×    │
│       Polish + cloth                │
│       [−] 1 [+]               $24   │
├─────────────────────────────────────┤
│ Have a code? ▾                      │  Discount expander
├─────────────────────────────────────┤
│ Subtotal                      $148  │
│ Shipping        Calculated next step│
├─────────────────────────────────────┤
│ [ ⚡ Shop Pay                     ] │  Express (when eligible)
│ [   Checkout →                    ] │  Primary
│ Save cart for later                 │  Ghost link
└─────────────────────────────────────┘
```

- **Header:** `Cart · {N} items` + running total on the right.
- **Line items:** thumbnail, title, variant summary, qty stepper, line total, remove (×). Tapping thumbnail or title opens PDP in a new tab.
- **Qty stepper:** `−` / number / `+`. Each click calls the MCP cart update; affected line shows a brief loading state. Stepper disabled at 1 (lower bound) — use the × to remove — and at the per-product max (upper).
- **Remove (×):** first tap shows an inline confirmation ("Remove?"); second tap confirms. Last-item-removed shows the empty-cart state.
- **Discount expander:** `Have a code? ▾` toggles a code input + Apply button. Success renders an additional `Discount {CODE}` line item with the saved amount; failure shows an inline error ("Code invalid or expired").
- **Subtotal + shipping note:** subtotal is computed client-side from line items; shipping shown as "Calculated next step" — we don't replicate Shopify's shipping calculator inside the widget.
- **Empty state:** When the cart is empty, the block collapses to a single-line "Your cart is empty. [Keep shopping →]" message that closes the cart summary on tap.

### 11.3 Checkout transition

The "Checkout →" button is the only place where the widget hands control to Shopify's hosted checkout. We make the transition explicit and state-preserving.

**Behavior:**

1. Tap → button enters loading state (`Opening checkout…`).
2. Widget posts the cart to Shopify and retrieves the checkout URL.
3. Widget saves the conversation state to the server with a short-lived resume token (max age 24h).
4. Navigation:
   - **Desktop:** opens checkout in a new tab. Widget remains open in the original tab; on returning to the original tab, the widget shows a small `Checkout opened in new tab — [View it ↗]` status line until dismissed.
   - **Mobile:** opens checkout in the same tab (full-screen widget would otherwise occlude). On return via back-navigation, the widget reopens with the saved state.
5. After a successful order (detected via Shopify webhook), the widget — on its next open — shows a `✓ Thanks for your order #{N} — [Track it]` state at the top of the stream.

### 11.4 Express checkout

When the storefront has Shop Pay / Apple Pay / Google Pay enabled and the cart is eligible, render express buttons **above** the regular Checkout button inside `cart_summary`.

**Eligibility (v1):**

- Wallet is enabled for the storefront (Shopify Storefront API exposes this).
- Cart contains products from a single shop (always true in our case).
- No subscription items in the cart (subscription cart handling is F17 / Phase 2).
- No items requiring custom delivery instructions.

If a device-native wallet is available (Apple Pay on iOS Safari, Google Pay on Chrome on Android), show that one only. Otherwise show Shop Pay as the universal fallback. Maximum one express button rendered at a time to keep the cart compact.

Tapping triggers the platform's native sheet. On success, the widget receives the order confirmation event and morphs the cart into a `✓ Thanks for your order #{N}` state.

### 11.5 Order lookup & history

**Intents that surface order data:** "show my orders", "where's my order", "track my package", "did my order ship", "is this still coming".

**Flow:**

1. If the customer is not authenticated → render `auth_prompt` card. Customer signs in via the existing customer-MCP OAuth flow.
2. After auth (or if already authenticated) → assistant queries customer MCP for recent orders.
3. Render up to 3 most recent orders as `order_status` blocks. If more exist, a `Show older orders` chip below the last block extends the list.

**`order_status` block contents:**

- Order number + date.
- Status pill: `Processing` (yellow) / `Shipped` (blue) / `Delivered` (green) / `Cancelled` (gray).
- Items list: thumbnail + title + qty. Max 3 visible; "+N more" line if longer.
- Total.
- **Tracking link** when status is Shipped or Delivered (opens carrier URL in a new tab).
- **Reorder** button → adds the order's line items to the current cart, then opens `cart_summary`. If a product is out of stock or discontinued, that line item is skipped and the assistant notes which items were skipped and why (and offers to suggest a replacement).

### 11.6 Save cart for later

Triggered either by cart hesitation (F7 — proactive trigger detects an idle cart) or by explicit intent ("save my cart", "email me my cart").

**`save_cart_card` contents:**

- Title: `Save your cart for later`.
- Value prop: `We'll email you a link — pick up where you left off.`
- Email input (pre-filled if the customer is authenticated).
- Optional SMS input (collapsed link `Add SMS reminder ▾`).
- Explicit consent line: `By saving, you agree to receive a cart reminder. No marketing.`
- Submit button: `Send me the link`.
- On success: card morphs to `✓ Sent — check your email`.

### 11.7 Sign-in (`auth_prompt`)

Appears inline whenever an action requires authentication (order lookup, reorder, save-to-account). Triggers the customer-MCP OAuth popup. On success, the originating intent resumes automatically — the customer doesn't need to re-ask. On cancellation or failure, the card stays open with a retry action and a brief explanation.

### 11.8 What requires leaving the widget

Some actions intentionally are not handled inside the widget — either because they belong to Shopify's hosted experience or because building them in-widget adds risk for negligible gain.

- **Completing checkout** — handed off to Shopify checkout (§11.3).
- **Account creation, password reset, billing & address management** — handed off to Shopify customer account; the widget can deep-link to these.
- **Product reviews** — rating + count are surfaced on product cards, but writing a review happens on the PDP.
- **Subscription management** — F17 / Phase 2; not in v1.
- **Refund / return initiation** — handoff to the human team via `handoff_card`.
- **Wishlist / favorites** — out of v1 scope (the save-cart flow covers the close-by use case).
- **Multi-shop or cross-merchant cart** — not supported.

**Transition principle:** every "leave the widget" action shows a transitional state (`Opening checkout…`, `Opening tracking…`) and, where the customer is expected to return, preserves widget state via a server-side resume token (max age 24h).

---

## 12. Edge states

### 11.1 Empty (first ever, no page context)

Welcome panel in conversational fallback mode. Greeting + "Looking for something specific, or just exploring?" + 3 generic chips (gift-mode, bestsellers, returns-policy).

### 11.2 Network error mid-stream

- Partial assistant response stays visible.
- Inline orange banner below the partial response: `⚠ Connection dropped. Response incomplete. [Retry]`.
- **Auto-retry once** silently before showing the banner (transient blip recovery).
- **Retry** action resends the same user prompt without restarting the conversation context.

### 11.3 Offline

- Black top bar above the header: `● You're offline — read-only mode`.
- Header status dot turns gray; status text reads `○ Offline`.
- Composer placeholder changes to "Connection required to send…"; send button visibly disabled.
- Existing conversation remains scrollable.
- Auto-recovers when connection returns: top bar fades, composer re-enables, a small toast appears: "Back online".

### 11.4 Post-handoff card

- Green-tinted card in the conversation stream.
- Title: `✓ Ticket created`.
- Body: reply-time commitment (`Reply expected within 4 hours · We'll email {email}`) — concrete, not "soon".
- Embedded summary box: `Summary the team sees:` followed by the actual summary text. Transparency builds trust.
- Composer stays open after the card — shopper can add details before the team replies.

### 11.5 Minimized with pending reply

(See §6.2.) Launcher transforms into labeled pill with red dot + preview bubble.

### 11.6 Compare sheet (3+ products)

(See §9.6.)

### 11.7 Rate-limited

- Composer disabled for `N` seconds (e.g., 5).
- Pill above composer: `Catching my breath, try again in 5s…` with a live countdown.
- Send button re-enables when countdown ends.

### 11.8 Auth required (customer MCP OAuth)

- Inline `auth_prompt` card in the conversation: title + 1-line subtitle + Sign-in button.
- Tapping opens OAuth in a popup.
- On success, card morphs to `✓ Connected` (success colors) and the originating intent (e.g., "show my orders") resumes automatically.

### 11.9 Tool failure (no results)

- No silent failures. Always a text block: `Didn't find a match for {query}. Try {alt_query}, or drop {constraint}.` with chip suggestions for the alternative queries.

---

## 13. Information architecture

```
WidgetRoot
├── Launcher
│   ├── Resting state (orb)
│   ├── ProactivePreview (transient)
│   └── PendingPill (transient, when unread)
├── ChatWindow (when open)
│   ├── Header
│   ├── MessageStream
│   │   ├── WelcomePanel (transient)
│   │   ├── TurnList (assistant + user turns)
│   │   └── AutoScrollPill (transient)
│   ├── QuickReplyDock (transient per turn)
│   ├── Composer
│   └── Footer
└── ModalLayer (overlay z-index)
    ├── CompareSheet (3+ products)
    ├── ImageLightbox
    └── OAuthPopup (system-managed)
```

---

## 14. Accessibility (WCAG 2.1 AA)

- **Landmarks:** widget root is `role="complementary"` aria-label="Shopping assistant". Stream is `role="log" aria-live="polite"`.
- **Focus management:** opening the widget moves focus to the composer. Closing returns focus to the launcher.
- **Streaming:** screen reader announces new assistant turns via the aria-live region; individual streamed tokens are NOT announced (use a debounced final-turn announcement).
- **Contrast:** all text/background pairs meet 4.5:1 (3:1 for ≥18px medium). Brand color contrast checked against `--swa-color-brand-foreground` and bubble backgrounds. Merchant brand-color override triggers a contrast warning in admin if it fails.
- **Keyboard:** Tab order: header buttons → message stream (browseable as a list) → quick-reply chips → composer → send. Esc closes the widget. Cmd/Ctrl+/ focuses composer. Shift+Tab works correctly throughout.
- **Reduced motion:** all animations under `prefers-reduced-motion: reduce` collapse to 0ms or use opacity-only fades. Orb animation pauses.
- **Touch targets:** every interactive element ≥44 × 44px on mobile.
- **Color is not the only signal:** status dot has accompanying text ("Online" / "Offline"); error/success states have icons in addition to color.

---

## 15. Files to touch / create

```
extensions/chat-bubble/
  assets/
    chat.css              # full rewrite — token-based; ~6× current size
    chat.js               # significant refactor — modularize into:
                          #   chat.js (root + init)
                          #   modules/
                          #     ui-launcher.js
                          #     ui-header.js
                          #     ui-welcome.js
                          #     ui-stream.js
                          #     ui-composer.js
                          #     ui-product-card.js
                          #     ui-carousel.js
                          #     ui-sizing-widget.js
                          #     ui-compare-sheet.js
                          #     ui-edge-states.js
                          #     orb.js
                          #     proactive.js
                          #     auto-scroll.js
                          #     auth.js
                          #     api.js
                          #     state.js
  blocks/
    chat-interface.liquid # new markup — root div + script bootstrap + token CSS variable injection

app/
  routes/
    chat.jsx              # extend to accept page_context and trigger params
    welcome.jsx           # NEW — welcome resolver endpoint, returns ResolvedWelcome JSON
  services/
    welcome.server.js     # NEW — resolveWelcome(page_type, pack_id, page_context, has_prior_convo)
    pack.server.js        # NEW (stub for this spec) — exposes active pack's chip/flow registry
    config.server.js      # extend with theme tokens, shop name, orb palette overrides
  prompts/
    base.md               # base sales-first instructions (chrome-stripped, no persona name)
```

**Modularization rationale:** the current `chat.js` is 956 lines in a single file. Splitting per surface keeps each module small enough to hold in working memory and makes per-block iteration safe.

---

## 16. Non-goals (v1)

- Voice input.
- In-widget multi-language menu (auto-detect from browser locale; full F10 is Phase 2).
- In-widget shopper settings panel (admin owns config; frequency rules cover most needs).
- Multi-conversation history browser (resume card handles the realistic case).
- Per-pack illustrated avatars (orb covers every pack).
- Dark-mode toggle (honors `prefers-color-scheme`; no UI control).
- Live agent inbox UI (handoff hands off to email/Slack; we don't build the desktop).
- Wishlist / favorites (save-cart covers the close-by use case for v1).
- In-widget product reviews (rating + count surfaced on cards; writing reviews happens on PDP).
- Refund / return initiation in-widget (routed via `handoff_card` to the human team).
- Address / billing / password management (deep-link to Shopify customer account).
- Completing checkout inside the widget (always handed off to Shopify checkout).
- Cross-merchant or multi-shop cart.
- Subscription cart management (F17 / Phase 2).

---

## 17. Acceptance criteria

- [ ] Launcher renders the animated gradient orb at 56/60px with shadow; resting micro-motion runs at 8s interval; both pause under `prefers-reduced-motion`.
- [ ] Clicking the launcher opens the widget with the spec'd slide animation. Closing returns focus to the launcher.
- [ ] Header shows `{shop_name} AI` (fallback `Shopping Assistant`), 32px orb avatar, `● Online · AI-powered` status, minimize, close.
- [ ] Welcome panel shows the resolved primary action when context confidence is high; falls back to conversational layout otherwise.
- [ ] Returning user (prior conversation within 7 days) sees the resume card with Continue/Start fresh.
- [ ] User and assistant bubbles use brand-soft and bg-subtle backgrounds respectively, with correct corner-squaring.
- [ ] Tool-use indicator renders as a shimmer pill with the actual tool inputs shown in monospace.
- [ ] Quick reply dock is sticky between stream and composer; refreshes on every assistant turn; hides on composer focus + non-empty input.
- [ ] Sizing widget renders step indicator, current question, chip selector; completed steps compress to one-line summaries.
- [ ] Comparison: 2 products → inline mini-table; 3+ products → full bottom-sheet with sticky first column and pinned verdict.
- [ ] Product card has single ATC, whole-card-tappable, status badge slot, inline variant picker for 2–5 variants, discount display rules, full ATC state machine.
- [ ] Product carousel uses 1.5-card peek, quick "+" ATC, snap-scrolling, no chevrons.
- [ ] Composer is single-line auto-expanding to 4 lines, 16px font on mobile, Enter sends, Shift+Enter newline, Esc closes.
- [ ] Auto-scroll suspends when user scrolls up >100px; resume pill appears at bottom.
- [ ] All six edge states render with their spec'd content and recovery actions.
- [ ] Proactive preview honors frequency policy (1/5min, 2/session, 24h dismiss, exit-intent ignores caps).
- [ ] Counter-metric bounce-rate is tracked and surfaced (counter-metric data path is in scope for backend; UI surfacing is admin-side, out of scope for this spec).
- [ ] WCAG 2.1 AA passes for focus, contrast, keyboard nav, reduced-motion.
- [ ] Widget renders correctly on iOS Safari, Android Chrome, and desktop Chrome/Safari/Firefox; safe-area insets honored on mobile.
- [ ] `cart_summary` block renders with header (count + total), line items with thumbnail/title/variant/qty stepper/remove ×/line total, discount expander, subtotal, and primary Checkout button.
- [ ] Qty stepper and remove actions update the cart inline via MCP without leaving the widget; the affected line shows a brief loading state.
- [ ] Discount code expander applies a valid code and shows an inline error for invalid/expired codes.
- [ ] Express checkout button (Shop Pay / Apple Pay / Google Pay) appears above the Checkout button when the wallet is enabled, the cart is eligible, and the device supports it; only one device-appropriate wallet is shown at a time.
- [ ] Tapping Checkout opens the checkout URL — new tab on desktop, same tab on mobile — saves a server-side resume token (max age 24h), and on return shows the appropriate post-checkout state.
- [ ] After a successful order (Shopify webhook), the widget on next open shows `✓ Thanks for your order #{N} — [Track it]` at the top of the stream.
- [ ] `order_status` block renders status pill, items list (with "+N more"), total, tracking link (when Shipped/Delivered), and Reorder button.
- [ ] Order lookup requires auth: unauthenticated intent surfaces `auth_prompt`, and the originating intent resumes automatically after successful sign-in.
- [ ] Reorder adds the original line items to the current cart and opens `cart_summary`; any skipped items (OOS / discontinued) are explicitly noted by the assistant with a replacement suggestion.
- [ ] `save_cart_card` collects email (and optional SMS), displays the explicit consent line, and morphs to a confirmation state on submit.
- [ ] Every "leave the widget" action (checkout, tracking, deep-link to customer account) shows a transitional state and, when return is expected, preserves widget conversation state.

---

## 18. Open questions / risks

1. **Welcome resolver pack table.** This spec defines the shape but only sketches the jewelry table. Each of the 7 v1 packs needs its own page-type-to-action map. Resolved during pack implementation (out of scope here).
2. **Brand color override + contrast warning.** Admin contrast check needs a defined algorithm (WCAG relative-luminance). Defer to admin-UI spec.
3. **Orb palette per pack.** Spec defines variables but not the 7 specific palettes. Defer to per-pack work; default palette is the indigo/violet/pink shipped in §6.4.
4. **Persona voice/tone migration.** Backend prompt composition no longer injects a name. Need to update the base prompt + each pack's voice notes to remove the self-introduction patterns ("I'm Mira…"). Out of scope for this UI spec, but flagged for the backend pack-system work.
5. **Compare sheet animation polish.** Bottom-sheet on mobile is well-known; desktop equivalent (slide from bottom inside the widget window) needs prototyping for jank.
6. **Reduced-motion behavior on the orb.** Pausing gradient animation is straightforward, but the orb visually anchors the AI identity — verify that a static orb still reads as "AI" rather than "logo" before shipping.
