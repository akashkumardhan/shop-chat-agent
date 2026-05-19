import { el } from './dom.js';
import { createTurnNode } from './ui-turn.js';

/**
 * Stream — subscribes to conversation, renders turns in order.
 */
export function createStream() {
  const welcomeSlot = el('div', { class: 'swa-stream-welcome-slot' });
  const turnsWrap = el('div', { class: 'swa-stream-turns' });
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
  }, welcomeSlot, turnsWrap);

  const turnNodes = new Map();

  function setWelcome(panelNode) {
    welcomeSlot.innerHTML = '';
    if (panelNode) welcomeSlot.appendChild(panelNode);
  }

  function bindConversation(conv) {
    function render() {
      const turns = conv.getTurns();
      for (const t of turns) {
        if (!turnNodes.has(t.id)) {
          const ctl = createTurnNode(t);
          turnNodes.set(t.id, ctl);
          turnsWrap.appendChild(ctl.node);
        } else {
          turnNodes.get(t.id).update();
        }
      }
      node.scrollTop = node.scrollHeight;
    }
    conv.subscribe(render);
    render();
  }

  return { node, setWelcome, bindConversation };
}
