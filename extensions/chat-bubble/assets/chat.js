import { el, qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';
import { createComposer } from './modules/ui-composer.js';
import { createStream } from './modules/ui-stream.js';
import { createQuickReplies } from './modules/ui-quick-replies.js';
import { createConversation } from './modules/conversation.js';
import { createWelcomePanel } from './modules/ui-welcome.js';
import { streamChat, fetchWelcome } from './modules/api.js';

function buildFooter(shopName) {
  return el('div', { class: 'swa-footer' },
    `Powered by ${shopName || 'Shop'} AI · `,
    el('a', { href: '#', target: '_blank', rel: 'noopener' }, 'Privacy')
  );
}

function detectPageType() {
  const path = window.location.pathname;
  if (/^\/products\//.test(path)) return 'pdp';
  if (/^\/collections\//.test(path)) return 'collection';
  if (/^\/cart/.test(path)) return 'cart';
  if (/^\/search/.test(path)) return 'search';
  if (path === '/' || path === '') return 'home';
  if (/^\/blogs\//.test(path)) return 'blog';
  return 'unknown';
}

function detectPageContext() {
  const ctx = {};
  const titleEl = document.querySelector('h1.product__title, h1[itemprop="name"], .product-single__title, h1.product-title');
  if (titleEl) ctx.productTitle = titleEl.textContent.trim();
  return ctx;
}

function truncate(str, n) {
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });
  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const conversation = createConversation();
  let conversationId = null;
  let activeStream = null;
  let currentAssistantTurnId = null;

  // ---------- UI assembly ----------
  const launcherCtl = createLauncher({ state });
  const window_ = createWindow({ state, launcher: launcherCtl.node });
  const header = createHeader({ state });
  const stream = createStream({
    turnCtx: {
      onATCSuccess: (cart) => {
        if (currentAssistantTurnId) {
          conversation.appendBlock(currentAssistantTurnId, { type: 'cart_summary', cart });
        }
      },
      onSaveCartSubmit: ({ email, sms }) => {
        console.log('[swa] save cart for', email, sms);
        return Promise.resolve();
      },
      onReorder: async (orderBlock) => {
        console.log('[swa] reorder requested for order', orderBlock.orderNumber);
      },
      onSaveForLater: () => {
        if (currentAssistantTurnId) {
          conversation.appendBlock(currentAssistantTurnId, { type: 'save_cart_card' });
        }
      },
      onAuthSuccess: () => {
        console.log('[swa] auth success — originating intent should resume in Plan 4');
      },
    },
  });
  const quickReplies = createQuickReplies({
    onSelect: (chip) => {
      sendMessage(chip.label, { intent: chip.intent });
      quickReplies.clear();
    },
  });
  const composer = createComposer({
    onSubmit: (value) => sendMessage(value),
    onAttach: () => console.log('[swa] attach clicked — image upload lands in Plan 4'),
  });
  const footer = buildFooter(config.shopName);

  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.dockSlot.appendChild(quickReplies.node);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  root.appendChild(launcherCtl.node);
  root.appendChild(launcherCtl.previewBubble);
  root.appendChild(window_.node);

  stream.bindConversation(conversation);

  // ---------- Open lifecycle ----------
  let welcomeShown = false;
  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
    if (isOpen) {
      requestAnimationFrame(() => composer.focus());
      if (!welcomeShown) {
        welcomeShown = true;
        showWelcomePanel();
      }
    }
  });

  // ---------- Welcome ----------
  async function showWelcomePanel() {
    const pageType = detectPageType();
    const pageContext = detectPageContext();
    let resolved;
    try {
      resolved = await fetchWelcome({ pageType, pageContext, hasPriorConvo: false });
    } catch (err) {
      console.warn('[swa] welcome fetch failed, falling back to defaults', err);
      resolved = {
        greeting: 'Hi — what brings you in?',
        context_line: null,
        primary_action: null,
        chips: [],
      };
    }
    const panel = createWelcomePanel({
      resolved,
      onPrimaryAction: (flowId, label) => {
        sendMessage(label, { flow: flowId });
        stream.setWelcome(null);
      },
      onChip: (intent, label) => {
        sendMessage(label, { intent });
        stream.setWelcome(null);
      },
    });
    stream.setWelcome(panel);
  }

  // ---------- Send message ----------
  function sendMessage(text, meta = {}) {
    stream.setWelcome(null);
    conversation.appendUserMessage(text);

    const assistantTurn = conversation.appendAssistantTurn();
    currentAssistantTurnId = assistantTurn.id;

    if (activeStream) activeStream.cancel();

    activeStream = streamChat(
      {
        message: text,
        conversation_id: conversationId,
        prompt_type: config.promptType,
        page_context: { page_type: detectPageType(), ...detectPageContext(), ...meta },
      },
      {
        onEvent: handleEvent,
        onError: (err) => {
          conversation.appendBlock(currentAssistantTurnId, {
            type: 'text',
            content: `_Connection error — please try again._`,
          });
          console.error('[swa] stream error', err);
        },
        onClose: () => {
          activeStream = null;
        },
      }
    );
  }

  function handleEvent(ev) {
    if (!currentAssistantTurnId) return;
    if (ev.type === 'id') {
      conversationId = ev.conversation_id;
      return;
    }
    if (ev.type === 'chunk' && typeof ev.chunk === 'string') {
      conversation.appendTextChunk(currentAssistantTurnId, ev.chunk);
      return;
    }
    if (ev.type === 'tool_use') {
      const m = /Calling tool:\s+(\w+)\s+with arguments:\s+(.+)/.exec(ev.tool_use_message || '');
      const label = m ? `Calling ${m[1]}` : 'Searching';
      const params = m ? truncate(m[2], 80) : '';
      conversation.appendBlock(currentAssistantTurnId, { type: 'tool_use', label, params });
      return;
    }
    if (ev.type === 'message_complete') {
      return;
    }
    if (ev.type === 'error' && ev.error) {
      conversation.appendBlock(currentAssistantTurnId, {
        type: 'text',
        content: `_Error: ${ev.error}_`,
      });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
