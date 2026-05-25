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

  // Y-axis labels: show conversations ticks on the left axis as the most-
  // readable proxy. Series share the X axis but each is normalized to its
  // own max, so the Y labels are necessarily a representative scale.
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
