# Design — Dashboard polish + Settings page

**Status:** Awaiting user review (drafted 2026-05-25)
**Author:** akumar + Claude (paired)
**Audience:** Engineer implementing the change
**Repo:** `shop-chat-agent`

---

## 1. Problem

The embedded admin dashboard (`/app`) currently looks like the default Shopify React Router template:

- Two aside cards ("App template specs" and "Next steps") clutter the right rail and serve developer audiences, not merchants.
- The "Congrats on creating a new Shopify app 🎉" section is reference-app boilerplate.
- The stats block, while functional, is laid out as a single `s-section` with three text columns — no card visual hierarchy, no trend deltas.
- The line chart works but feels rough: no Y-axis labels, no hover tooltip, default web colors, no area fill.
- There is no merchant-relevant content below the chart (e.g., product activity lists).
- The app has no Settings page at all. API keys live only in `process.env` (`CLAUDE_API_KEY`, `GEMINI_API_KEY`), with `LLM_PROVIDER` choosing the active one — invisible to anyone using the embedded admin app.

The goal of this change is a polished, merchant-facing dashboard, plus a Settings page that demonstrates how API key management *would* surface in the UI (mock only — real auth still flows through env vars).

## 2. Goals

1. Remove the two aside cards (`App template specs`, `Next steps`) and the "Congrats" reference-app section.
2. Render Total Conversations / Product Viewed / Total Revenue as three side-by-side **stat cards** with a trend-delta badge each.
3. Upgrade the line chart visually: Y-axis labels, hover tooltip with a vertical guide, area fill under each line, Polaris-native colors, latest-day values in the legend.
4. Below the chart, add two **product-list cards** in a two-column layout:
   - **Trending searched products** (left)
   - **Recent purchased products** (right)
   - Both use a compact, text-only row format (rank · name · metric).
5. Add a **Settings** page (`/app/settings`) accessible from the embedded app nav, with:
   - An active-provider radio toggle (Anthropic Claude / Google Gemini)
   - Two read-only masked API key fields with a per-field "Reveal" button
   - Helper links to each provider's key issuance page
   - "Save settings" button that shows a success toast (mock — no persistence)
6. Stay strictly within Polaris web components (`s-*` HTML custom elements). No custom CSS frameworks, no React Polaris, no chart libraries.
7. Reorganize dashboard code into `app/components/dashboard/` so the page route stays small and focused.

## 3. Non-goals

- **Real attribution data.** All numbers (stats, series, product lists) remain mock/illustrative, sourced from a single `mock-dashboard.server.js` file. Wiring to live conversation/order data is a separate change.
- **Persisting API keys in the database.** Settings is a UI-only mock. The real provider continues to be chosen by `LLM_PROVIDER` env var, and keys continue to come from `CLAUDE_API_KEY` / `GEMINI_API_KEY`.
- **Editable API key fields.** Inputs are read-only — typing would imply persistence that doesn't exist. Edits would mislead the demo audience.
- **Date-range picker / filtering.** "Last 14 days" stays hardcoded in the loader.
- **Customizing or theming Polaris components.** Pure Polaris look. The only place we have visual freedom is inside the inline SVG chart.
- **App Bridge migration** beyond what is already in `app.jsx` (`AppProvider embedded`).
- **Tests for visual components.** Polaris web components don't render in `happy-dom`, and the components are presentational. If we add tests later they go on the loader-side mock data shape.

## 4. Architecture

### 4.1 File structure (new and modified)

```
app/
├── routes/
│   ├── app.jsx                    (modified — adds Settings nav link)
│   ├── app._index.jsx             (rewritten — thin composition of components)
│   └── app.settings.jsx           (new — Settings route)
├── components/
│   └── dashboard/
│       ├── StatCard.jsx           (new)
│       ├── StatCardRow.jsx        (new — 3-up grid wrapper)
│       ├── LineGraph.jsx          (new — moved + upgraded from app._index.jsx)
│       ├── ProductList.jsx        (new — shared by both product cards)
│       └── SettingsForm.jsx       (new — used by app.settings.jsx)
└── data/
    └── mock-dashboard.server.js   (new — single source for all mock data)
```

### 4.2 Page layout (dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  Title bar: "Shop chat agent reference app"                 │
├─────────────────────────────────────────────────────────────┤
│  s-section "Performance — last 14 days"                     │
│    StatCardRow:                                             │
│      [ Total Conversations ] [ Product Viewed ] [ Revenue ] │
│    LineGraph (filled-area, 3 series, tooltip)               │
├─────────────────────────────────────────────────────────────┤
│  s-stack inline distribution=fill wrap                      │
│    [ Trending searched products ] [ Recent purchased ]      │
└─────────────────────────────────────────────────────────────┘
```

No `slot="aside"` sections. No "Congrats" section.

### 4.3 Page layout (Settings)

```
┌─────────────────────────────────────────────────────────────┐
│  Title bar: "Settings"                                      │
├─────────────────────────────────────────────────────────────┤
│  s-section "Active provider"                                │
│    s-choice-list (radio):                                   │
│      ◉ Anthropic Claude    (active)                         │
│      ○ Google Gemini                                        │
├─────────────────────────────────────────────────────────────┤
│  s-section "Anthropic Claude API key"                       │
│    s-text-field readOnly type=password                      │
│      [ ••••••••••••••••XK4Q ] [ Reveal ]                    │
│    s-link "Get your key at console.anthropic.com →"         │
├─────────────────────────────────────────────────────────────┤
│  s-section "Google Gemini API key"                          │
│    s-text-field readOnly type=password                      │
│      [ ••••••••••••••••P7Lm ] [ Reveal ]                    │
│    s-link "Get your key at aistudio.google.com/apikey →"    │
├─────────────────────────────────────────────────────────────┤
│              [ Cancel ]  [ Save settings ]                  │
└─────────────────────────────────────────────────────────────┘
```

## 5. Component specs

### 5.1 `StatCard.jsx`

**Props:** `{ label: string, value: string, hint?: string, delta?: number }`

**Render (Polaris components only):**

```
s-section padding="base"
  s-stack gap="extra-tight"
    s-text variant="bodySm" color="subdued"     → label
    s-stack direction="inline" gap="tight" alignment="center"
      s-heading                                  → value
      s-badge tone={tone}                        → "↑ 8.4%" (if delta)
    s-text variant="bodySm" color="subdued"     → hint (optional)
```

**Delta tone mapping:**

| Delta | Badge tone | Prefix |
|---|---|---|
| > 0   | `success`  | `↑ `   |
| < 0   | `critical` | `↓ `   |
| === 0 | `info`     | `→ `   |

Delta values come precomputed from the loader; `StatCard` does not recompute.

### 5.2 `StatCardRow.jsx`

Thin wrapper:

```jsx
<s-stack direction="inline" distribution="fill" gap="base" wrap>
  <StatCard label="Total Conversations"
            value={formatNumber(stats.totalConversations.value)}
            hint="All chat sessions to date"
            delta={stats.totalConversations.delta} />
  <StatCard label="Product Viewed"
            value={formatNumber(stats.productViewed.value)}
            hint="Products surfaced in chat"
            delta={stats.productViewed.delta} />
  <StatCard label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            hint="Attributed to chat-assisted orders"
            delta={stats.totalRevenue.delta} />
</s-stack>
```

`distribution="fill"` makes the three cards share the row equally; `wrap` lets them stack vertically on narrow viewports.

### 5.3 `LineGraph.jsx`

**Props:** `{ series: Array<{date, conversations, productViews, revenue}> }`

**Visual upgrades over the current inline graph in `app._index.jsx`:**

| Aspect | Current | New |
|---|---|---|
| Colors | `#5C6AC4` / `#47C1BF` / `#F49342` | Polaris admin palette: `#5C5F62` (conversations), `#005BD3` (product views), `#008060` (revenue) |
| Y-axis | None | 5 labels (one per gridline), `s-text` style, `#6D7175`, right-aligned at `paddingLeft - 6` |
| Area fill | None | `<path fill={color} fillOpacity="0.08">` under each line |
| Endpoint dots | Filled circle r=3.5 | Filled circle r=4 + 2px white stroke halo |
| Hover | None | One `<rect>` per day captures mouseenter/mouseleave; a `<g>` tooltip + vertical guide line render at the hovered index |
| Legend | Below, name only | Above the chart, right-aligned, includes the **latest-day value** next to each name |
| X-axis | Every 2nd date | All 14 dates abbreviated `5/11`, `5/12`, etc. |
| Empty state | None | If all series sum to zero, render `<text>` "No activity in the last 14 days" centered |

**Tooltip implementation (no library):**

- Local state: `const [hoverIdx, setHoverIdx] = useState(null)`
- For each day index `i`, render an invisible `<rect>` covering the column with `onMouseEnter={() => setHoverIdx(i)}` and `onMouseLeave={() => setHoverIdx(null)}`.
- When `hoverIdx != null`, render a `<g>`:
  - vertical guide line at `x(hoverIdx)`
  - rounded `<rect>` background near the top
  - three `<text>` rows: `Conversations 102`, `Product views 411`, `Revenue $3,120`

**Date formatting:** Mock series uses ISO strings (`"2026-05-11"`); chart renders them as `M/D` (`"5/11"`).

### 5.4 `ProductList.jsx`

**Props:** `{ title: string, items: Array<{rank, name, ...}>, metric: (item) => string }`

**Render:**

```
s-section heading={title}
  s-stack gap="tight"
    items.map(item =>
      s-stack direction="inline" distribution="equalSpacing" alignment="center"
        s-stack direction="inline" gap="tight"
          s-text color="subdued" → item.rank
          s-text                  → item.name
        s-text variant="bodySm" color="subdued" → metric(item)
    )
```

**Used twice on the dashboard:**

```jsx
<ProductList
  title="Trending searched products"
  items={trendingSearched}
  metric={(item) => `${item.searches} searches`}
/>
<ProductList
  title="Recent purchased products"
  items={recentPurchased}
  metric={(item) => `${formatCurrency({amount: item.price, currencyCode: item.currencyCode})} · ${item.purchasedAt}`}
/>
```

**Empty state:** if `items.length === 0`, render `<s-text color="subdued">No data yet</s-text>`.

### 5.5 `SettingsForm.jsx`

**Props:** `{ activeProvider, claudeApiKey, geminiApiKey }` (all from loader)

**Local state:**

```js
const [provider, setProvider] = useState(activeProvider);        // "claude" | "gemini"
const [claudeRevealed, setClaudeRevealed] = useState(false);
const [geminiRevealed, setGeminiRevealed] = useState(false);
```

**Provider toggle:** `s-choice-list` with two `s-choice` options. `selected={provider}`, `onChange={(e) => setProvider(e.target.value)}`. The selected option's label suffix changes to "(active)" purely as a visual cue.

**API key fields:**

```jsx
<s-text-field
  readOnly
  label="Anthropic Claude API key"
  type={claudeRevealed ? "text" : "password"}
  value={claudeRevealed ? FULL_DUMMY_CLAUDE : claudeApiKey.masked}
/>
<s-button onClick={() => setClaudeRevealed(v => !v)}>
  {claudeRevealed ? "Hide" : "Reveal"}
</s-button>
```

`FULL_DUMMY_CLAUDE` and `FULL_DUMMY_GEMINI` are constants exported from `mock-dashboard.server.js` so they exist in one place:

- Claude full: `sk-ant-DEMO-1a2b3c4d5e6f7g8h9iXK4Q`
- Gemini full: `AIzaSyDEMO1234567890abcdefghP7Lm`

**Save button:**

```jsx
<s-button variant="primary" onClick={handleSave}>Save settings</s-button>
```

`handleSave` calls `shopify.toast.show("Settings saved", { isError: false })` — the App Bridge toast API exposed via the embedded app context. No fetch, no DB write, no env mutation.

**Cancel button:** resets `provider`, `claudeRevealed`, `geminiRevealed` to their initial loader-derived values.

### 5.6 `app/routes/app.jsx` change

**Before:**

```jsx
<s-app-nav>
  <s-link href="/app">Home</s-link>
</s-app-nav>
```

**After:**

```jsx
<s-app-nav>
  <s-link href="/app">Home</s-link>
  <s-link href="/app/settings">Settings</s-link>
</s-app-nav>
```

Shopify's embedded admin nav renders both links as tabs with the active route highlighted automatically. No other change to `app.jsx`.

### 5.7 `app/routes/app._index.jsx` (rewritten)

```jsx
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getDashboardMockData } from "../data/mock-dashboard.server";
import { StatCardRow } from "../components/dashboard/StatCardRow";
import { LineGraph } from "../components/dashboard/LineGraph";
import { ProductList } from "../components/dashboard/ProductList";
import { formatCurrency } from "../components/dashboard/format";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return getDashboardMockData();
};

export default function Index() {
  const { stats, series, trendingSearched, recentPurchased } = useLoaderData();

  return (
    <s-page>
      <ui-title-bar title="Shop chat agent reference app" />

      <s-section heading="Performance — last 14 days">
        <StatCardRow stats={stats} />
        <LineGraph series={series} />
      </s-section>

      <s-stack direction="inline" distribution="fill" gap="base" wrap>
        <ProductList
          title="Trending searched products"
          items={trendingSearched}
          metric={(item) => `${item.searches} searches`}
        />
        <ProductList
          title="Recent purchased products"
          items={recentPurchased}
          metric={(item) =>
            `${formatCurrency({ amount: item.price, currencyCode: item.currencyCode })} · ${item.purchasedAt}`
          }
        />
      </s-stack>
    </s-page>
  );
}
```

### 5.8 `app/routes/app.settings.jsx`

```jsx
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getSettingsMockData } from "../data/mock-dashboard.server";
import { SettingsForm } from "../components/dashboard/SettingsForm";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return getSettingsMockData();
};

export default function Settings() {
  const data = useLoaderData();
  return (
    <s-page>
      <ui-title-bar title="Settings" />
      <SettingsForm {...data} />
    </s-page>
  );
}
```

No `action` export — Save is handled entirely client-side via App Bridge toast.

## 6. Mock data shape

**File:** `app/data/mock-dashboard.server.js`

```js
export const FULL_DUMMY_CLAUDE = "sk-ant-DEMO-1a2b3c4d5e6f7g8h9iXK4Q";
export const FULL_DUMMY_GEMINI = "AIzaSyDEMO1234567890abcdefghP7Lm";

export function getDashboardMockData() {
  return {
    stats: {
      totalConversations: { value: 1284,     delta: 8.4  },
      productViewed:      { value: 5421,     delta: 12.1 },
      totalRevenue:       { value: 38412.57, currencyCode: "USD", delta: 4.2 },
    },
    series: [
      { date: "2026-05-11", conversations: 62,  productViews: 244, revenue: 1820.50 },
      { date: "2026-05-12", conversations: 71,  productViews: 287, revenue: 2010.10 },
      { date: "2026-05-13", conversations: 58,  productViews: 220, revenue: 1660.40 },
      { date: "2026-05-14", conversations: 80,  productViews: 310, revenue: 2240.00 },
      { date: "2026-05-15", conversations: 96,  productViews: 388, revenue: 2890.75 },
      { date: "2026-05-16", conversations: 102, productViews: 411, revenue: 3120.00 },
      { date: "2026-05-17", conversations: 88,  productViews: 360, revenue: 2640.30 },
      { date: "2026-05-18", conversations: 95,  productViews: 401, revenue: 2890.20 },
      { date: "2026-05-19", conversations: 110, productViews: 460, revenue: 3340.55 },
      { date: "2026-05-20", conversations: 121, productViews: 502, revenue: 3690.40 },
      { date: "2026-05-21", conversations: 117, productViews: 488, revenue: 3520.80 },
      { date: "2026-05-22", conversations: 126, productViews: 530, revenue: 3810.10 },
      { date: "2026-05-23", conversations: 134, productViews: 565, revenue: 4012.65 },
      { date: "2026-05-24", conversations: 144, productViews: 612, revenue: 4276.82 },
    ],
    trendingSearched: [
      { rank: 1, name: "Wireless Headphones", searches: 142 },
      { rank: 2, name: "Yoga Mat",            searches: 118 },
      { rank: 3, name: "Coffee Beans",        searches:  96 },
      { rank: 4, name: "Resistance Bands",    searches:  82 },
      { rank: 5, name: "Water Bottle",        searches:  74 },
    ],
    recentPurchased: [
      { rank: 1, name: "Yoga Mat",            price: 24.00, currencyCode: "USD", purchasedAt: "2h ago" },
      { rank: 2, name: "Coffee Beans",        price: 18.50, currencyCode: "USD", purchasedAt: "4h ago" },
      { rank: 3, name: "Wireless Headphones", price: 89.00, currencyCode: "USD", purchasedAt: "6h ago" },
      { rank: 4, name: "Water Bottle",        price: 14.00, currencyCode: "USD", purchasedAt: "9h ago" },
      { rank: 5, name: "Resistance Bands",    price: 22.00, currencyCode: "USD", purchasedAt: "1d ago" },
    ],
  };
}

export function getSettingsMockData(env = process.env) {
  return {
    activeProvider: env.LLM_PROVIDER === "claude" ? "claude" : "gemini",
    claudeApiKey: { masked: "••••••••••••••••XK4Q", lastFour: "XK4Q" },
    geminiApiKey: { masked: "••••••••••••••••P7Lm", lastFour: "P7Lm" },
  };
}
```

Mock data is **stable across requests** (no randomization). The 14-day series ends on today (2026-05-25) minus one day, so the dashboard "feels current" when demoed.

## 7. Formatting helpers

A small `app/components/dashboard/format.js` (or co-located in `format.js` under dashboard/) holds:

```js
export function formatCurrency({ amount, currencyCode }) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_) {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDeltaPercent(d) {
  const sign = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return `${sign} ${Math.abs(d).toFixed(1)}%`;
}
```

These are the same helpers that exist inline in the current `app._index.jsx`, just moved into a shared module.

## 8. Error handling and edge cases

- **Loader auth failure:** `authenticate.admin(request)` already throws a redirect on auth failure — no additional handling needed. The error boundary in `app.jsx` catches it.
- **Empty product lists:** `ProductList` renders "No data yet" instead of an empty stack. (Not expected in the mock, but defensive.)
- **All-zero chart series:** `LineGraph` renders "No activity in the last 14 days" centered in the plot area.
- **Settings refresh:** Local state resets (provider toggle, reveal buttons). This is acceptable for a mock and reflects the real `LLM_PROVIDER` env var on reload.
- **Toast unavailable:** If `shopify.toast.show` is not defined (e.g., running outside the embedded admin context during development), `handleSave` falls back to `console.log("Settings saved (toast unavailable)")` so it doesn't crash.
- **Hover on the chart while tooltip is mid-render:** `setHoverIdx` is the only state involved; React batches updates per event. Re-renders are trivially cheap (14 days).

## 9. Testing

Per the non-goals, no automated tests are added for the visual components in this change. The mock-data functions (`getDashboardMockData`, `getSettingsMockData`) are pure and could be unit-tested later if their shape needs to be validated against a real-data swap.

Manual smoke test (developer running `npm run dev`):

1. Visit `/app` — see stat cards row, chart, two product cards.
2. Hover the chart — tooltip and vertical guide appear, follow the cursor across days.
3. Confirm no aside sections, no "Congrats" section.
4. Click **Settings** in the nav — page loads with provider radio + two key fields.
5. Toggle provider — radio updates, "(active)" label moves.
6. Click **Reveal** on each key — value swaps from masked to full dummy string.
7. Click **Save settings** — success toast appears.
8. Click **Cancel** — provider + reveal states reset.

## 10. Rollback

Single-PR change. Revert the PR to restore the previous dashboard. Mock data file and components can be left in place (unreferenced) if a partial revert is needed.

## 11. Polaris element name verification

The spec references specific Polaris web component names (`s-choice-list`, `s-text-field`, `s-badge`, `s-button`, `s-app-nav`, `s-link`) based on the existing codebase patterns and Shopify's documented set. During implementation planning, the engineer should verify each element name and its supported attributes against the current Polaris web components catalog (via the `shopify-polaris-app-home` skill or Shopify dev docs). If an exact match is unavailable, fall back to the nearest equivalent and keep the visual outcome described in Section 5.

## 12. Open questions

None — all design choices were made during brainstorming.
