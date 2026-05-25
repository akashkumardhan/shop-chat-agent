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
    claudeApiKey: {
      masked: '••••••••••••••••XK4Q',
      full: FULL_DUMMY_CLAUDE,
      lastFour: 'XK4Q',
    },
    geminiApiKey: {
      masked: '••••••••••••••••P7Lm',
      full: FULL_DUMMY_GEMINI,
      lastFour: 'P7Lm',
    },
  };
}
