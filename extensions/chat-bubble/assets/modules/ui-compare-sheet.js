import { el } from './dom.js';

export function createCompareLink(block, { onOpen } = {}) {
  const node = el('button', { class: 'swa-compare-link', type: 'button' },
    `Compare: ${(block.items || []).map(i => i.title).join(' · ')} ↗`);
  node.addEventListener('click', () => onOpen && onOpen(block));
  return node;
}

export function openCompareSheet(block, { container }) {
  const backdrop = el('div', { class: 'swa-compare-sheet-backdrop' });
  const sheet = el('div', { class: 'swa-compare-sheet', role: 'dialog', 'aria-label': 'Compare products' });

  const closeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Close compare',
  });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  sheet.appendChild(el('div', { class: 'swa-compare-sheet-header' },
    el('div', { class: 'swa-compare-sheet-title' }, 'Compare'),
    closeBtn,
  ));

  const items = block.items || [];
  const attrKeys = [...new Set(items.flatMap(i => Object.keys(i.attrs || {})))];
  const body = el('div', { class: 'swa-compare-sheet-body' });
  const table = el('div', { class: 'swa-compare-table' });
  table.style.setProperty('--cols', String(items.length));

  const head = el('div', { class: 'swa-compare-row head' }, el('div', { class: 'label' }, ''));
  for (const it of items) head.appendChild(el('div', null, it.title));
  table.appendChild(head);

  const thumbs = el('div', { class: 'swa-compare-row' }, el('div', { class: 'label' }, ''));
  for (const it of items) {
    const cell = el('div');
    if (it.image) cell.appendChild(el('img', { class: 'thumb', src: it.image, alt: it.title }));
    else cell.appendChild(el('div', { class: 'thumb' }));
    thumbs.appendChild(cell);
  }
  table.appendChild(thumbs);

  for (const key of attrKeys) {
    const row = el('div', { class: 'swa-compare-row' }, el('div', { class: 'label' }, key));
    for (const it of items) row.appendChild(el('div', null, (it.attrs || {})[key] ?? '—'));
    table.appendChild(row);
  }
  body.appendChild(table);
  sheet.appendChild(body);

  if (block.verdict) sheet.appendChild(el('div', { class: 'swa-compare-verdict' }, `→ ${block.verdict}`));

  function close() {
    sheet.dataset.open = 'false';
    backdrop.dataset.visible = 'false';
    setTimeout(() => { sheet.remove(); backdrop.remove(); }, 320);
  }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  container.append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.dataset.visible = 'true';
    sheet.dataset.open = 'true';
  });

  return { close };
}
