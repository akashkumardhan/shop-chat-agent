import { el } from './dom.js';

/**
 * createToolUseNode — three bouncing dots while a tool runs.
 */
export function createToolUseNode(_block) {
  return el('div', {
    class: 'swa-bubble swa-bubble-assistant swa-typing-indicator',
    role: 'status',
    'aria-label': 'Searching',
  },
    el('span', { class: 'swa-typing-dot' }),
    el('span', { class: 'swa-typing-dot' }),
    el('span', { class: 'swa-typing-dot' }),
  );
}
