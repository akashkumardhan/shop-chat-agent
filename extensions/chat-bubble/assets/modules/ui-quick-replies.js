import { el } from './dom.js';

/**
 * Builds the quick-reply dock.
 */
export function createQuickReplies({ onSelect }) {
  const node = el('div', { class: 'swa-quick-replies', role: 'group', 'aria-label': 'Quick replies' });

  function setChips(chips = []) {
    node.innerHTML = '';
    for (const c of chips) {
      const cls = c.isPrimary ? 'swa-chip swa-chip-primary' : 'swa-chip';
      const btn = el('button', {
        class: cls,
        type: 'button',
      }, c.label);
      btn.addEventListener('click', () => onSelect && onSelect(c));
      node.appendChild(btn);
    }
  }

  function clear() {
    node.innerHTML = '';
  }

  return { node, setChips, clear };
}
