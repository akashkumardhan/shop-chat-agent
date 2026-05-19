import { el } from './dom.js';
import { createOrb } from './orb.js';

/**
 * Builds the welcome panel from a resolved welcome bundle.
 */
export function createWelcomePanel({ resolved, onPrimaryAction, onChip }) {
  const node = el('div', { class: 'swa-welcome', role: 'region', 'aria-label': 'Welcome' });

  node.appendChild(el('div', { class: 'swa-welcome-orb' }, createOrb({ size: 52 })));
  node.appendChild(el('div', { class: 'swa-welcome-greeting' }, resolved.greeting));

  if (resolved.context_line) {
    node.appendChild(el('div', { class: 'swa-welcome-context' }, resolved.context_line));
  }

  if (resolved.primary_action) {
    const pa = resolved.primary_action;
    const btn = el('button', { class: 'swa-welcome-hero-button', type: 'button' }, pa.button_text);
    btn.addEventListener('click', () => onPrimaryAction && onPrimaryAction(pa.flow_id, pa.label));
    node.appendChild(
      el('div', { class: 'swa-welcome-hero' },
        el('div', { class: 'swa-welcome-hero-title' }, pa.label),
        el('div', { class: 'swa-welcome-hero-subtitle' }, pa.subtitle),
        btn,
      )
    );
    node.appendChild(el('div', { class: 'swa-welcome-or' }, '— or —'));
  }

  if (resolved.chips && resolved.chips.length) {
    const chipsWrap = el('div', { class: 'swa-welcome-chips' });
    for (const c of resolved.chips) {
      const cls = c.isPrimary ? 'swa-chip swa-chip-primary' : 'swa-chip';
      const chip = el('button', { class: cls, type: 'button' }, c.label);
      chip.addEventListener('click', () => onChip && onChip(c.intent, c.label));
      chipsWrap.appendChild(chip);
    }
    node.appendChild(chipsWrap);
  }

  return node;
}
