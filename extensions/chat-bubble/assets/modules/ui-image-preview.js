import { el } from './dom.js';

export function createImagePreview(block) {
  return el('div', { class: 'swa-image-preview' },
    el('img', { src: block.dataUrl, alt: block.alt || 'Uploaded image', loading: 'lazy' })
  );
}
