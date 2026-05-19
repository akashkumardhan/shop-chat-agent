import { el } from './dom.js';

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;

export function createAuthPrompt(block, { onSuccess } = {}) {
  const node = el('div', { class: 'swa-auth' });
  const title = el('div', { class: 'swa-auth-title' }, block.title || 'Sign in to continue');
  const sub = el('div', { class: 'swa-auth-sub' }, block.subtitle || 'Connect your account to see your orders.');

  const btn = el('button', { class: 'swa-auth-button', type: 'button' }, 'Sign in');
  btn.addEventListener('click', () => openAuthPopup(block.authUrl, () => {
    title.remove(); sub.remove(); btn.remove();
    node.appendChild(el('div', { class: 'swa-auth-success' }, '✓ Connected'));
    onSuccess && onSuccess();
  }));

  node.append(title, sub, btn);
  return node;
}

function openAuthPopup(url, onAuthSuccess) {
  const left = window.screenX + (window.innerWidth - POPUP_WIDTH) / 2;
  const top = window.screenY + (window.innerHeight - POPUP_HEIGHT) / 2;
  const popup = window.open(url, 'swa-auth', `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`);
  if (!popup) {
    window.location.href = url;
    return;
  }

  function onMessage(e) {
    if (e.data && e.data.type === 'shop_auth_success') {
      window.removeEventListener('message', onMessage);
      onAuthSuccess();
      try { popup.close(); } catch {
        // ignore: cross-origin or already-closed
      }
    }
  }
  window.addEventListener('message', onMessage);

  const poll = setInterval(() => {
    if (popup.closed) {
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
    }
  }, 500);
}
