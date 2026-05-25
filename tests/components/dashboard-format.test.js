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
