import { el } from './dom.js';

export function createErrorBanner({ message, retryLabel = 'Retry', onRetry }) {
  const node = el('div', { class: 'swa-error-banner', role: 'status' },
    el('span', { 'aria-hidden': 'true' }, '⚠'),
    el('span', null, message),
  );
  if (onRetry) {
    const btn = el('button', { type: 'button' }, retryLabel);
    btn.addEventListener('click', () => onRetry());
    node.appendChild(btn);
  }
  return node;
}

export function createOfflineBar() {
  const node = el('div', { class: 'swa-offline-bar' },
    el('span', { class: 'dot' }), "You're offline — read-only mode");
  return node;
}

export function createRateLimitPill(secondsRemaining, onTick) {
  const node = el('div', { class: 'swa-ratelimit-pill', role: 'status' },
    `Catching my breath, try again in ${secondsRemaining}s…`);
  let remaining = secondsRemaining;
  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      node.remove();
      onTick && onTick(0);
      return;
    }
    node.textContent = `Catching my breath, try again in ${remaining}s…`;
    onTick && onTick(remaining);
  }, 1000);
  return { node, cancel: () => clearInterval(interval) };
}
