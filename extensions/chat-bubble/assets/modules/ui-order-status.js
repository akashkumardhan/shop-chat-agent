import { el } from './dom.js';
import { formatMoney, formatQty } from './format.js';

/**
 * Render an order status card.
 *
 * Block shapes supported:
 *   • Legacy: { type: 'order_status', orderNumber, date, status, items, total, currency, trackingUrl }
 *   • Rich (new): { type: 'order_status', order: { name, processedAt,
 *       financialStatus, fulfillmentStatus, cancelledAt, cancelReason,
 *       statusUrl, total, totalAmount, currency, lineItems[], fulfillments[] } }
 *
 * The rich shape is what the server emits today via order_results SSE.
 * The legacy fields are retained for any caller that still constructs
 * blocks by hand.
 */
export function createOrderStatus(block, { onReorder } = {}) {
  // Normalize: prefer block.order if present, else fall back to legacy fields.
  const o = normalize(block);

  const node = el('div', { class: 'swa-order' });

  // ---- Header: order number, date, status pill, optional cancel/refund badges
  const header = el('div', { class: 'swa-order-header' });
  header.appendChild(
    el('div', { class: 'swa-order-number' },
      `Order ${o.orderLabel}${o.dateLabel ? ' · ' + o.dateLabel : ''}`)
  );

  const badges = el('div', { class: 'swa-order-badges' });
  badges.appendChild(
    el('div', {
      class: 'swa-order-status-pill',
      dataset: { status: o.statusKey },
    }, o.statusLabel)
  );
  if (o.financialBadge) {
    badges.appendChild(
      el('div', {
        class: 'swa-order-finance-pill',
        dataset: { tone: o.financialBadge.tone },
      }, o.financialBadge.label)
    );
  }
  header.appendChild(badges);
  node.appendChild(header);

  // ---- Cancellation banner (if cancelled)
  if (o.cancelled) {
    node.appendChild(
      el('div', { class: 'swa-order-cancel-banner' },
        o.cancelReason
          ? `Cancelled — reason: ${o.cancelReason.toLowerCase()}.`
          : 'This order was cancelled.'
      )
    );
  }

  // ---- Items list (top-level summary, up to 3 visible + "+N more")
  const itemsWrap = el('div', { class: 'swa-order-items' });
  const visible = o.items.slice(0, 3);
  for (const item of visible) {
    itemsWrap.appendChild(
      el('div', { class: 'swa-order-item' },
        item.image ? el('img', { src: item.image, alt: item.title, loading: 'lazy' }) : null,
        el('div', { class: 'swa-order-item-meta' }, item.title),
        el('div', { class: 'swa-order-item-qty' }, `× ${formatQty(item.quantity)}`),
      )
    );
  }
  const more = o.items.length - visible.length;
  if (more > 0) {
    itemsWrap.appendChild(el('div', { class: 'swa-order-item-qty' }, `+${more} more`));
  }
  node.appendChild(itemsWrap);

  // ---- Fulfillments / parcels (each with carrier + tracking)
  if (o.fulfillments.length > 0) {
    const fWrap = el('div', { class: 'swa-order-fulfillments' });
    o.fulfillments.forEach((f, i) => {
      const parcel = el('div', { class: 'swa-order-parcel' });

      const head = el('div', { class: 'swa-order-parcel-head' });
      head.appendChild(
        el('span', { class: 'swa-order-parcel-label' },
          o.fulfillments.length > 1
            ? `Parcel ${i + 1} of ${o.fulfillments.length}`
            : 'Shipment'
        )
      );
      if (f.trackingCompany) {
        head.appendChild(
          el('span', { class: 'swa-order-parcel-carrier' }, '· ' + f.trackingCompany)
        );
      }
      parcel.appendChild(head);

      // Items in this parcel (if known)
      if (f.items && f.items.length > 0) {
        const lines = f.items
          .map((it) => `${it.title} × ${formatQty(it.quantity)}`)
          .join(', ');
        parcel.appendChild(el('div', { class: 'swa-order-parcel-items' }, lines));
      }

      // Tracking numbers + links
      if (f.tracking && f.tracking.length > 0) {
        const tWrap = el('div', { class: 'swa-order-parcel-tracking' });
        for (const t of f.tracking) {
          if (t.url) {
            tWrap.appendChild(
              el('a', {
                href: t.url,
                target: '_blank',
                rel: 'noopener',
                class: 'swa-order-track-link',
              }, (t.number ? t.number + ' ↗' : 'Track ↗'))
            );
          } else if (t.number) {
            tWrap.appendChild(
              el('span', { class: 'swa-order-track-number' }, t.number)
            );
          }
        }
        parcel.appendChild(tWrap);
      }

      fWrap.appendChild(parcel);
    });
    node.appendChild(fWrap);
  }

  // ---- Total row
  node.appendChild(
    el('div', { class: 'swa-order-total' },
      el('span', null, 'Total'),
      el('span', null, formatMoney(o.totalAmount, o.currency))
    )
  );

  // ---- Actions: status page (fallback), reorder
  const actions = el('div', { class: 'swa-order-actions' });

  // Show "View status page" when there's no parcel-level tracking link
  // but we have a Shopify-hosted status URL — universal tracker fallback.
  const hasAnyTrackingLink = o.fulfillments.some(
    (f) => (f.tracking || []).some((t) => t.url)
  );
  if (!hasAnyTrackingLink && o.statusUrl) {
    actions.appendChild(
      el('a', {
        class: 'swa-order-track',
        href: o.statusUrl,
        target: '_blank',
        rel: 'noopener',
      }, 'View status page ↗')
    );
  }
  // Legacy single trackingUrl support (older blocks)
  if (o.legacyTrackingUrl && !hasAnyTrackingLink) {
    actions.appendChild(
      el('a', {
        class: 'swa-order-track',
        href: o.legacyTrackingUrl,
        target: '_blank',
        rel: 'noopener',
      }, 'Track ↗')
    );
  }

  if (!o.cancelled) {
    const reorderBtn = el('button', { class: 'swa-order-reorder', type: 'button' }, 'Reorder');
    reorderBtn.addEventListener('click', () => onReorder && onReorder(block));
    actions.appendChild(reorderBtn);
  }

  node.appendChild(actions);
  return node;
}

// ---------- helpers ----------

function normalize(block) {
  const order = block && block.order ? block.order : null;

  // Date string for the header — prefer ISO processedAt → "MMM D, YYYY".
  const iso = order?.processedAt || block?.processedAt;
  const dateLabel = iso ? formatShortDate(iso) : (block?.date || '');

  // Fulfillment status → display label + key for status pill colours.
  const fulfillmentRaw = order?.fulfillmentStatus || block?.status || 'unfulfilled';
  const { statusLabel, statusKey } = labelFulfillmentStatus(fulfillmentRaw, order);

  // Financial status → optional second badge (e.g. "Refunded").
  const financialBadge = financialStatusBadge(order?.financialStatus);

  const items =
    (order?.lineItems && order.lineItems.length > 0)
      ? order.lineItems
      : (block?.items || []);

  const fulfillments = order?.fulfillments || [];

  const cancelled = !!(order?.cancelledAt || order?.cancelReason);
  const cancelReason = order?.cancelReason || null;

  // Order label: keep '#' for legacy where it's stripped; trust the order.name.
  const orderLabel = order?.name
    ? order.name
    : (block?.orderNumber ? `#${block.orderNumber}` : '');

  // Total
  const totalAmount =
    typeof order?.totalAmount === 'number' ? order.totalAmount
    : typeof block?.total === 'number' ? block.total
    : null;
  const currency = order?.currency || block?.currency || 'USD';

  return {
    orderLabel,
    dateLabel,
    statusLabel,
    statusKey,
    financialBadge,
    cancelled,
    cancelReason,
    items,
    fulfillments,
    totalAmount,
    currency,
    statusUrl: order?.statusUrl || null,
    legacyTrackingUrl: block?.trackingUrl || null,
  };
}

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return ''; }
}

function labelFulfillmentStatus(rawStatus, order) {
  if (order?.cancelledAt || order?.cancelReason) {
    return { statusLabel: 'Cancelled', statusKey: 'cancelled' };
  }
  const s = String(rawStatus).toUpperCase();
  switch (s) {
    case 'FULFILLED':
    case 'DELIVERED':
      return { statusLabel: 'Delivered', statusKey: 'delivered' };
    case 'IN_PROGRESS':
    case 'PARTIALLY_FULFILLED':
    case 'PENDING_FULFILLMENT':
      return { statusLabel: 'In progress', statusKey: 'shipped' };
    case 'ON_HOLD':
      return { statusLabel: 'On hold', statusKey: 'unfulfilled' };
    case 'SCHEDULED':
      return { statusLabel: 'Scheduled', statusKey: 'unfulfilled' };
    case 'OPEN':
    case 'UNFULFILLED':
      return { statusLabel: 'Unfulfilled', statusKey: 'unfulfilled' };
    case 'RESTOCKED':
      return { statusLabel: 'Restocked', statusKey: 'unfulfilled' };
    default:
      // For legacy lowercase strings ("shipped", "delivered", "unfulfilled"),
      // preserve them verbatim so existing CSS keeps working.
      if (typeof rawStatus === 'string' && rawStatus) {
        return {
          statusLabel: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
          statusKey: rawStatus.toLowerCase(),
        };
      }
      return { statusLabel: 'Unknown', statusKey: 'unfulfilled' };
  }
}

function financialStatusBadge(raw) {
  if (!raw) return null;
  const s = String(raw).toUpperCase();
  switch (s) {
    case 'PAID':           return null; // expected default — don't double-up with a badge
    case 'REFUNDED':       return { label: 'Refunded',         tone: 'critical' };
    case 'PARTIALLY_REFUNDED': return { label: 'Partial refund', tone: 'warning' };
    case 'PENDING':        return { label: 'Payment pending',   tone: 'warning' };
    case 'AUTHORIZED':     return { label: 'Authorized',        tone: 'info' };
    case 'PARTIALLY_PAID': return { label: 'Partially paid',    tone: 'warning' };
    case 'VOIDED':         return { label: 'Voided',            tone: 'critical' };
    default:               return null;
  }
}
