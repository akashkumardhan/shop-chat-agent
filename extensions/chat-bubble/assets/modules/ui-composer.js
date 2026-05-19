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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function createComposer({ onSubmit, onAttachImage } = {}) {
  const textarea = el('textarea', {
    class: 'swa-composer-input',
    rows: '1',
    placeholder: 'Type your message…',
    'aria-label': 'Message',
  });

  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    'aria-hidden': 'true',
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

  const pendingImageWrap = el('div', { class: 'swa-composer-pending-image', style: 'display:none' });

  const node = el('form', { class: 'swa-composer' }, attachBtn, fileInput, textarea, sendBtn);

  let pendingImage = null;

  function autoExpand() {
    textarea.style.height = 'auto';
    const max = 4 * 22;
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  }

  function syncEnabled() {
    sendBtn.disabled = textarea.value.trim().length === 0 && !pendingImage;
  }

  function clearImage() {
    pendingImage = null;
    pendingImageWrap.innerHTML = '';
    pendingImageWrap.style.display = 'none';
    attachBtn.dataset.pending = 'false';
    syncEnabled();
  }

  function setPendingImage(image) {
    pendingImage = image;
    pendingImageWrap.innerHTML = '';
    pendingImageWrap.style.display = 'flex';
    pendingImageWrap.appendChild(el('img', { src: image.dataUrl, alt: image.name }));
    pendingImageWrap.appendChild(el('span', null, image.name));
    const remove = el('button', { type: 'button', 'aria-label': 'Remove image' }, '×');
    remove.addEventListener('click', clearImage);
    pendingImageWrap.appendChild(remove);
    attachBtn.dataset.pending = 'true';
    syncEnabled();
  }

  function submit() {
    const text = textarea.value.trim();
    if (!text && !pendingImage) return;
    const payload = { text };
    if (pendingImage) payload.image = pendingImage;
    textarea.value = '';
    clearImage();
    autoExpand();
    syncEnabled();
    onSubmit && onSubmit(payload);
  }

  textarea.addEventListener('input', () => { autoExpand(); syncEnabled(); });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  node.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image too large (max 5MB).');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported.');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      const image = { dataUrl, name: file.name };
      setPendingImage(image);
      onAttachImage && onAttachImage(image);
    } catch {
      alert('Could not read image.');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      textarea.focus();
    }
  });

  return { node, pendingImageNode: pendingImageWrap, submit, focus: () => textarea.focus(), clearImage };
}
