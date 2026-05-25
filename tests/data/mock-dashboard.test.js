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
