import { el, qs } from './dom.js';

/**
 * Builds the window shell.
 *
 * Returns:
 *   { node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot }
 *
 * The slots are empty DOM nodes that other modules populate.
 */
export function createWindow({ state, launcher }) {
  const headerSlot = el('div', { class: 'swa-window-header-slot' });
  const streamSlot = el('div', { class: 'swa-window-stream-slot' });
  const dockSlot = el('div', { class: 'swa-window-dock-slot' });
  const composerSlot = el('div', { class: 'swa-window-composer-slot' });
  const footerSlot = el('div', { class: 'swa-window-footer-slot' });

  const node = el('div', {
    class: 'swa-window',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Shopping assistant',
    'aria-hidden': 'true',
  }, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot);

  const setViewportVar = () => {
    document.documentElement.style.setProperty('--swa-viewport-height', `${window.innerHeight}px`);
  };
  setViewportVar();
  window.addEventListener('resize', setViewportVar);

  let lastFocused = null;
  state.subscribe('isOpen', (isOpen) => {
    node.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) {
      lastFocused = document.activeElement;
      document.body.classList.add('swa-locked');
      requestAnimationFrame(() => {
        const composerInput = qs('.swa-composer input, .swa-composer textarea', node);
        (composerInput || node).focus();
      });
    } else {
      document.body.classList.remove('swa-locked');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      } else if (launcher) {
        launcher.focus();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.get('isOpen')) {
      state.set('isOpen', false);
    }
  });

  return { node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot };
}
