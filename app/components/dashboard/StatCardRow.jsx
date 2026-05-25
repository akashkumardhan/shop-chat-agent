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
