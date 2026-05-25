import { describe, it, expect } from 'vitest';
import { mapOrder } from '../../app/services/tools/orderOps-shape.js';

describe('mapOrder', () => {
  const sample = {
    id: 'gid://shopify/Order/1042',
    name: '#1042',
    processedAt: '2026-05-20T10:15:00Z',
    cancelledAt: null,
    cancelReason: null,
    statusPageUrl: 'https://shop.example.com/orders/abc',
    displayFinancialStatus: 'PAID',
    displayFulfillmentStatus: 'IN_PROGRESS',
    currentTotalPriceSet: {
      shopMoney: { amount: '49.99', currencyCode: 'USD' },
    },
    lineItems: {
      nodes: [
        { title: 'Yoga Mat', quantity: 1, image: { url: 'https://cdn/img.jpg', altText: null } },
        { title: 'Water Bottle', quantity: 2, image: null },
      ],
    },
    fulfillments: [
      {
        id: 'gid://shopify/Fulfillment/1',
        status: 'SUCCESS',
        trackingInfo: [
          { number: '1Z999AA10123456784', url: 'https://ups.com/track/...', company: 'UPS' },
        ],
        fulfillmentLineItems: {
          edges: [
            { node: { quantity: 1, lineItem: { title: 'Yoga Mat' } } },
          ],
        },
      },
    ],
  };

  it('maps the basic identifying fields', () => {
    const o = mapOrder(sample);
    expect(o.id).toBe('gid://shopify/Order/1042');
    expect(o.name).toBe('#1042');
    expect(o.processedAt).toBe('2026-05-20T10:15:00Z');
    expect(o.statusUrl).toBe('https://shop.example.com/orders/abc');
  });

  it('exposes financial + fulfillment status verbatim from displayFields', () => {
    const o = mapOrder(sample);
    expect(o.financialStatus).toBe('PAID');
    expect(o.fulfillmentStatus).toBe('IN_PROGRESS');
  });

  it('formats total as a "amount currency" string and exposes amount/currency separately', () => {
    const o = mapOrder(sample);
    expect(o.total).toBe('49.99 USD');
    expect(o.totalAmount).toBe(49.99);
    expect(o.currency).toBe('USD');
  });

  it('maps line items as both rich objects and compact strings', () => {
    const o = mapOrder(sample);
    expect(o.lineItems).toHaveLength(2);
    expect(o.lineItems[0]).toEqual({ title: 'Yoga Mat', quantity: 1, image: 'https://cdn/img.jpg' });
    expect(o.lineItems[1]).toEqual({ title: 'Water Bottle', quantity: 2, image: null });
    expect(o.lineItemsCompact).toEqual(['1× Yoga Mat', '2× Water Bottle']);
  });

  it('maps fulfillments with tracking + items per parcel', () => {
    const o = mapOrder(sample);
    expect(o.fulfillments).toHaveLength(1);
    const f = o.fulfillments[0];
    expect(f.status).toBe('SUCCESS');
    expect(f.trackingCompany).toBe('UPS');
    expect(f.tracking).toEqual([
      { number: '1Z999AA10123456784', url: 'https://ups.com/track/...', company: 'UPS' },
    ]);
    expect(f.items).toEqual([{ title: 'Yoga Mat', quantity: 1 }]);
  });

  it('handles a cancelled order', () => {
    const o = mapOrder({
      ...sample,
      cancelledAt: '2026-05-22T08:00:00Z',
      cancelReason: 'INVENTORY',
    });
    expect(o.cancelledAt).toBe('2026-05-22T08:00:00Z');
    expect(o.cancelReason).toBe('INVENTORY');
  });

  it('handles an order with no fulfillments or line items defensively', () => {
    const o = mapOrder({
      ...sample,
      lineItems: { nodes: [] },
      fulfillments: [],
    });
    expect(o.lineItems).toEqual([]);
    expect(o.lineItemsCompact).toEqual([]);
    expect(o.fulfillments).toEqual([]);
  });
});
