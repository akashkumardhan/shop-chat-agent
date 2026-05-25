import { StatCard } from './StatCard.jsx';
import { formatCurrency, formatNumber } from './format.js';

/**
 * The canonical Shopify "Metrics card" composition: a single <s-section>
 * containing three <StatCard> tiles in a responsive grid, separated by
 * vertical dividers.
 *
 * On narrow viewports the grid collapses to a single column and the
 * dividers disappear (handled by the container query in
 * gridTemplateColumns).
 */
export function StatCardRow({ stats }) {
  return (
    <s-section padding="base">
      <s-grid
        gridTemplateColumns="@container (inline-size <= 600px) 1fr, 1fr auto 1fr auto 1fr"
        gap="small"
        alignItems="stretch"
      >
        <StatCard
          icon="chat-bubble"
          label="Total Conversations"
          value={formatNumber(stats.totalConversations.value)}
          hint="All chat sessions to date"
          delta={stats.totalConversations.delta}
        />
        <s-divider direction="block" />
        <StatCard
          icon="product"
          label="Product Viewed"
          value={formatNumber(stats.productViewed.value)}
          hint="Products surfaced in chat"
          delta={stats.productViewed.delta}
        />
        <s-divider direction="block" />
        <StatCard
          icon="cash-dollar"
          label="Total Revenue"
          value={formatCurrency({
            amount: stats.totalRevenue.value,
            currencyCode: stats.totalRevenue.currencyCode,
          })}
          hint="Attributed to chat-assisted orders"
          delta={stats.totalRevenue.delta}
        />
      </s-grid>
    </s-section>
  );
}
