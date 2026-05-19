/**
 * Shop AI Chat — root entry.
 */
import { qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  // Apply merchant brand color as a CSS variable override on the root.
  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  root.appendChild(launcher);

  // Open/close state is observed in Task 8 by ui-window. For now, log it.
  state.subscribe('isOpen', (v) => {
    root.dataset.state = v ? 'open' : 'closed';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
