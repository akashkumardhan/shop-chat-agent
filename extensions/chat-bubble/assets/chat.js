import { el, qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';
import { createComposer } from './modules/ui-composer.js';
import { createStream } from './modules/ui-stream.js';

function buildFooter(shopName) {
  return el('div', { class: 'swa-footer' },
    `Powered by ${shopName || 'Shop'} AI · `,
    el('a', { href: '#', target: '_blank', rel: 'noopener' }, 'Privacy')
  );
}

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  const window_ = createWindow({ state, launcher });
  const header = createHeader({ state });
  const composer = createComposer({
    onSubmit: (value) => console.log('[swa] message submitted:', value),
    onAttach: () => console.log('[swa] attach clicked'),
  });
  const stream = createStream();
  const footer = buildFooter(config.shopName);

  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  root.appendChild(launcher);
  root.appendChild(window_.node);

  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
    if (isOpen) requestAnimationFrame(() => composer.focus());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
