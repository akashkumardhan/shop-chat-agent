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
    <s-page heading="Shop chat agent" inlineSize="large">
      {/* Metrics row — canonical metrics-card composition */}
      <StatCardRow stats={stats} />

      {/* Performance trend */}
      <s-section heading="Performance — last 14 days">
        <LineGraph series={series} />
      </s-section>

      {/* Two-column product activity */}
      <s-grid
        gridTemplateColumns="@container (inline-size <= 700px) 1fr, 1fr 1fr"
        gap="base"
      >
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
      </s-grid>
    </s-page>
  );
}
