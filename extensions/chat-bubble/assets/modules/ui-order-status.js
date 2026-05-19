import { el } from './dom.js';
import { formatMoney, formatQty } from './format.js';

export function createOrderStatus(block, { onReorder } = {}) {
  const node = el('div', { class: 'swa-order' });

  node.appendChild(el('div', { class: 'swa-order-header' },
    el('div', { class: 'swa-order-number' }, `Order #${block.orderNumber} · ${block.date || ''}`),
    el('div', { class: 'swa-order-status-pill', dataset: { status: block.status } },
      block.status.charAt(0).toUpperCase() + block.status.slice(1)),
  ));

  const itemsWrap = el('div', { class: 'swa-order-items' });
  const visible = (block.items || []).slice(0, 3);
  for (const item of visible) {
    itemsWrap.appendChild(el('div', { class: 'swa-order-item' },
      item.image ? el('img', { src: item.image, alt: item.title, loading: 'lazy' }) : null,
      el('div', { class: 'swa-order-item-meta' }, item.title),
      el('div', { class: 'swa-order-item-qty' }, `× ${formatQty(item.quantity)}`),
    ));
  }
  const more = (block.items || []).length - visible.length;
  if (more > 0) {
    itemsWrap.appendChild(el('div', { class: 'swa-order-item-qty' }, `+${more} more`));
  }
  node.appendChild(itemsWrap);

  node.appendChild(el('div', { class: 'swa-order-total' },
    el('span', null, 'Total'),
    el('span', null, formatMoney(block.total, block.currency)),
  ));

  const actions = el('div', { class: 'swa-order-actions' });
  if (block.trackingUrl && (block.status === 'shipped' || block.status === 'delivered')) {
    actions.appendChild(el('a', {
      class: 'swa-order-track',
      href: block.trackingUrl,
      target: '_blank',
      rel: 'noopener',
    }, 'Track ↗'));
  }
  const reorderBtn = el('button', { class: 'swa-order-reorder', type: 'button' }, 'Reorder');
  reorderBtn.addEventListener('click', () => onReorder && onReorder(block));
  actions.appendChild(reorderBtn);
  node.appendChild(actions);

  return node;
}
