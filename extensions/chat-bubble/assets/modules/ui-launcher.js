import { el } from './dom.js';
import { createOrb } from './orb.js';

const COLLAPSE_AFTER_MS = 10_000;

export function createLauncher({ state, sizeDesktop = 60, sizeMobile = 56 }) {
  const isMobile = () => window.matchMedia('(max-width: 480px)').matches;
  const baseSize = () => (isMobile() ? sizeMobile : sizeDesktop);

  const orb = createOrb({ size: baseSize() });
  const label = el('span', { class: 'swa-launcher-label' });
  const dot = el('span', { class: 'swa-launcher-unread-dot' });

  const button = el('button', {
    class: 'swa-launcher',
    type: 'button',
    'aria-label': 'Open shopping assistant',
    dataset: { mode: 'circle' },
  }, orb);

  const previewBubble = el('div', {
    class: 'swa-preview-bubble',
    dataset: { visible: 'false' },
    role: 'status',
    'aria-live': 'polite',
  });
  const previewSource = el('div', { class: 'swa-preview-source' });
  const previewBody = el('div', { class: 'swa-preview-body' });
  previewBubble.append(previewSource, previewBody);

  button.addEventListener('click', () => {
    state.set('isOpen', true);
    state.set('hasUnread', false);
    state.set('pendingMessagePreview', null);
  });

  let collapseTimer = null;
  function applyMode() {
    const hasUnread = state.get('hasUnread');
    const isOpen = state.get('isOpen');
    const showPill = hasUnread && !isOpen;

    if (showPill) {
      button.dataset.mode = 'pill';
      button.setAttribute('aria-label', `${state.get('shopName') || 'Shop'} AI — new message`);
      const orbSize = 40;
      orb.style.width = `${orbSize}px`;
      orb.style.height = `${orbSize}px`;
      label.textContent = `${state.get('shopName') || 'Shop'} AI`;
      if (!button.contains(label)) button.append(label, dot);
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => {
        state.set('hasUnread', false);
        state.set('pendingMessagePreview', null);
      }, COLLAPSE_AFTER_MS);
    } else {
      button.dataset.mode = 'circle';
      button.setAttribute('aria-label', 'Open shopping assistant');
      orb.style.width = `${baseSize()}px`;
      orb.style.height = `${baseSize()}px`;
      label.remove();
      dot.remove();
      clearTimeout(collapseTimer);
    }
  }

  function applyPreview() {
    const preview = state.get('pendingMessagePreview');
    const isOpen = state.get('isOpen');
    if (preview && !isOpen) {
      previewSource.textContent = `${state.get('shopName') || 'Shop'} AI · just now`;
      previewBody.textContent = preview;
      previewBubble.dataset.visible = 'true';
    } else {
      previewBubble.dataset.visible = 'false';
    }
  }

  state.subscribe('hasUnread', applyMode);
  state.subscribe('isOpen', applyMode);
  state.subscribe('shopName', applyMode);
  state.subscribe('pendingMessagePreview', applyPreview);
  state.subscribe('isOpen', applyPreview);

  const mql = window.matchMedia('(max-width: 480px)');
  const handle = () => applyMode();
  if (mql.addEventListener) mql.addEventListener('change', handle);

  return { node: button, previewBubble };
}
