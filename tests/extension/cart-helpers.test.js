import { describe, it, expect } from 'vitest';
import { normalizeCart, normalizeLine, validateQty } from '../../extensions/chat-bubble/assets/modules/cart.js';

describe('normalizeCart', () => {
  it('extracts the fields we use', () => {
    const c = normalizeCart({
      token: 'abc',
      item_count: 2,
      items_subtotal_price: 14850,
      total_price: 14850,
      currency: 'USD',
      items: [
        { key: 'k1', product_title: 'Halo', variant_title: 'White / 7', quantity: 1, final_line_price: 9900, image: 'img.png' }
      ],
    });
    expect(c.itemCount).toBe(2);
    expect(c.subtotal).toBe(14850);
    expect(c.currency).toBe('USD');
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].title).toBe('Halo');
    expect(c.lines[0].variant).toBe('White / 7');
  });

  it('handles empty cart', () => {
    const c = normalizeCart({ item_count: 0, items_subtotal_price: 0, total_price: 0, items: [] });
    expect(c.itemCount).toBe(0);
    expect(c.lines).toEqual([]);
  });
});

describe('normalizeLine', () => {
  it('falls back to product_title when variant_title is "Default Title"', () => {
    const l = normalizeLine({ key: 'k', product_title: 'X', variant_title: 'Default Title', quantity: 1, final_line_price: 100 });
    expect(l.variant).toBe(null);
  });
});

describe('validateQty', () => {
  it('floors fractional input', () => {
    expect(validateQty(2.7)).toBe(2);
  });
  it('clamps to 0 minimum', () => {
    expect(validateQty(-5)).toBe(0);
  });
  it('coerces null/undefined to 0', () => {
    expect(validateQty(null)).toBe(0);
    expect(validateQty(undefined)).toBe(0);
  });
});
