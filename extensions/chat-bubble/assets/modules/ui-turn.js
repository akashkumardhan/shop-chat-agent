import { el } from './dom.js';
import { createOrb } from './orb.js';
import { renderMarkdown } from './markdown.js';

/**
 * Builds a turn's DOM node and returns it along with an update() method
 * that re-renders the blocks (used during streaming).
 */
export function createTurnNode(turn) {
  const blocksWrap = el('div', { class: 'swa-turn-blocks' });
  const node = el('div', {
    class: `swa-turn swa-turn-${turn.role}`,
  });

  if (turn.role === 'assistant') {
    node.appendChild(el('div', { class: 'swa-turn-avatar' }, createOrb({ size: 22 })));
  }
  node.appendChild(blocksWrap);

  function renderBlocks() {
    blocksWrap.innerHTML = '';
    for (const block of turn.blocks) {
      blocksWrap.appendChild(renderBlock(block, turn.role));
    }
  }

  renderBlocks();
  return { node, update: renderBlocks };
}

function renderBlock(block, role) {
  if (block.type === 'text') {
    const bubble = el('div', {
      class: `swa-bubble swa-bubble-${role}`,
    });
    if (role === 'assistant') {
      bubble.innerHTML = renderMarkdown(block.content);
    } else {
      bubble.textContent = block.content;
    }
    return bubble;
  }
  if (block.type === 'tool_use') {
    const slot = el('div', { class: 'swa-block-tool-use-slot' });
    import('./ui-tool-use.js').then(({ createToolUseNode }) => {
      slot.replaceWith(createToolUseNode(block));
    });
    return slot;
  }
  return el('div', { class: 'swa-block-unknown', 'data-type': block.type });
}
