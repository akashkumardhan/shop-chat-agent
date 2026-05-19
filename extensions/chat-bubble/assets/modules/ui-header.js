import { el } from './dom.js';
import { createOrb } from './orb.js';

const ICONS = {
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

function iconSvg(pathInner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = pathInner;
  return svg;
}

/**
 * Builds the header. Subscribes to state.shopName and state.isOnline.
 * Returns the DOM node.
 */
export function createHeader({ state }) {
  const orb = createOrb({ size: 32 });

  const name = el('div', { class: 'swa-header-name' });
  const statusDot = el('span', { class: 'swa-status-dot' });
  const statusText = el('span', { class: 'swa-header-status-text' });
  const status = el('div', { class: 'swa-header-status' }, statusDot, statusText);

  const title = el('div', { class: 'swa-header-title' }, name, status);

  const minimizeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Minimize',
  }, iconSvg(ICONS.minus));
  minimizeBtn.addEventListener('click', () => state.set('isOpen', false));

  const closeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Close',
  }, iconSvg(ICONS.close));
  closeBtn.addEventListener('click', () => state.set('isOpen', false));

  const actions = el('div', { class: 'swa-header-actions' }, minimizeBtn, closeBtn);

  const node = el('header', { class: 'swa-header' }, orb, title, actions);

  function render() {
    const shop = state.get('shopName');
    name.textContent = shop ? `${shop} AI` : 'Shopping Assistant';
    const online = state.get('isOnline');
    statusDot.dataset.status = online ? 'online' : 'offline';
    statusText.textContent = online ? 'Online · AI-powered' : 'Offline';
  }
  render();
  state.subscribe('shopName', render);
  state.subscribe('isOnline', render);

  return node;
}
