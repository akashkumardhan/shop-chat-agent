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
