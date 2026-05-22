import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const EXTENSION_UUID = "770e3d9e-3fe9-98c2-0c3d-fe71ee70a7db5cc97b39";
const BLOCK_NAME = "chat-interface";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const themeEditorUrl = `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${EXTENSION_UUID}/${BLOCK_NAME}`;

  // TODO: replace with real values once attribution wiring lands.
  // The dummy values below illustrate the eventual shape of the dashboard.
  const stats = {
    totalConversations: 1284,
    productViewed: 5421,
    totalRevenue: { amount: 38_412.57, currencyCode: "USD" },
    // Last 14 days of activity, oldest → newest. Three series share an X axis.
    series: [
      { date: "May 08", conversations: 62, productViews: 244, revenue: 1820.50 },
      { date: "May 09", conversations: 71, productViews: 287, revenue: 2010.10 },
      { date: "May 10", conversations: 58, productViews: 220, revenue: 1660.40 },
      { date: "May 11", conversations: 80, productViews: 310, revenue: 2240.00 },
      { date: "May 12", conversations: 96, productViews: 388, revenue: 2890.75 },
      { date: "May 13", conversations: 102, productViews: 411, revenue: 3120.00 },
      { date: "May 14", conversations: 88, productViews: 360, revenue: 2640.30 },
      { date: "May 15", conversations: 95, productViews: 401, revenue: 2890.20 },
      { date: "May 16", conversations: 110, productViews: 460, revenue: 3340.55 },
      { date: "May 17", conversations: 121, productViews: 502, revenue: 3690.40 },
      { date: "May 18", conversations: 117, productViews: 488, revenue: 3520.80 },
      { date: "May 19", conversations: 126, productViews: 530, revenue: 3810.10 },
      { date: "May 20", conversations: 134, productViews: 565, revenue: 4012.65 },
      { date: "May 21", conversations: 144, productViews: 612, revenue: 4276.82 },
    ],
  };

  return { themeEditorUrl, stats };
};

function formatCurrency({ amount, currencyCode }) {
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

function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

/**
 * Build an inline-SVG line chart for the three series. Pure SVG so we don't
 * pull in a chart library for a single dashboard panel.
 */
function LineGraph({ series }) {
  const width = 720;
  const height = 240;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 32;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  if (!series || series.length === 0) return null;

  const maxConversations = Math.max(...series.map((d) => d.conversations));
  const maxProductViews = Math.max(...series.map((d) => d.productViews));
  const maxRevenue = Math.max(...series.map((d) => d.revenue));

  // Normalise each series to a 0..1 range so we can plot them on a shared axis.
  const x = (i) => paddingLeft + (plotW * i) / (series.length - 1);
  const yNorm = (v, max) => paddingTop + plotH * (1 - v / (max || 1));

  const buildPath = (key, max) =>
    series
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yNorm(d[key], max).toFixed(1)}`)
      .join(" ");

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => paddingTop + plotH * t);

  const lines = [
    { key: "conversations", max: maxConversations, color: "#5C6AC4", label: "Conversations" },
    { key: "productViews", max: maxProductViews, color: "#47C1BF", label: "Product views" },
    { key: "revenue", max: maxRevenue, color: "#F49342", label: "Revenue" },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, fontFamily: "Inter, sans-serif", fontSize: 11 }}
        role="img"
        aria-label="Last 14 days — conversations, product views, and revenue trend"
      >
        {/* gridlines */}
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

        {/* x-axis labels — show every 2nd date to avoid crowding */}
        {series.map((d, i) =>
          i % 2 === 0 ? (
            <text
              key={`x-${i}`}
              x={x(i)}
              y={height - paddingBottom + 18}
              textAnchor="middle"
              fill="#6D7175"
            >
              {d.date}
            </text>
          ) : null
        )}

        {/* lines */}
        {lines.map((ln) => (
          <path
            key={ln.key}
            d={buildPath(ln.key, ln.max)}
            fill="none"
            stroke={ln.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* line endpoints */}
        {lines.map((ln) => (
          <circle
            key={`pt-${ln.key}`}
            cx={x(series.length - 1)}
            cy={yNorm(series[series.length - 1][ln.key], ln.max)}
            r="3.5"
            fill={ln.color}
          />
        ))}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {lines.map((ln) => (
          <div key={`lg-${ln.key}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 2,
                background: ln.color,
                borderRadius: 1,
              }}
            />
            <span style={{ color: "#202223" }}>{ln.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <s-section padding="base">
      <s-stack gap="extra-tight">
        <s-text variant="bodySm" color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        {hint ? <s-text variant="bodySm" color="subdued">{hint}</s-text> : null}
      </s-stack>
    </s-section>
  );
}

export default function Index() {
  const { themeEditorUrl, stats } = useLoaderData();

  return (
    <s-page>
      <ui-title-bar title="Shop chat agent reference app" />

      <s-section heading="Performance — last 14 days">
        <s-stack gap="base" direction="inline" distribution="fill" wrap>
          <StatCard
            label="Total Conversations"
            value={formatNumber(stats.totalConversations)}
            hint="All chat sessions to date"
          />
          <StatCard
            label="Product Viewed"
            value={formatNumber(stats.productViewed)}
            hint="Products surfaced in chat"
          />
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            hint="Attributed to chat-assisted orders"
          />
        </s-stack>

        <s-stack gap="tight" style={{ marginTop: 16 }}>
          <s-text variant="bodySm" color="subdued">
            Showing illustrative data — wire-up of live attribution lands in a follow-up change.
          </s-text>
          <LineGraph series={stats.series} />
        </s-stack>
      </s-section>

      <s-section>
        <s-stack gap="base">
          <s-heading>Congrats on creating a new Shopify app 🎉</s-heading>
          <s-paragraph>
            This is a reference app that adds a chat agent on your storefront,
            which is powered via claude and can connect shopify mcp platform.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="App template specs" slot="aside">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Next steps" slot="aside">
        <s-stack gap="base">
          <s-paragraph>
            The chat widget is a theme app block. After installing the app, you
            must add the block to your active theme so it appears on the
            storefront.
          </s-paragraph>
          <s-link href={themeEditorUrl} target="_blank">
            Enable chat widget in Theme Editor →
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
