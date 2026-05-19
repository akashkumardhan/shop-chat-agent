import { el } from './dom.js';

const ICONS = {
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
};

function icon(inner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = inner;
  return svg;
}

/**
 * Builds the composer. Calls onSubmit(value) on Enter or send-button click.
 * onAttach (optional) called on paperclip click.
 */
export function createComposer({ onSubmit, onAttach } = {}) {
  const textarea = el('textarea', {
    class: 'swa-composer-input',
    rows: '1',
    placeholder: 'Type your message…',
    'aria-label': 'Message',
  });

  const attachBtn = el('button', {
    class: 'swa-icon-button swa-composer-attach',
    type: 'button',
    'aria-label': 'Attach image',
  }, icon(ICONS.paperclip));

  const sendBtn = el('button', {
    class: 'swa-composer-send',
    type: 'submit',
    'aria-label': 'Send message',
    disabled: 'disabled',
  }, icon(ICONS.send));

  const node = el('form', { class: 'swa-composer' }, attachBtn, textarea, sendBtn);

  function autoExpand() {
    textarea.style.height = 'auto';
    const max = 4 * 22;
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  }

  function syncEnabled() {
    sendBtn.disabled = textarea.value.trim().length === 0;
  }

  function submit() {
    const val = textarea.value.trim();
    if (!val) return;
    textarea.value = '';
    autoExpand();
    syncEnabled();
    onSubmit && onSubmit(val);
  }

  textarea.addEventListener('input', () => {
    autoExpand();
    syncEnabled();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });

  node.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  attachBtn.addEventListener('click', () => onAttach && onAttach());

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      textarea.focus();
    }
  });

  return { node, submit, focus: () => textarea.focus() };
}
