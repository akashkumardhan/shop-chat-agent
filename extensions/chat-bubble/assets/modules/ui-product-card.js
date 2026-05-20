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

function imagePlaceholder() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'swa-product-img-placeholder');
  svg.innerHTML = '<rect width="64" height="64" fill="#f3f4f6"/><path d="M18 46l12-14 8 9 6-7 12 12H18z" fill="#d1d5db"/><circle cx="40" cy="24" r="5" fill="#d1d5db"/>';
  return svg;
}

function priceBlock(product) {
  const currency = product.currency || 'USD';
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    const save = product.compareAtPrice - product.price;
    return el('div', { class: 'swa-product-price-wrap' },
      el('span', { class: 'swa-product-price swa-product-price-sale' }, formatMoney(product.price, currency)),
      el('span', { class: 'swa-product-price-strike' }, formatMoney(product.compareAtPrice, currency)),
      el('span', { class: 'swa-product-save-badge' }, `Save ${formatMoney(save, currency)}`),
    );
  }
  return el('div', { class: 'swa-product-price-wrap' },
    el('span', { class: 'swa-product-price' }, formatMoney(product.price, currency)),
  );
}

function rating(product) {
  if (!product.rating || !product.rating.count || product.rating.count < 3) return null;
  return el('div', { class: 'swa-product-rating' },
    `★ ${product.rating.average.toFixed(1)} · ${product.rating.count} reviews`);
}

function variantPicker(product) {
  // product.variants is already the processed flat array from formatProductData
  if (!Array.isArray(product.variants) || product.variants.length < 2) return null;

  const wrap = el('div', { class: 'swa-product-variants' });
  let selectedId = (product.variants.find(v => v.available) || product.variants[0]).id;

  for (const v of product.variants) {
    const chip = el('button', {
      class: 'swa-variant-chip',
      type: 'button',
      title: v.available ? '' : 'Out of stock',
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

const cartIconSVG = `<svg class="swa-atc-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M1 1h2l.8 4m0 0L5.5 13h9l2-8H3.8z"/><circle cx="7" cy="17" r="1.2"/><circle cx="14" cy="17" r="1.2"/></svg>`;

function createATCBtn({ product, getVariantId, onSuccess }) {
  const isSoldOut = product.status === 'sold_out';
  const btn = el('button', {
    class: 'swa-product-atc',
    type: 'button',
    dataset: { state: isSoldOut ? 'disabled' : 'default' },
  });
  btn.innerHTML = isSoldOut
    ? 'Notify me when available'
    : `${cartIconSVG}<span>Add to Cart</span>`;

  if (isSoldOut) return btn;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.state === 'loading' || btn.dataset.state === 'disabled') return;
    btn.dataset.state = 'loading';
    btn.innerHTML = '<span class="swa-atc-spinner"></span><span>Adding…</span>';
    try {
      const variantId = getVariantId() || product.variantId || product.id;
      const cart = await addToCart({ variantId, quantity: 1 });
      btn.dataset.state = 'success';
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2,8 6,12 14,4"/></svg><span>Added to Cart!</span>`;

      const existing = btn.parentElement?.querySelector('.swa-atc-checkout-link');
      if (!existing && btn.parentElement) {
        const link = el('a', {
          class: 'swa-atc-checkout-link',
          href: '/checkout',
          target: '_blank',
          rel: 'noopener',
        }, 'Proceed to Checkout →');
        btn.after(link);
      }
      onSuccess && onSuccess(cart);
    } catch (err) {
      console.error('[swa] ATC error', err);
      btn.dataset.state = 'error';
      btn.innerHTML = `<span>Couldn't add — Retry</span>`;
      setTimeout(() => {
        btn.dataset.state = 'default';
        btn.innerHTML = `${cartIconSVG}<span>Add to Cart</span>`;
      }, 3000);
    }
  });
  return btn;
}

export function createProductCard(product, { onATCSuccess } = {}) {
  const imgWrap = el('div', { class: 'swa-product-image' });
  if (product.image) {
    imgWrap.appendChild(el('img', { src: product.image, alt: product.title, loading: 'lazy' }));
  } else {
    imgWrap.appendChild(imagePlaceholder());
  }
  const badge = statusBadge(product.status);
  if (badge) imgWrap.appendChild(badge);

  const meta = el('div', { class: 'swa-product-meta' },
    el('div', { class: 'swa-product-title' }, product.title),
    product.subtitle ? el('div', { class: 'swa-product-subtitle' }, product.subtitle) : null,
    rating(product),
  );

  const variants = variantPicker(product);
  const atc = createATCBtn({
    product,
    getVariantId: () => variants?.getSelected(),
    onSuccess: onATCSuccess,
  });

  const viewLink = product.url && product.url !== '#'
    ? el('a', { class: 'swa-product-view-link', href: product.url, target: '_blank', rel: 'noopener' }, 'View Details')
    : null;

  let imgSlot;
  if (product.url && product.url !== '#') {
    imgSlot = el('a', { class: 'swa-product-link', href: product.url, target: '_blank', rel: 'noopener' });
  } else {
    imgSlot = el('div', { class: 'swa-product-link' });
  }
  imgSlot.appendChild(imgWrap);

  const card = el('div', { class: 'swa-product' },
    imgSlot,
    el('div', { class: 'swa-product-info' },
      el('div', { class: 'swa-product-row1' }, meta, priceBlock(product)),
      variants ? variants.node : null,
      atc,
      viewLink,
    ),
  );

  return card;
}

export function createProductCarousel(items, { onATCSuccess } = {}) {
  const carousel = el('div', { class: 'swa-product-carousel' });
  for (const p of items) {
    const mini = el('div', { class: 'swa-product-mini' });

    // Image area
    const imgWrap = el('div', { class: 'swa-product-image' });
    if (p.image) {
      imgWrap.appendChild(el('img', { src: p.image, alt: p.title, loading: 'lazy' }));
    } else {
      imgWrap.appendChild(imagePlaceholder());
    }
    const badge = statusBadge(p.status);
    if (badge) imgWrap.appendChild(badge);

    const imgSlot = p.url && p.url !== '#'
      ? el('a', { class: 'swa-product-mini-img-link', href: p.url, target: '_blank', rel: 'noopener' }, imgWrap)
      : imgWrap;

    // Price display
    const priceEl = el('div', { class: 'swa-product-price' }, formatMoney(p.price, p.currency || 'USD'));

    // Variant chips (compact, max 4)
    let variantChips = null;
    if (Array.isArray(p.variants) && p.variants.length >= 2 && p.variants.length <= 6) {
      let selectedVariantId = (p.variants.find(v => v.available) || p.variants[0]).id;
      variantChips = el('div', { class: 'swa-product-variants swa-product-variants--mini' });
      for (const v of p.variants.slice(0, 4)) {
        const chip = el('button', {
          class: 'swa-variant-chip',
          type: 'button',
          title: v.available ? '' : 'Out of stock',
          dataset: { selected: v.id === selectedVariantId ? 'true' : 'false', unavailable: v.available ? 'false' : 'true' },
        }, v.label);
        if (!v.available) chip.disabled = true;
        chip.addEventListener('click', () => {
          selectedVariantId = v.id;
          for (const c of variantChips.children) c.dataset.selected = 'false';
          chip.dataset.selected = 'true';
          // Update price display
          const vd = p.variants.find(x => x.id === selectedVariantId);
          if (vd) priceEl.textContent = formatMoney(vd.price, vd.currency || p.currency || 'USD');
        });
        variantChips.appendChild(chip);
      }
      if (p.variants.length > 4) {
        variantChips.appendChild(el('span', { class: 'swa-variant-more' }, `+${p.variants.length - 4}`));
      }
    }

    // ATC button for mini card
    const isSoldOut = p.status === 'sold_out';
    const atcMini = el('button', {
      class: 'swa-product-atc-mini',
      type: 'button',
      dataset: { state: isSoldOut ? 'disabled' : 'default' },
      disabled: isSoldOut,
    }, isSoldOut ? 'Sold Out' : 'Add to Cart');

    if (!isSoldOut) {
      atcMini.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (atcMini.disabled) return;
        atcMini.disabled = true;
        atcMini.textContent = 'Adding…';
        try {
          const cart = await addToCart({ variantId: p.variantId || p.id, quantity: 1 });
          atcMini.textContent = '✓ Added';
          atcMini.dataset.state = 'success';

          const existing = mini.querySelector('.swa-atc-checkout-link');
          if (!existing) {
            const link = el('a', {
              class: 'swa-atc-checkout-link swa-atc-checkout-link--mini',
              href: '/checkout',
              target: '_blank',
              rel: 'noopener',
            }, 'Checkout →');
            mini.appendChild(link);
          }
          onATCSuccess && onATCSuccess(cart);
        } catch {
          atcMini.disabled = false;
          atcMini.textContent = 'Retry';
          setTimeout(() => { atcMini.textContent = 'Add to Cart'; }, 1500);
        }
      });
    }

    const titleEl = p.url && p.url !== '#'
      ? el('a', { class: 'swa-product-title', href: p.url, target: '_blank', rel: 'noopener' }, p.title)
      : el('div', { class: 'swa-product-title' }, p.title);

    mini.append(
      imgSlot,
      el('div', { class: 'swa-product-info' },
        titleEl,
        p.subtitle ? el('div', { class: 'swa-product-subtitle' }, p.subtitle) : null,
        priceEl,
        variantChips,
        atcMini,
      )
    );
    carousel.appendChild(mini);
  }
  return carousel;
}
