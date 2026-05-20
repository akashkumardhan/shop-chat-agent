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
import { streamChatWithRetry, fetchWelcome } from './modules/api.js';
import { createProactive } from './modules/proactive.js';
import { createErrorBanner, createOfflineBar, createRateLimitPill } from './modules/ui-error-banner.js';
import { openCompareSheet } from './modules/ui-compare-sheet.js';

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
    isOnline: navigator.onLine,
  });
  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const conversation = createConversation();
  let conversationId = null;
  let activeStream = null;
  let currentAssistantTurnId = null;
  let lastSendPayload = null;

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
        console.log('[swa] save cart', email, sms);
        return Promise.resolve();
      },
      onReorder: (orderBlock) => {
        sendMessage({ text: `Reorder #${orderBlock.orderNumber}` });
      },
      onSaveForLater: () => {
        if (currentAssistantTurnId) {
          conversation.appendBlock(currentAssistantTurnId, { type: 'save_cart_card' });
        }
      },
      onAuthSuccess: () => {
        if (lastSendPayload) sendMessage(lastSendPayload);
      },
      onSizingComplete: (answers) => {
        sendMessage({ text: 'My sizing: ' + Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(', ') });
      },
      onCompareOpen: (block) => {
        openCompareSheet(block, { container: window_.node });
      },
    },
  });

  const quickReplies = createQuickReplies({
    onSelect: (chip) => {
      sendMessage({ text: chip.label, intent: chip.intent });
      quickReplies.clear();
    },
  });
  const composer = createComposer({
    onSubmit: (payload) => sendMessage(payload),
    onAttachImage: () => {},
  });
  const footer = buildFooter(config.shopName);

  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.streamSlot.appendChild(stream.pillNode);
  window_.dockSlot.appendChild(quickReplies.node);
  window_.dockSlot.appendChild(composer.pendingImageNode);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  const offlineBar = createOfflineBar();
  offlineBar.style.display = 'none';
  window_.node.insertBefore(offlineBar, window_.node.firstChild);

  root.appendChild(launcherCtl.node);
  root.appendChild(launcherCtl.previewBubble);
  root.appendChild(window_.node);

  stream.bindConversation(conversation);

  function syncOnline(online) {
    state.set('isOnline', online);
    offlineBar.style.display = online ? 'none' : 'block';
  }
  window.addEventListener('online', () => syncOnline(true));
  window.addEventListener('offline', () => syncOnline(false));
  syncOnline(navigator.onLine);

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

  async function showWelcomePanel() {
    const pageType = detectPageType();
    const pageContext = detectPageContext();
    let resolved;
    try {
      resolved = await fetchWelcome({ pageType, pageContext, hasPriorConvo: false });
    } catch {
      resolved = { greeting: 'Hi — what brings you in?', context_line: null, primary_action: null, chips: [] };
    }
    const panel = createWelcomePanel({
      resolved,
      onPrimaryAction: (flowId, label) => { sendMessage({ text: label, flow: flowId }); stream.setWelcome(null); },
      onChip: (intent, label) => { sendMessage({ text: label, intent }); stream.setWelcome(null); },
    });
    stream.setWelcome(panel);
  }

  function sendMessage(payload) {
    if (state.get('rateLimitedUntil') > Date.now()) return;
    lastSendPayload = payload;
    stream.setWelcome(null);

    if (payload.image) {
      conversation.appendUserMessage(payload.text || '(image)');
      const turns = conversation.getTurns();
      const userTurn = turns[turns.length - 1];
      conversation.appendBlock(userTurn.id, { type: 'image_preview', dataUrl: payload.image.dataUrl, alt: payload.image.name });
    } else {
      conversation.appendUserMessage(payload.text || '');
    }

    const assistantTurn = conversation.appendAssistantTurn();
    currentAssistantTurnId = assistantTurn.id;
    if (activeStream) activeStream.cancel();

    activeStream = streamChatWithRetry(
      {
        message: payload.text || '',
        conversation_id: conversationId,
        prompt_type: config.promptType,
        page_context: { page_type: detectPageType(), ...detectPageContext(), ...(payload.intent && { intent: payload.intent }), ...(payload.flow && { flow: payload.flow }) },
        ...(payload.image && { image: payload.image.dataUrl }),
      },
      {
        onEvent: handleEvent,
        onError: (err) => {
          if (err && err.status === 429) {
            handleRateLimit();
            return;
          }
          const banner = createErrorBanner({
            message: 'Connection dropped. Response incomplete.',
            onRetry: () => { banner.remove(); sendMessage(payload); },
          });
          const turnEl = stream.node.querySelector('.swa-turn:last-of-type .swa-turn-blocks');
          if (turnEl) turnEl.appendChild(banner);
        },
        onClose: () => { activeStream = null; },
      }
    );
  }

  function handleRateLimit() {
    state.set('rateLimitedUntil', Date.now() + 5000);
    const dock = window_.dockSlot;
    const { node: pillNode } = createRateLimitPill(5, (remaining) => {
      if (remaining === 0) state.set('rateLimitedUntil', 0);
    });
    dock.appendChild(pillNode);
  }

  function handleEvent(ev) {
    if (!currentAssistantTurnId) return;
    if (ev.type === 'id') { conversationId = ev.conversation_id; return; }
    if (ev.type === 'chunk' && typeof ev.chunk === 'string') {
      conversation.appendTextChunk(currentAssistantTurnId, ev.chunk);
      return;
    }
    if (ev.type === 'tool_use') {
      conversation.appendBlock(currentAssistantTurnId, { type: 'tool_use', label: 'Searching…' });
      return;
    }
    if (ev.type === 'product_results' && Array.isArray(ev.products) && ev.products.length > 0) {
      if (ev.products.length === 1) {
        conversation.appendBlock(currentAssistantTurnId, { type: 'product_card', ...ev.products[0] });
      } else {
        conversation.appendBlock(currentAssistantTurnId, { type: 'product_carousel', items: ev.products });
      }
      return;
    }
    if (ev.type === 'message_complete') return;
    if (ev.type === 'error' && ev.error) {
      conversation.appendBlock(currentAssistantTurnId, { type: 'text', content: `_Error: ${ev.error}_` });
    }
  }

  const proactive = createProactive({
    isOpen: () => state.get('isOpen'),
    onTrigger: ({ copy }) => {
      state.set('pendingMessagePreview', copy);
      state.set('hasUnread', true);
    },
  });

  launcherCtl.previewBubble.addEventListener('click', (e) => {
    if (e.target.matches('[data-dismiss]')) {
      proactive.markDismissed();
      state.set('pendingMessagePreview', null);
      state.set('hasUnread', false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
