import { el } from './dom.js';
import { formatMoney } from './format.js';
import { addToCart } from './cart.js';

function statusBadge(status) {
  if (!status || status === 'in_stock') return null;
  if (status === 'sold_out') {
    return el('div', { class: 'swa-product-badge', 'data-tone': 'danger' }, 'Sold out');
  }
  if (status === 'low_stock') {
    return el('div', { class: 'swa-product-badge', 'data-tone': 'warning' }, 'Low stock');
  }
  if (typeof status === 'object' && status.label) {
    return el('div', { class: 'swa-product-badge' }, status.label);
  }
  return null;
}

function priceBlock(product) {
  const currency = product.currency || 'USD';
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    const save = product.compareAtPrice - product.price;
    return el('div', { class: 'swa-product-price-wrap' },
      el('div', { class: 'swa-product-price swa-product-price-sale' }, formatMoney(product.price, currency)),
      el('div', { class: 'swa-product-price-strike' }, formatMoney(product.compareAtPrice, currency)),
      el('div', { class: 'swa-product-save-badge' }, `Save ${formatMoney(save, currency)}`),
    );
  }
  return el('div', { class: 'swa-product-price-wrap' },
    el('div', { class: 'swa-product-price' }, formatMoney(product.price, currency)),
  );
}

function rating(product) {
  if (!product.rating || !product.rating.count || product.rating.count < 3) return null;
  return el('div', { class: 'swa-product-rating' },
    `★ ${product.rating.average.toFixed(1)} · ${product.rating.count} reviews`);
}

function variantPicker(product) {
  if (!product.variants || product.variants.length < 2 || product.variants.length > 5) return null;
  const wrap = el('div', { class: 'swa-product-variants' });
  let selectedId = product.variants.find(v => v.available)?.id || product.variants[0].id;
  for (const v of product.variants) {
    const chip = el('button', {
      class: 'swa-variant-chip',
      type: 'button',
      dataset: {
        selected: v.id === selectedId ? 'true' : 'false',
        unavailable: v.available ? 'false' : 'true',
      },
    }, v.label);
    if (!v.available) chip.disabled = true;
    chip.addEventListener('click', () => {
      selectedId = v.id;
      for (const c of wrap.children) c.dataset.selected = 'false';
      chip.dataset.selected = 'true';
    });
    wrap.appendChild(chip);
  }
  return { node: wrap, getSelected: () => selectedId };
}

function createATC({ product, getVariantId, onSuccess }) {
  const btn = el('button', { class: 'swa-product-atc', type: 'button', dataset: { state: 'default' } }, 'Add to cart');
  if (product.status === 'sold_out') {
    btn.textContent = 'Notify me';
    btn.dataset.state = 'disabled';
  }
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.state === 'loading' || btn.dataset.state === 'disabled') return;
    btn.dataset.state = 'loading';
    btn.textContent = 'Adding…';
    try {
      const variantId = getVariantId() || product.variantId || product.id;
      const cart = await addToCart({ variantId, quantity: 1 });
      btn.dataset.state = 'success';
      btn.textContent = '✓ Added — View cart';
      setTimeout(() => {
        if (btn.dataset.state === 'success') {
          btn.dataset.state = 'settled';
          btn.textContent = 'Added — View cart';
        }
      }, 3000);
      onSuccess && onSuccess(cart);
    } catch (err) {
      console.error('[swa] ATC error', err);
      btn.dataset.state = 'error';
      btn.textContent = "Couldn't add — Retry";
      setTimeout(() => { btn.dataset.state = 'default'; btn.textContent = 'Add to cart'; }, 3000);
    }
  });
  return btn;
}

export function createProductCard(product, { onATCSuccess } = {}) {
  const imgWrap = el('div', { class: 'swa-product-image' });
  if (product.image) imgWrap.appendChild(el('img', { src: product.image, alt: product.title, loading: 'lazy' }));
  const badge = statusBadge(product.status);
  if (badge) imgWrap.appendChild(badge);

  const meta = el('div', { class: 'swa-product-meta' },
    el('div', { class: 'swa-product-title' }, product.title),
    product.subtitle ? el('div', { class: 'swa-product-subtitle' }, product.subtitle) : null,
    rating(product),
  );

  const variants = variantPicker(product);
  const atc = createATC({
    product,
    getVariantId: () => variants?.getSelected(),
    onSuccess: onATCSuccess,
  });

  const card = el('a', {
    class: 'swa-product',
    href: product.url || '#',
    target: '_blank',
    rel: 'noopener',
  },
    imgWrap,
    el('div', { class: 'swa-product-info' },
      el('div', { class: 'swa-product-row1' }, meta, priceBlock(product)),
      variants ? variants.node : null,
      atc,
    ),
  );

  card.addEventListener('click', (e) => {
    if (e.target.closest('.swa-variant-chip, .swa-product-atc')) e.preventDefault();
  });

  return card;
}

export function createProductCarousel(items, { onATCSuccess } = {}) {
  const carousel = el('div', { class: 'swa-product-carousel' });
  for (const p of items) {
    const mini = el('a', {
      class: 'swa-product-mini',
      href: p.url || '#',
      target: '_blank',
      rel: 'noopener',
    });
    const imgWrap = el('div', { class: 'swa-product-image' });
    if (p.image) imgWrap.appendChild(el('img', { src: p.image, alt: p.title, loading: 'lazy' }));
    const badge = statusBadge(p.status);
    if (badge) imgWrap.appendChild(badge);

    const quickAtc = el('button', { class: 'swa-product-atc-mini', type: 'button', 'aria-label': 'Add to cart' }, '+');
    quickAtc.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const cart = await addToCart({ variantId: p.variantId || p.id, quantity: 1 });
        quickAtc.textContent = '✓';
        setTimeout(() => { quickAtc.textContent = '+'; }, 1500);
        onATCSuccess && onATCSuccess(cart);
      } catch {
        quickAtc.textContent = '!';
        setTimeout(() => { quickAtc.textContent = '+'; }, 1500);
      }
    });
    imgWrap.appendChild(quickAtc);

    mini.append(
      imgWrap,
      el('div', { class: 'swa-product-info' },
        el('div', { class: 'swa-product-title' }, p.title),
        p.subtitle ? el('div', { class: 'swa-product-subtitle' }, p.subtitle) : null,
        el('div', { class: 'swa-product-price' }, formatMoney(p.price, p.currency || 'USD')),
      )
    );
    carousel.appendChild(mini);
  }
  return carousel;
}
