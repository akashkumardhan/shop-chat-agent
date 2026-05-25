# Dashboard Polish + Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered reference-app dashboard with a polished merchant-facing dashboard (stat-card row + upgraded SVG line chart + two product-list cards), and add a mock Settings page (provider toggle + masked API key fields) reachable from the embedded app nav. All data is mock; real API auth still flows through env vars.

**Architecture:** New components live under `app/components/dashboard/`. Mock data lives in `app/data/mock-dashboard.server.js`. The dashboard route (`app/routes/app._index.jsx`) becomes a thin composer. The Settings page is a new route (`app/routes/app.settings.jsx`) backed by `SettingsForm.jsx`. The nav link is added to `app/routes/app.jsx`. Pure Polaris web components (`s-*` custom elements); the only place with visual freedom is the inline SVG chart.

**Tech Stack:** React 18, React Router 7, Shopify Polaris web components (HTML custom elements), App Bridge for toasts, Vitest (existing) for unit tests on pure modules.

**Spec reference:** [docs/superpowers/specs/2026-05-25-dashboard-polish-and-settings-design.md](../specs/2026-05-25-dashboard-polish-and-settings-design.md)

---

## File Structure

**New files:**

```
app/
├── components/
│   └── dashboard/
│       ├── format.js               # currency/number/delta formatters
│       ├── StatCard.jsx            # single stat tile
│       ├── StatCardRow.jsx         # 3-up stat grid
│       ├── LineGraph.jsx           # upgraded inline SVG chart
│       ├── ProductList.jsx         # generic ranked product list
│       └── SettingsForm.jsx        # provider toggle + masked key fields
├── data/
│   └── mock-dashboard.server.js    # mock dashboard + settings data + dummy key constants
└── routes/
    └── app.settings.jsx            # new /app/settings route

tests/
├── components/
│   └── dashboard-format.test.js    # tests for format.js
└── data/
    └── mock-dashboard.test.js      # tests for mock data shape + determinism
```

**Modified files:**

```
app/routes/app.jsx              # add Settings link in <s-app-nav>
app/routes/app._index.jsx       # full rewrite as thin composer
```

---

## Task 1: Format helpers (TDD)

**Files:**
- Create: `app/components/dashboard/format.js`
- Test: `tests/components/dashboard-format.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/components/dashboard-format.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatDeltaPercent } from '../../app/components/dashboard/format.js';

describe('formatCurrency', () => {
  it('formats USD with 2 decimals and grouping', () => {
    expect(formatCurrency({ amount: 38412.57, currencyCode: 'USD' }))
      .toBe('$38,412.57');
  });

  it('defaults to USD when currencyCode is missing', () => {
    expect(formatCurrency({ amount: 10 })).toBe('$10.00');
  });

  it('falls back to a plain $ string when Intl throws', () => {
    expect(formatCurrency({ amount: 10, currencyCode: 'NOT-A-CCY' }))
      .toBe('$10.00');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1284)).toBe('1,284');
    expect(formatNumber(5421)).toBe('5,421');
  });
});

describe('formatDeltaPercent', () => {
  it('uses up-arrow + value for positive deltas', () => {
    expect(formatDeltaPercent(8.4)).toBe('↑ 8.4%');
  });

  it('uses down-arrow + absolute value for negative deltas', () => {
    expect(formatDeltaPercent(-3.1)).toBe('↓ 3.1%');
  });

  it('uses right-arrow for zero', () => {
    expect(formatDeltaPercent(0)).toBe('→ 0.0%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dashboard-format.test.js`
Expected: FAIL — `Cannot find module '../../app/components/dashboard/format.js'`

- [ ] **Step 3: Create the format module**

Create `app/components/dashboard/format.js`:

```js
/**
 * Shared formatting helpers for the dashboard components.
 * Pure functions — no React, no DOM, no I/O.
 */

export function formatCurrency({ amount, currencyCode }) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_) {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDeltaPercent(d) {
  const sign = d > 0 ? '↑' : d < 0 ? '↓' : '→';
  return `${sign} ${Math.abs(d).toFixed(1)}%`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dashboard-format.test.js`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/components/dashboard/format.js tests/components/dashboard-format.test.js
git commit -m "feat(dashboard): add shared formatting helpers

formatCurrency, formatNumber, formatDeltaPercent. Pure functions
extracted from the inline helpers in app._index.jsx, now testable.
"
```

---

## Task 2: Mock dashboard data + tests

**Files:**
- Create: `app/data/mock-dashboard.server.js`
- Test: `tests/data/mock-dashboard.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/data/mock-dashboard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  getDashboardMockData,
  getSettingsMockData,
  FULL_DUMMY_CLAUDE,
  FULL_DUMMY_GEMINI,
} from '../../app/data/mock-dashboard.server.js';

describe('getDashboardMockData', () => {
  it('returns the expected top-level shape', () => {
    const data = getDashboardMockData();
    expect(Object.keys(data).sort()).toEqual(
      ['recentPurchased', 'series', 'stats', 'trendingSearched']
    );
  });

  it('returns 14 days of series data, oldest first', () => {
    const { series } = getDashboardMockData();
    expect(series).toHaveLength(14);
    expect(series[0].date < series[13].date).toBe(true);
  });

  it('every series row has all three metrics', () => {
    const { series } = getDashboardMockData();
    for (const row of series) {
      expect(typeof row.date).toBe('string');
      expect(typeof row.conversations).toBe('number');
      expect(typeof row.productViews).toBe('number');
      expect(typeof row.revenue).toBe('number');
    }
  });

  it('returns 5 trending products and 5 recent purchased products', () => {
    const { trendingSearched, recentPurchased } = getDashboardMockData();
    expect(trendingSearched).toHaveLength(5);
    expect(recentPurchased).toHaveLength(5);
  });

  it('stats include precomputed delta', () => {
    const { stats } = getDashboardMockData();
    expect(typeof stats.totalConversations.value).toBe('number');
    expect(typeof stats.totalConversations.delta).toBe('number');
    expect(stats.totalRevenue.currencyCode).toBe('USD');
  });

  it('is deterministic across calls', () => {
    expect(getDashboardMockData()).toEqual(getDashboardMockData());
  });
});

describe('getSettingsMockData', () => {
  it('reads activeProvider from env (gemini default)', () => {
    expect(getSettingsMockData({}).activeProvider).toBe('gemini');
    expect(getSettingsMockData({ LLM_PROVIDER: 'claude' }).activeProvider).toBe('claude');
    expect(getSettingsMockData({ LLM_PROVIDER: 'gemini' }).activeProvider).toBe('gemini');
  });

  it('returns masked keys with last-four exposed', () => {
    const data = getSettingsMockData({});
    expect(data.claudeApiKey.lastFour).toBe('XK4Q');
    expect(data.claudeApiKey.masked.endsWith('XK4Q')).toBe(true);
    expect(data.geminiApiKey.lastFour).toBe('P7Lm');
    expect(data.geminiApiKey.masked.endsWith('P7Lm')).toBe(true);
  });
});

describe('dummy key constants', () => {
  it('full Claude key ends with the masked last-four', () => {
    expect(FULL_DUMMY_CLAUDE.endsWith('XK4Q')).toBe(true);
  });

  it('full Gemini key ends with the masked last-four', () => {
    expect(FULL_DUMMY_GEMINI.endsWith('P7Lm')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/mock-dashboard.test.js`
Expected: FAIL — `Cannot find module '../../app/data/mock-dashboard.server.js'`

- [ ] **Step 3: Create the mock data module**

Create `app/data/mock-dashboard.server.js`:

```js
/**
 * Mock data source for the dashboard and Settings pages.
 * Pure functions; deterministic across calls. Swap-out point when real
 * attribution / Shopify data wiring lands.
 */

export const FULL_DUMMY_CLAUDE = 'sk-ant-DEMO-1a2b3c4d5e6f7g8h9iXK4Q';
export const FULL_DUMMY_GEMINI = 'AIzaSyDEMO1234567890abcdefghP7Lm';

export function getDashboardMockData() {
  return {
    stats: {
      totalConversations: { value: 1284, delta: 8.4 },
      productViewed: { value: 5421, delta: 12.1 },
      totalRevenue: { value: 38412.57, currencyCode: 'USD', delta: 4.2 },
    },
    series: [
      { date: '2026-05-11', conversations: 62, productViews: 244, revenue: 1820.50 },
      { date: '2026-05-12', conversations: 71, productViews: 287, revenue: 2010.10 },
      { date: '2026-05-13', conversations: 58, productViews: 220, revenue: 1660.40 },
      { date: '2026-05-14', conversations: 80, productViews: 310, revenue: 2240.00 },
      { date: '2026-05-15', conversations: 96, productViews: 388, revenue: 2890.75 },
      { date: '2026-05-16', conversations: 102, productViews: 411, revenue: 3120.00 },
      { date: '2026-05-17', conversations: 88, productViews: 360, revenue: 2640.30 },
      { date: '2026-05-18', conversations: 95, productViews: 401, revenue: 2890.20 },
      { date: '2026-05-19', conversations: 110, productViews: 460, revenue: 3340.55 },
      { date: '2026-05-20', conversations: 121, productViews: 502, revenue: 3690.40 },
      { date: '2026-05-21', conversations: 117, productViews: 488, revenue: 3520.80 },
      { date: '2026-05-22', conversations: 126, productViews: 530, revenue: 3810.10 },
      { date: '2026-05-23', conversations: 134, productViews: 565, revenue: 4012.65 },
      { date: '2026-05-24', conversations: 144, productViews: 612, revenue: 4276.82 },
    ],
    trendingSearched: [
      { rank: 1, name: 'Wireless Headphones', searches: 142 },
      { rank: 2, name: 'Yoga Mat', searches: 118 },
      { rank: 3, name: 'Coffee Beans', searches: 96 },
      { rank: 4, name: 'Resistance Bands', searches: 82 },
      { rank: 5, name: 'Water Bottle', searches: 74 },
    ],
    recentPurchased: [
      { rank: 1, name: 'Yoga Mat', price: 24.00, currencyCode: 'USD', purchasedAt: '2h ago' },
      { rank: 2, name: 'Coffee Beans', price: 18.50, currencyCode: 'USD', purchasedAt: '4h ago' },
      { rank: 3, name: 'Wireless Headphones', price: 89.00, currencyCode: 'USD', purchasedAt: '6h ago' },
      { rank: 4, name: 'Water Bottle', price: 14.00, currencyCode: 'USD', purchasedAt: '9h ago' },
      { rank: 5, name: 'Resistance Bands', price: 22.00, currencyCode: 'USD', purchasedAt: '1d ago' },
    ],
  };
}

export function getSettingsMockData(env = process.env) {
  return {
    activeProvider: env.LLM_PROVIDER === 'claude' ? 'claude' : 'gemini',
    claudeApiKey: { masked: '••••••••••••••••XK4Q', lastFour: 'XK4Q' },
    geminiApiKey: { masked: '••••••••••••••••P7Lm', lastFour: 'P7Lm' },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/mock-dashboard.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add app/data/mock-dashboard.server.js tests/data/mock-dashboard.test.js
git commit -m "feat(dashboard): add mock data source for dashboard + settings

Single deterministic source for stats, 14-day series, trending and
recent purchased product lists, and Settings provider/key state.
Real attribution wiring is a follow-up — this is the swap-out point.
"
```

---

## Task 3: StatCard + StatCardRow components

**Files:**
- Create: `app/components/dashboard/StatCard.jsx`
- Create: `app/components/dashboard/StatCardRow.jsx`

No automated test — Polaris web components don't render meaningfully under happy-dom. Verification is manual via the dev server in Task 10.

- [ ] **Step 1: Create StatCard**

Create `app/components/dashboard/StatCard.jsx`:

```jsx
import { formatDeltaPercent } from './format.js';

/**
 * Single stat tile: label, large value, optional trend badge, optional hint.
 * Renders as an s-section so it gets card chrome consistent with the rest
 * of the admin.
 */
export function StatCard({ label, value, hint, delta }) {
  const hasDelta = typeof delta === 'number';
  const tone = !hasDelta ? null : delta > 0 ? 'success' : delta < 0 ? 'critical' : 'info';

  return (
    <s-section padding="base">
      <s-stack gap="extra-tight">
        <s-text variant="bodySm" color="subdued">{label}</s-text>
        <s-stack direction="inline" gap="tight" alignment="center">
          <s-heading>{value}</s-heading>
          {hasDelta ? (
            <s-badge tone={tone}>{formatDeltaPercent(delta)}</s-badge>
          ) : null}
        </s-stack>
        {hint ? (
          <s-text variant="bodySm" color="subdued">{hint}</s-text>
        ) : null}
      </s-stack>
    </s-section>
  );
}
```

- [ ] **Step 2: Create StatCardRow**

Create `app/components/dashboard/StatCardRow.jsx`:

```jsx
import { StatCard } from './StatCard.jsx';
import { formatCurrency, formatNumber } from './format.js';

/**
 * The 3-up stat grid above the chart. Uses s-stack with `distribution="fill"`
 * so the three cards share the row equally and wrap to a column on narrow
 * viewports.
 */
export function StatCardRow({ stats }) {
  return (
    <s-stack direction="inline" distribution="fill" gap="base" wrap>
      <StatCard
        label="Total Conversations"
        value={formatNumber(stats.totalConversations.value)}
        hint="All chat sessions to date"
        delta={stats.totalConversations.delta}
      />
      <StatCard
        label="Product Viewed"
        value={formatNumber(stats.productViewed.value)}
        hint="Products surfaced in chat"
        delta={stats.productViewed.delta}
      />
      <StatCard
        label="Total Revenue"
        value={formatCurrency({
          amount: stats.totalRevenue.value,
          currencyCode: stats.totalRevenue.currencyCode,
        })}
        hint="Attributed to chat-assisted orders"
        delta={stats.totalRevenue.delta}
      />
    </s-stack>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: PASS (or no new errors relative to baseline).

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboard/StatCard.jsx app/components/dashboard/StatCardRow.jsx
git commit -m "feat(dashboard): add StatCard + StatCardRow components

Card-tile presentation for Total Conversations, Product Viewed, and
Total Revenue. Each tile includes a trend-delta badge with Polaris
tone (success/critical/info) wired from precomputed delta values.
"
```

---

## Task 4: LineGraph component (upgraded)

**Files:**
- Create: `app/components/dashboard/LineGraph.jsx`

The LineGraph upgrade over the current inline chart in `app._index.jsx`:

| Aspect | Current | New |
|---|---|---|
| Colors | `#5C6AC4` / `#47C1BF` / `#F49342` | Polaris admin palette: `#5C5F62`, `#005BD3`, `#008060` |
| Y-axis labels | None | One per gridline, right-aligned at `paddingLeft - 6` |
| Area fill | None | Soft fill under each line at `fillOpacity="0.08"` |
| Endpoint dots | r=3.5, no halo | r=4 + 2px white stroke halo |
| Hover | None | Per-day capture rect + tooltip + vertical guide |
| Legend | Below, name only | Above, right-aligned, with latest-day values |
| X-axis | Every 2nd date | All 14 dates abbreviated `M/D` |
| Empty state | None | Centered "No activity in the last 14 days" |

- [ ] **Step 1: Create LineGraph**

Create `app/components/dashboard/LineGraph.jsx`:

```jsx
import { useState } from 'react';
import { formatCurrency, formatNumber } from './format.js';

const COLORS = {
  conversations: '#5C5F62', // Polaris ink
  productViews: '#005BD3',  // Polaris blue
  revenue: '#008060',       // Polaris green
};

const LINES = [
  { key: 'conversations', color: COLORS.conversations, label: 'Conversations' },
  { key: 'productViews', color: COLORS.productViews, label: 'Product views' },
  { key: 'revenue', color: COLORS.revenue, label: 'Revenue' },
];

function formatShortDate(iso) {
  // "2026-05-11" → "5/11"
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function formatSeriesValue(key, value) {
  if (key === 'revenue') return formatCurrency({ amount: value, currencyCode: 'USD' });
  return formatNumber(value);
}

export function LineGraph({ series }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const width = 720;
  const height = 280;
  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 24;
  const paddingBottom = 40;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  if (!series || series.length === 0) return null;

  const totals = series.reduce(
    (acc, d) => acc + d.conversations + d.productViews + d.revenue,
    0
  );

  if (totals === 0) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#6D7175"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 14 }}
          >
            No activity in the last 14 days
          </text>
        </svg>
      </div>
    );
  }

  // Per-series max for normalization. Latest day is the rightmost point.
  const maxes = LINES.reduce((acc, ln) => {
    acc[ln.key] = Math.max(...series.map((d) => d[ln.key])) || 1;
    return acc;
  }, {});

  const x = (i) => paddingLeft + (plotW * i) / (series.length - 1);
  const yNorm = (v, max) => paddingTop + plotH * (1 - v / max);

  // Build a path (M/L) for the line and a closed path for the area fill.
  const buildLinePath = (key) =>
    series
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yNorm(d[key], maxes[key]).toFixed(1)}`)
      .join(' ');

  const buildAreaPath = (key) => {
    const top = series
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yNorm(d[key], maxes[key]).toFixed(1)}`)
      .join(' ');
    const baseRight = `${x(series.length - 1).toFixed(1)} ${(paddingTop + plotH).toFixed(1)}`;
    const baseLeft = `${x(0).toFixed(1)} ${(paddingTop + plotH).toFixed(1)}`;
    return `${top} L ${baseRight} L ${baseLeft} Z`;
  };

  // 5 gridlines including top + bottom.
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => paddingTop + plotH * t);

  // Y-axis labels: percentage of the max-of-all-conversations scale, since
  // the three series have different units. Show conversations ticks on the
  // left axis as the most-readable proxy.
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => Math.round(maxes.conversations * (1 - t))
  );

  const latest = series[series.length - 1];

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Legend with latest-day value next to each label */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        {LINES.map((ln) => (
          <div key={ln.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 2,
                background: ln.color,
                borderRadius: 1,
              }}
            />
            <span style={{ color: '#202223' }}>
              {ln.label} <strong>{formatSeriesValue(ln.key, latest[ln.key])}</strong>
            </span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, fontFamily: 'Inter, sans-serif', fontSize: 11 }}
        role="img"
        aria-label="Last 14 days — conversations, product views, and revenue trend"
      >
        {/* Gridlines */}
        {gridYs.map((gy, i) => (
          <line
            key={`g-${i}`}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={gy}
            y2={gy}
            stroke="#E1E3E5"
            strokeDasharray="2 4"
          />
        ))}

        {/* Y-axis labels */}
        {gridYs.map((gy, i) => (
          <text
            key={`y-${i}`}
            x={paddingLeft - 6}
            y={gy + 4}
            textAnchor="end"
            fill="#6D7175"
          >
            {formatNumber(yLabels[i])}
          </text>
        ))}

        {/* X-axis labels */}
        {series.map((d, i) => (
          <text
            key={`x-${i}`}
            x={x(i)}
            y={height - paddingBottom + 18}
            textAnchor="middle"
            fill="#6D7175"
          >
            {formatShortDate(d.date)}
          </text>
        ))}

        {/* Area fills */}
        {LINES.map((ln) => (
          <path
            key={`area-${ln.key}`}
            d={buildAreaPath(ln.key)}
            fill={ln.color}
            fillOpacity="0.08"
          />
        ))}

        {/* Lines */}
        {LINES.map((ln) => (
          <path
            key={`line-${ln.key}`}
            d={buildLinePath(ln.key)}
            fill="none"
            stroke={ln.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Endpoint dots */}
        {LINES.map((ln) => (
          <circle
            key={`pt-${ln.key}`}
            cx={x(series.length - 1)}
            cy={yNorm(series[series.length - 1][ln.key], maxes[ln.key])}
            r="4"
            fill={ln.color}
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        ))}

        {/* Hover capture columns (invisible) */}
        {series.map((d, i) => {
          const colW = plotW / (series.length - 1);
          return (
            <rect
              key={`cap-${i}`}
              x={x(i) - colW / 2}
              y={paddingTop}
              width={colW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}

        {/* Tooltip + vertical guide */}
        {hoverIdx != null ? (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={paddingTop}
              y2={paddingTop + plotH}
              stroke="#8C9196"
              strokeDasharray="3 3"
            />
            {LINES.map((ln) => (
              <circle
                key={`hp-${ln.key}`}
                cx={x(hoverIdx)}
                cy={yNorm(series[hoverIdx][ln.key], maxes[ln.key])}
                r="4"
                fill={ln.color}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            ))}
            <g transform={`translate(${Math.min(x(hoverIdx) + 8, width - paddingRight - 160)}, ${paddingTop + 4})`}>
              <rect width="160" height="78" rx="6" ry="6" fill="#FFFFFF" stroke="#E1E3E5" />
              <text x="12" y="20" fill="#202223" fontWeight="600">
                {formatShortDate(series[hoverIdx].date)}
              </text>
              {LINES.map((ln, i) => (
                <text key={`tt-${ln.key}`} x="12" y={38 + i * 14} fill="#202223">
                  <tspan fill={ln.color}>● </tspan>
                  {ln.label}: {formatSeriesValue(ln.key, series[hoverIdx][ln.key])}
                </text>
              ))}
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add app/components/dashboard/LineGraph.jsx
git commit -m "feat(dashboard): upgrade inline SVG line chart

Adds Y-axis labels, area fills, hover tooltip with vertical guide,
latest-day values in the legend, Polaris admin colors, and an empty
state. No chart library — still a single inline SVG.
"
```

---

## Task 5: ProductList component

**Files:**
- Create: `app/components/dashboard/ProductList.jsx`

- [ ] **Step 1: Create ProductList**

Create `app/components/dashboard/ProductList.jsx`:

```jsx
/**
 * Compact, text-only ranked product list. Used twice on the dashboard:
 * once for "Trending searched products" and once for "Recent purchased
 * products". The metric prop is a function so each instance picks its
 * own right-aligned text.
 */
export function ProductList({ title, items, metric }) {
  return (
    <s-section heading={title}>
      {!items || items.length === 0 ? (
        <s-text color="subdued">No data yet</s-text>
      ) : (
        <s-stack gap="tight">
          {items.map((item) => (
            <s-stack
              key={`${title}-${item.rank}`}
              direction="inline"
              distribution="equalSpacing"
              alignment="center"
            >
              <s-stack direction="inline" gap="tight">
                <s-text color="subdued">{item.rank}</s-text>
                <s-text>{item.name}</s-text>
              </s-stack>
              <s-text variant="bodySm" color="subdued">{metric(item)}</s-text>
            </s-stack>
          ))}
        </s-stack>
      )}
    </s-section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/dashboard/ProductList.jsx
git commit -m "feat(dashboard): add ProductList component

Generic ranked text-only list (rank · name · metric). Used by both
'Trending searched products' and 'Recent purchased products' with a
per-instance metric formatter.
"
```

---

## Task 6: Rewrite the dashboard route

**Files:**
- Modify (rewrite): `app/routes/app._index.jsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `app/routes/app._index.jsx` with:

```jsx
import { useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { getDashboardMockData } from '../data/mock-dashboard.server';
import { StatCardRow } from '../components/dashboard/StatCardRow.jsx';
import { LineGraph } from '../components/dashboard/LineGraph.jsx';
import { ProductList } from '../components/dashboard/ProductList.jsx';
import { formatCurrency } from '../components/dashboard/format.js';

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

This removes: the inline `LineGraph`, the inline `StatCard`, the inline formatting helpers, the `App template specs` aside, the `Next steps` aside, and the "Congrats on creating a new Shopify app 🎉" section. The `EXTENSION_UUID` and theme editor URL logic disappear with the aside — they aren't used anywhere else.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run existing tests to confirm nothing else broke**

Run: `npm run test`
Expected: PASS. Existing tests do not touch this route.

- [ ] **Step 4: Commit**

```bash
git add app/routes/app._index.jsx
git commit -m "feat(dashboard): rewrite dashboard route as thin composer

Removes the 'App template specs' + 'Next steps' aside sections and
the reference-app 'Congrats' section. Composes the new StatCardRow,
LineGraph, and two ProductList instances. Loader now sources data
from getDashboardMockData().
"
```

---

## Task 7: SettingsForm component

**Files:**
- Create: `app/components/dashboard/SettingsForm.jsx`

- [ ] **Step 1: Create SettingsForm**

Create `app/components/dashboard/SettingsForm.jsx`:

```jsx
import { useState } from 'react';
import { FULL_DUMMY_CLAUDE, FULL_DUMMY_GEMINI } from '../../data/mock-dashboard.server';

/**
 * Mock settings form: provider toggle + two read-only masked API key
 * fields. No persistence — Save shows a toast, Cancel resets local
 * state. Refresh resets everything (matches the loader's env-derived
 * defaults).
 */
export function SettingsForm({ activeProvider, claudeApiKey, geminiApiKey }) {
  const [provider, setProvider] = useState(activeProvider);
  const [claudeRevealed, setClaudeRevealed] = useState(false);
  const [geminiRevealed, setGeminiRevealed] = useState(false);

  function handleSave() {
    if (typeof shopify !== 'undefined' && shopify?.toast?.show) {
      shopify.toast.show('Settings saved', { isError: false });
    } else {
      console.log('Settings saved (toast unavailable)');
    }
  }

  function handleCancel() {
    setProvider(activeProvider);
    setClaudeRevealed(false);
    setGeminiRevealed(false);
  }

  function providerLabel(key, label) {
    return provider === key ? `${label} (active)` : label;
  }

  return (
    <>
      <s-section heading="Active provider">
        <s-text variant="bodySm" color="subdued">
          Choose which LLM powers the chat agent.
        </s-text>
        <s-choice-list
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <s-choice value="claude">{providerLabel('claude', 'Anthropic Claude')}</s-choice>
          <s-choice value="gemini">{providerLabel('gemini', 'Google Gemini')}</s-choice>
        </s-choice-list>
      </s-section>

      <s-section heading="Anthropic Claude API key">
        <s-stack gap="tight">
          <s-stack direction="inline" gap="tight" alignment="center">
            <s-text-field
              label="Anthropic Claude API key"
              labelHidden
              readOnly
              type={claudeRevealed ? 'text' : 'password'}
              value={claudeRevealed ? FULL_DUMMY_CLAUDE : claudeApiKey.masked}
            />
            <s-button onClick={() => setClaudeRevealed((v) => !v)}>
              {claudeRevealed ? 'Hide' : 'Reveal'}
            </s-button>
          </s-stack>
          <s-text variant="bodySm" color="subdued">
            Get your key at{' '}
            <s-link href="https://console.anthropic.com/" target="_blank">
              console.anthropic.com
            </s-link>
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Google Gemini API key">
        <s-stack gap="tight">
          <s-stack direction="inline" gap="tight" alignment="center">
            <s-text-field
              label="Google Gemini API key"
              labelHidden
              readOnly
              type={geminiRevealed ? 'text' : 'password'}
              value={geminiRevealed ? FULL_DUMMY_GEMINI : geminiApiKey.masked}
            />
            <s-button onClick={() => setGeminiRevealed((v) => !v)}>
              {geminiRevealed ? 'Hide' : 'Reveal'}
            </s-button>
          </s-stack>
          <s-text variant="bodySm" color="subdued">
            Get your key at{' '}
            <s-link href="https://aistudio.google.com/apikey" target="_blank">
              aistudio.google.com/apikey
            </s-link>
          </s-text>
        </s-stack>
      </s-section>

      <s-stack direction="inline" gap="tight" distribution="trailing">
        <s-button onClick={handleCancel}>Cancel</s-button>
        <s-button variant="primary" onClick={handleSave}>
          Save settings
        </s-button>
      </s-stack>
    </>
  );
}
```

> **Implementation note:** Some of the element names above (`s-choice-list`, `s-choice`, `s-text-field`, `s-badge`, `s-button`) follow Shopify's documented Polaris web component naming convention. If any name turns out to differ in the live catalog (the engineer should verify via the `shopify-polaris-app-home` skill or shopify.dev docs), substitute the correct element while keeping the visual outcome described in the spec (§5.5). For example, if the radio component is `s-radio-group`/`s-radio` instead, adjust the JSX and event handler accordingly.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/dashboard/SettingsForm.jsx
git commit -m "feat(settings): add SettingsForm component

Provider toggle (Claude / Gemini) + two read-only masked API key
fields with per-field Reveal buttons. Save triggers an App Bridge
toast; Cancel resets local state. No persistence — purely a UI
demonstration.
"
```

---

## Task 8: Settings route

**Files:**
- Create: `app/routes/app.settings.jsx`

- [ ] **Step 1: Create the route**

Create `app/routes/app.settings.jsx`:

```jsx
import { useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { getSettingsMockData } from '../data/mock-dashboard.server';
import { SettingsForm } from '../components/dashboard/SettingsForm.jsx';

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

No `action` export — Save is handled client-side via App Bridge.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/routes/app.settings.jsx
git commit -m "feat(settings): add /app/settings route

Authenticated admin route that renders SettingsForm with values
sourced from getSettingsMockData(). No action handler — the form
is purely client-side.
"
```

---

## Task 9: Add Settings link to the app nav

**Files:**
- Modify: `app/routes/app.jsx`

- [ ] **Step 1: Edit the nav**

In `app/routes/app.jsx`, find:

```jsx
<s-app-nav>
  <s-link href="/app">Home</s-link>
</s-app-nav>
```

Replace with:

```jsx
<s-app-nav>
  <s-link href="/app">Home</s-link>
  <s-link href="/app/settings">Settings</s-link>
</s-app-nav>
```

No other changes to this file.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: PASS. Existing tests are unaffected; new tests from Tasks 1 + 2 stay green.

- [ ] **Step 4: Commit**

```bash
git add app/routes/app.jsx
git commit -m "feat(nav): add Settings link to the embedded app nav

Surfaces the new /app/settings route as a second nav tab next to
Home in the Shopify embedded admin.
"
```

---

## Task 10: Manual smoke test + final cleanup

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Wait for the Shopify CLI to print the preview URL. Open the embedded app from a dev store.

- [ ] **Step 2: Run the smoke-test checklist from spec §9**

Confirm each of the following:

1. `/app` (Home) renders with:
   - 3 stat cards in a row (Total Conversations, Product Viewed, Total Revenue), each with a trend-delta badge.
   - The upgraded line chart with Y-axis labels, area fills, all 14 dates on the X-axis, and a right-aligned legend with the latest-day value next to each label.
   - Two product-list cards side-by-side below the chart: "Trending searched products" (left) with `N searches` metric, "Recent purchased products" (right) with `$P · time-ago` metric.
   - **No** "App template specs" aside, **no** "Next steps" aside, **no** "Congrats on creating a new Shopify app" section.
2. Hovering the chart shows a tooltip with the date and all three series values, plus a vertical dashed guide line that follows the cursor.
3. Clicking **Settings** in the nav navigates to `/app/settings`.
4. The provider radio shows one option pre-selected (matching the `LLM_PROVIDER` env var, default `gemini`).
5. Toggling the radio updates the "(active)" label suffix on the selected option.
6. Clicking **Reveal** on the Claude key swaps the displayed value from masked (`••••••••••••••••XK4Q`) to the full dummy string (`sk-ant-DEMO-1a2b3c4d5e6f7g8h9iXK4Q`). Same behavior on the Gemini key.
7. Clicking **Save settings** shows the green "Settings saved" toast.
8. Clicking **Cancel** resets the provider radio + reveal states.
9. Refreshing the Settings page resets everything to loader defaults (expected, since this is a mock).

- [ ] **Step 3: Resolve Polaris element name issues if any**

If any element does not render or renders as raw HTML (e.g., `s-choice-list` is the wrong name), fix the element name in `SettingsForm.jsx` to match the live catalog and re-test. Commit any fixes separately:

```bash
git add app/components/dashboard/SettingsForm.jsx
git commit -m "fix(settings): correct Polaris element name for <component>"
```

- [ ] **Step 4: Final summary commit (optional)**

If everything passes without changes, no extra commit is needed. If you needed cleanup commits, they're already squashed in the PR.

- [ ] **Step 5: Open a PR**

```bash
git push -u origin improvements-v1
gh pr create --title "Dashboard polish + Settings page (mock)" --body "$(cat <<'EOF'
## Summary

- Removes the reference-app aside cards (`App template specs`, `Next steps`) and the `Congrats` section.
- Restructures the dashboard around 3 stat cards + an upgraded SVG line chart + two product-list cards (Trending / Recent purchased).
- Adds a new `/app/settings` route with a provider toggle and two read-only masked API key fields. Mock UI only — real API auth still flows through env vars.

Spec: `docs/superpowers/specs/2026-05-25-dashboard-polish-and-settings-design.md`
Plan: `docs/superpowers/plans/2026-05-25-dashboard-polish-and-settings.md`

## Test plan

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (new tests for `format.js` and `mock-dashboard.server.js`)
- [ ] Manual smoke checklist from spec §9 completed in a dev store
- [ ] Chart tooltip + vertical guide work on hover
- [ ] Settings toast appears on Save
- [ ] Cancel resets state

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| §2 Goal 1 — remove aside cards + Congrats | Task 6 (rewrite removes them) |
| §2 Goal 2 — 3 stat cards with delta | Tasks 3, 6 |
| §2 Goal 3 — upgraded line chart | Task 4 |
| §2 Goal 4 — two product-list cards | Tasks 5, 6 |
| §2 Goal 5 — Settings page (toggle + masked fields + helper links + toast) | Tasks 7, 8 |
| §2 Goal 6 — pure Polaris | Enforced across Tasks 3–9 |
| §2 Goal 7 — `app/components/dashboard/` reorganization | All component tasks |
| §5.1 StatCard | Task 3 |
| §5.2 StatCardRow | Task 3 |
| §5.3 LineGraph | Task 4 |
| §5.4 ProductList | Task 5 |
| §5.5 SettingsForm | Task 7 |
| §5.6 app.jsx nav | Task 9 |
| §5.7 app._index.jsx rewrite | Task 6 |
| §5.8 app.settings.jsx | Task 8 |
| §6 Mock data shape | Task 2 |
| §7 Formatting helpers | Task 1 |
| §8 Error handling / edge cases | Inline in component code (LineGraph empty state, ProductList empty list, toast fallback) |
| §9 Manual smoke test | Task 10 |
| §11 Polaris name verification | Task 10 Step 3 + inline note in Task 7 |

No gaps.

**Placeholder scan:** No "TBD"/"TODO"/"implement later" in any task. Every code step contains complete code.

**Type consistency:**
- `getDashboardMockData()` returns `{ stats, series, trendingSearched, recentPurchased }` — matches loader destructuring in Task 6.
- `getSettingsMockData()` returns `{ activeProvider, claudeApiKey, geminiApiKey }` — matches `<SettingsForm {...data} />` in Task 8.
- `stats.totalConversations.value` / `.delta` shape — matches `StatCardRow` prop access in Task 3.
- `stats.totalRevenue.currencyCode` — matches `formatCurrency` call in `StatCardRow`.
- `series[i].date / conversations / productViews / revenue` — matches `LineGraph` access in Task 4.
- `FULL_DUMMY_CLAUDE` / `FULL_DUMMY_GEMINI` — exported in Task 2, imported in Task 7.
- `provider === 'claude' | 'gemini'` — consistent across Tasks 2, 7.

No inconsistencies.
