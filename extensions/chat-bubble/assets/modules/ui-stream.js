import { el } from './dom.js';

/**
 * Stub for Plan 1. Renders an empty placeholder.
 * Plan 2 replaces this with the real welcome + turn-list rendering.
 */
export function createStream() {
  const empty = el('div', { class: 'swa-stream-empty' }, 'Chat ready — welcome panel lands in Plan 2.');
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
  }, empty);
  return { node };
}
