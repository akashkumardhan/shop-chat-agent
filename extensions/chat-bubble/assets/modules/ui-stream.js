import { el } from './dom.js';
import { createTurnNode } from './ui-turn.js';
import { createAutoScroll } from './auto-scroll.js';

export function createStream({ turnCtx = {} } = {}) {
  const welcomeSlot = el('div', { class: 'swa-stream-welcome-slot' });
  const turnsWrap = el('div', { class: 'swa-stream-turns' });
  const newMsgPill = el('button', {
    class: 'swa-new-messages-pill',
    type: 'button',
    'aria-label': 'Scroll to bottom',
    dataset: { visible: 'false' },
  });
  newMsgPill.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 8,10 12,6"/></svg>';
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
  }, welcomeSlot, turnsWrap, newMsgPill);

  const auto = createAutoScroll(node);
  newMsgPill.addEventListener('click', () => {
    auto.forceScrollToBottom();
  });
  auto.onSuspended((paused) => {
    newMsgPill.dataset.visible = paused ? 'true' : 'false';
  });

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
          const ctl = createTurnNode(t, turnCtx);
          turnNodes.set(t.id, ctl);
          turnsWrap.appendChild(ctl.node);
        } else {
          turnNodes.get(t.id).update();
        }
      }
      auto.scrollToBottom();
    }
    conv.subscribe(render);
    render();
  }

  return { node, setWelcome, bindConversation };
}
