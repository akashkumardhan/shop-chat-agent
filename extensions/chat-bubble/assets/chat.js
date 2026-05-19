/**
 * Shop AI Chat — root entry.
 * Wires modules to the DOM and starts the widget.
 */
import { createOrb } from './modules/orb.js';
import { el, qs } from './modules/dom.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  // Temporary stub: render an orb at 60px just to verify wiring.
  // ui-launcher.js will replace this in Task 7.
  const stub = el('div', { class: 'swa-stub-launcher' }, createOrb({ size: 60 }));
  root.appendChild(stub);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
