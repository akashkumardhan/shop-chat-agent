import { el } from './dom.js';

/**
 * createToolUseNode — slim shimmer pill.
 *
 * block: { type: 'tool_use', label?: string, params?: string }
 */
export function createToolUseNode(block) {
  const label = block.label || 'Searching';
  const params = block.params || '';

  return el('div', { class: 'swa-tool-use', role: 'status', 'aria-live': 'polite' },
    el('span', { class: 'swa-tool-use-icon', 'aria-hidden': 'true' }, '⚙'),
    el('span', { class: 'swa-tool-use-label' }, label),
    params ? el('span', { class: 'swa-tool-use-params' }, params) : null,
  );
}
