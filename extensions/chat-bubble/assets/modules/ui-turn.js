import { el } from './dom.js';
import { createOrb } from './orb.js';
import { renderMarkdown } from './markdown.js';

export function createTurnNode(turn, ctx = {}) {
  const blocksWrap = el('div', { class: 'swa-turn-blocks' });
  const node = el('div', { class: `swa-turn swa-turn-${turn.role}` });

  if (turn.role === 'assistant') {
    node.appendChild(el('div', { class: 'swa-turn-avatar' }, createOrb({ size: 22 })));
  }
  node.appendChild(blocksWrap);

  function renderBlocks() {
    blocksWrap.innerHTML = '';
    for (const block of turn.blocks) {
      blocksWrap.appendChild(renderBlock(block, turn.role, ctx));
    }
  }
  renderBlocks();
  return { node, update: renderBlocks };
}

function renderBlock(block, role, ctx) {
  if (block.type === 'text') {
    const bubble = el('div', { class: `swa-bubble swa-bubble-${role}` });
    if (role === 'assistant') bubble.innerHTML = renderMarkdown(block.content);
    else bubble.textContent = block.content;
    return bubble;
  }
  if (block.type === 'tool_use') {
    const slot = el('div');
    import('./ui-tool-use.js').then(({ createToolUseNode }) => slot.replaceWith(createToolUseNode(block)));
    return slot;
  }
  if (block.type === 'product_card') {
    const slot = el('div');
    import('./ui-product-card.js').then(({ createProductCard }) => slot.replaceWith(createProductCard(block, ctx)));
    return slot;
  }
  if (block.type === 'product_carousel') {
    const slot = el('div');
    import('./ui-product-card.js').then(({ createProductCarousel }) => slot.replaceWith(createProductCarousel(block.items, ctx)));
    return slot;
  }
  if (block.type === 'cart_summary') {
    const slot = el('div');
    import('./ui-cart-summary.js').then(({ createCartSummary }) => {
      const ctl = createCartSummary({ initialCart: block.cart, onSaveForLater: ctx.onSaveForLater });
      slot.replaceWith(ctl.node);
    });
    return slot;
  }
  if (block.type === 'save_cart_card') {
    const slot = el('div');
    import('./ui-save-cart.js').then(({ createSaveCartCard }) =>
      slot.replaceWith(createSaveCartCard({ onSubmit: ctx.onSaveCartSubmit || (() => Promise.resolve()) }))
    );
    return slot;
  }
  if (block.type === 'order_status') {
    const slot = el('div');
    import('./ui-order-status.js').then(({ createOrderStatus }) =>
      slot.replaceWith(createOrderStatus(block, { onReorder: ctx.onReorder }))
    );
    return slot;
  }
  if (block.type === 'auth_prompt') {
    const slot = el('div');
    import('./ui-auth-prompt.js').then(({ createAuthPrompt }) =>
      slot.replaceWith(createAuthPrompt(block, { onSuccess: ctx.onAuthSuccess }))
    );
    return slot;
  }
  return el('div', { class: 'swa-block-unknown', 'data-type': block.type });
}
