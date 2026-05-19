import { describe, it, expect } from 'vitest';
import { formatMoney, formatQty } from '../../extensions/chat-bubble/assets/modules/format.js';

describe('formatMoney', () => {
  it('formats USD cents', () => {
    expect(formatMoney(2499, 'USD')).toBe('$24.99');
  });
  it('handles zero', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });
  it('handles large values with thousands separator', () => {
    expect(formatMoney(1234567, 'USD')).toBe('$12,345.67');
  });
  it('defaults to USD when currency missing', () => {
    expect(formatMoney(100)).toBe('$1.00');
  });
});

describe('formatQty', () => {
  it('formats integer quantity', () => {
    expect(formatQty(1)).toBe('1');
    expect(formatQty(5)).toBe('5');
  });
  it('handles undefined and zero', () => {
    expect(formatQty(undefined)).toBe('0');
    expect(formatQty(0)).toBe('0');
  });
});
