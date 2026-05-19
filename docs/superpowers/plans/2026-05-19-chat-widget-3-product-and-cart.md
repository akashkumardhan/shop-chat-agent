# Chat Widget UI — Plan 3: Product & Customer Actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The shopper can shop. After Plan 3 ships: product cards render in chat, ATC works, the cart summary renders inline with qty steppers / remove / discount code, checkout opens, save-cart captures email, auth signs the customer in, order status displays.

**Architecture:** Cart operations use Shopify's native storefront AJAX endpoints (`/cart.js`, `/cart/add.js`, `/cart/change.js`, `/cart/update.js`, `/cart/clear.js`) — no new backend routes needed for cart. A small client-side `cart.js` module wraps these calls. Product, cart-summary, order-status, save-cart, and auth-prompt blocks emitted by the existing `/chat` SSE stream get rendered by new UI modules and dispatched from `ui-turn.js`. The auth prompt reuses the existing OAuth flow already in the repo (`app/routes/auth.callback.jsx`).

**Tech Stack:** No new dependencies. Shopify storefront AJAX API (built into every Shopify storefront) for cart operations.

**Spec reference:** [docs/superpowers/specs/2026-05-19-chat-widget-ui-design.md](../specs/2026-05-19-chat-widget-ui-design.md) — sections §10 (Product card & carousel) and §11 (Customer actions inside the widget).

---

## File Structure

**New files:**

```
extensions/chat-bubble/assets/modules/
  cart.js                  # Shopify AJAX wrappers: get/add/change/update/clear/applyDiscount
  ui-product-card.js       # Single product card + carousel variant
  ui-cart-summary.js       # Cart block: header, line items, discount, subtotal, checkout
  ui-save-cart.js          # Email capture card
  ui-order-status.js       # Order card with status pill, items, tracking, reorder
  ui-auth-prompt.js        # Sign-in card → opens OAuth popup
  format.js                # Money / qty formatting helpers
```

**New test files:**

```
tests/extension/
  cart-helpers.test.js     # cart formula/state tests (no network)
  format.test.js           # money + qty formatting
```

**Modified files:**

```
extensions/chat-bubble/assets/modules/ui-turn.js   # dispatch new block types
extensions/chat-bubble/assets/modules/conversation.js  # appendBlock helpers (no shape change)
extensions/chat-bubble/assets/chat.js              # wire ATC events, auth popup handler
extensions/chat-bubble/assets/chat.css             # append product/cart/auth/save-cart styles
extensions/chat-bubble/assets/test-surfaces.html   # add new surfaces
```

---

## Module responsibilities

| Module | Responsibility |
|---|---|
| `cart.js` | Pure wrappers around Shopify storefront cart AJAX. `getCart()`, `addToCart(items)`, `updateLine(key, quantity)`, `removeLine(key)`, `applyDiscount(code)`, `getCheckoutUrl()`. |
| `format.js` | `formatMoney(cents, currency)`, `formatQty(n)`. Locale-aware. |
| `ui-product-card.js` | Single card with image / title / subtitle / rating / price / status badge / variant picker / ATC button. Also exports `createProductCarousel(items)` for the carousel variant. |
| `ui-cart-summary.js` | Renders a cart summary block. Wires qty steppers, remove, discount expander, checkout button. Refreshes on every action. |
| `ui-save-cart.js` | Email + optional SMS form with explicit consent line. Submit → server stub (we just log for now; real email is post-Plan-3). |
| `ui-order-status.js` | Read-only order card with status pill + items + tracking link + Reorder. |
| `ui-auth-prompt.js` | Inline sign-in card; triggers OAuth popup; morphs to ✓ Connected on success. |

---

## Tasks

### Task 1: Format helpers

**Files:**
- Create: `extensions/chat-bubble/assets/modules/format.js`
- Create: `tests/extension/format.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/extension/format.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatMoney, formatQty } from '../../extensions/chat-bubble/assets/modules/format.js';

describe('formatMoney', () => {
  it('formats USD cents', () => {
    expect(formatMoney(2499, 'USD')).toBe('$24.99');
  });
  it('handles zero', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });
  it('handles large values with thousands separator', () => {
    expect(formatMoney(1234567, 'USD')).toBe('$12,345.67');
  });
  it('defaults to USD when currency missing', () => {
    expect(formatMoney(100)).toBe('$1.00');
  });
});

describe('formatQty', () => {
  it('formats integer quantity', () => {
    expect(formatQty(1)).toBe('1');
    expect(formatQty(5)).toBe('5');
  });
  it('handles undefined and zero', () => {
    expect(formatQty(undefined)).toBe('0');
    expect(formatQty(0)).toBe('0');
  });
});
```

- [ ] **Step 2: Implement format.js**

Create `extensions/chat-bubble/assets/modules/format.js`:

```js
export function formatMoney(cents, currency = 'USD') {
  const value = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatQty(n) {
  if (n == null) return '0';
  return String(Math.max(0, Math.trunc(n)));
}
```

- [ ] **Step 3: Verify tests pass**

```bash
npm test -- format
```

Expected: 6 PASS.

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/modules/format.js tests/extension/format.test.js
git commit -m "feat(widget): add money + qty format helpers"
```

---

### Task 2: Cart helper module

**Files:**
- Create: `extensions/chat-bubble/assets/modules/cart.js`
- Create: `tests/extension/cart-helpers.test.js`

The cart module wraps Shopify's storefront AJAX API. Network calls are integration-level; tests cover the small bits of formatting and validation logic only.

- [ ] **Step 1: Write failing tests**

Create `tests/extension/cart-helpers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeCart, normalizeLine, validateQty } from '../../extensions/chat-bubble/assets/modules/cart.js';

describe('normalizeCart', () => {
  it('extracts the fields we use', () => {
    const c = normalizeCart({
      token: 'abc',
      item_count: 2,
      items_subtotal_price: 14850,
      total_price: 14850,
      currency: 'USD',
      items: [
        { key: 'k1', product_title: 'Halo', variant_title: 'White / 7', quantity: 1, final_line_price: 9900, image: 'img.png' }
      ],
    });
    expect(c.itemCount).toBe(2);
    expect(c.subtotal).toBe(14850);
    expect(c.currency).toBe('USD');
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].title).toBe('Halo');
    expect(c.lines[0].variant).toBe('White / 7');
  });

  it('handles empty cart', () => {
    const c = normalizeCart({ item_count: 0, items_subtotal_price: 0, total_price: 0, items: [] });
    expect(c.itemCount).toBe(0);
    expect(c.lines).toEqual([]);
  });
});

describe('normalizeLine', () => {
  it('falls back to product_title when variant_title is "Default Title"', () => {
    const l = normalizeLine({ key: 'k', product_title: 'X', variant_title: 'Default Title', quantity: 1, final_line_price: 100 });
    expect(l.variant).toBe(null);
  });
});

describe('validateQty', () => {
  it('floors fractional input', () => {
    expect(validateQty(2.7)).toBe(2);
  });
  it('clamps to 0 minimum', () => {
    expect(validateQty(-5)).toBe(0);
  });
  it('coerces null/undefined to 0', () => {
    expect(validateQty(null)).toBe(0);
    expect(validateQty(undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Implement cart.js**

Create `extensions/chat-bubble/assets/modules/cart.js`:

```js
/**
 * cart — Shopify storefront AJAX wrappers.
 *
 * Endpoints used (all built into every Shopify storefront):
 *   GET  /cart.js                 → current cart
 *   POST /cart/add.js             → add items
 *   POST /cart/change.js          → change line qty by key
 *   POST /cart/update.js          → update multiple lines + apply discount
 *   POST /cart/clear.js           → empty cart
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

export function validateQty(n) {
  if (n == null || isNaN(n)) return 0;
  return Math.max(0, Math.floor(Number(n)));
}

export function normalizeLine(line) {
  const variant = line.variant_title && line.variant_title !== 'Default Title'
    ? line.variant_title
    : null;
  return {
    key: line.key,
    title: line.product_title || line.title,
    variant,
    quantity: line.quantity,
    linePrice: line.final_line_price ?? line.line_price ?? 0,
    image: line.image || line.featured_image?.url || null,
    url: line.url || null,
  };
}

export function normalizeCart(cart) {
  if (!cart) return { itemCount: 0, subtotal: 0, total: 0, currency: 'USD', lines: [], token: null };
  return {
    token: cart.token || null,
    itemCount: cart.item_count || 0,
    subtotal: cart.items_subtotal_price || 0,
    total: cart.total_price || 0,
    currency: cart.currency || 'USD',
    discountCode: (cart.cart_level_discount_applications && cart.cart_level_discount_applications[0]?.title) || null,
    lines: (cart.items || []).map(normalizeLine),
  };
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  const text = await res.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = {}; }
  if (!res.ok) {
    const err = new Error(payload.message || payload.description || `${url} failed: ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export async function getCart() {
  const res = await fetch('/cart.js', { headers: JSON_HEADERS });
  return normalizeCart(await res.json());
}

export async function addToCart({ variantId, quantity = 1, properties }) {
  const body = { items: [{ id: variantId, quantity, properties }] };
  await postJson('/cart/add.js', body);
  return getCart();
}

export async function updateLine(key, quantity) {
  await postJson('/cart/change.js', { id: key, quantity: validateQty(quantity) });
  return getCart();
}

export async function removeLine(key) {
  await postJson('/cart/change.js', { id: key, quantity: 0 });
  return getCart();
}

export async function applyDiscount(code) {
  await postJson('/cart/update.js', { discount: code });
  return getCart();
}

export function getCheckoutUrl() {
  return '/checkout';
}
```

- [ ] **Step 3: Verify tests pass**

```bash
npm test -- cart-helpers
```

Expected: 6 PASS.

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/modules/cart.js tests/extension/cart-helpers.test.js
git commit -m "feat(widget): add cart module wrapping Shopify storefront AJAX"
```

---

### Task 3: Product card — base + status badge

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-product-card.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append product card styles)

The product card block in the SSE stream has shape:

```js
{
  type: 'product_card',
  id: string,
  title: string,
  subtitle?: string,
  url?: string,
  image?: string,
  price: number,                 // cents
  compareAtPrice?: number,       // cents — discount strikethrough source
  currency?: string,
  rating?: { average: number, count: number },
  status?: 'in_stock' | 'low_stock' | 'sold_out' | { label, ships_in_days },
  variants?: Array<{ id, label, available: boolean, price?: number }>,
}
```

Carousel block:

```js
{ type: 'product_carousel', items: ProductCard[] }
```

- [ ] **Step 1: Append product card CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Product card
 * ============================================================ */
.swa-product {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  box-shadow: var(--swa-shadow-sm);
  overflow: hidden;
  width: 100%;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  display: block;
  transition: box-shadow var(--swa-duration-base);
}
.swa-product:hover { box-shadow: var(--swa-shadow-md); }
.swa-product-image {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--swa-color-bg-subtle);
  overflow: hidden;
}
.swa-product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.swa-product-badge {
  position: absolute;
  top: var(--swa-space-2);
  left: var(--swa-space-2);
  font-size: var(--swa-text-xs);
  padding: 2px var(--swa-space-2);
  border-radius: var(--swa-radius-full);
  background: rgba(255,255,255,0.95);
  color: var(--swa-color-text-primary);
  font-weight: var(--swa-weight-medium);
}
.swa-product-badge[data-tone="warning"] { background: var(--swa-color-warning-bg); color: var(--swa-color-warning-fg); }
.swa-product-badge[data-tone="danger"]  { background: var(--swa-color-danger-bg); color: var(--swa-color-danger-fg); }
.swa-product-info {
  padding: var(--swa-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--swa-space-1);
}
.swa-product-row1 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--swa-space-3);
}
.swa-product-meta { flex: 1; min-width: 0; }
.swa-product-title {
  font-size: var(--swa-text-base);
  font-weight: var(--swa-weight-medium);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.swa-product-subtitle {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-tertiary);
  margin-top: 2px;
}
.swa-product-rating {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  margin-top: var(--swa-space-1);
}
.swa-product-price-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  white-space: nowrap;
}
.swa-product-price {
  font-size: var(--swa-text-md);
  font-weight: var(--swa-weight-semibold);
  color: var(--swa-color-text-primary);
}
.swa-product-price-sale {
  color: var(--swa-color-brand);
}
.swa-product-price-strike {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  text-decoration: line-through;
}
.swa-product-save-badge {
  font-size: var(--swa-text-xs);
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
  padding: 1px 6px;
  border-radius: var(--swa-radius-sm);
  margin-top: 2px;
}

.swa-product-variants {
  display: flex;
  gap: var(--swa-space-1);
  flex-wrap: wrap;
  margin-top: var(--swa-space-2);
}
.swa-variant-chip {
  font-size: var(--swa-text-xs);
  padding: 3px 8px;
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  background: var(--swa-color-bg);
  cursor: pointer;
  color: var(--swa-color-text-primary);
}
.swa-variant-chip[data-selected="true"] {
  border-color: var(--swa-color-brand);
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
}
.swa-variant-chip[data-unavailable="true"] {
  text-decoration: line-through;
  color: var(--swa-color-text-tertiary);
  cursor: not-allowed;
}

.swa-product-atc {
  margin-top: var(--swa-space-3);
  background: var(--swa-color-text-primary);
  color: var(--swa-color-bg);
  border: none;
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-2);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
  width: 100%;
  transition: background var(--swa-duration-fast), opacity var(--swa-duration-fast);
}
.swa-product-atc:hover { opacity: 0.92; }
.swa-product-atc[data-state="loading"] {
  background: var(--swa-color-text-secondary);
  cursor: wait;
}
.swa-product-atc[data-state="success"] {
  background: var(--swa-color-success-bg);
  color: var(--swa-color-success-fg);
}
.swa-product-atc[data-state="settled"] {
  background: transparent;
  color: var(--swa-color-success-fg);
  border: 1px solid var(--swa-color-success-fg);
}
.swa-product-atc[data-state="error"] {
  background: var(--swa-color-danger-bg);
  color: var(--swa-color-danger-fg);
}

/* Carousel */
.swa-product-carousel {
  display: flex;
  gap: var(--swa-space-2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding-right: 30px; /* reveals 0.5-card peek */
}
.swa-product-carousel::-webkit-scrollbar { display: none; }
.swa-product-carousel .swa-product-mini {
  min-width: 170px;
  max-width: 170px;
  scroll-snap-align: start;
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  display: block;
}
.swa-product-mini .swa-product-image { aspect-ratio: 1 / 1; }
.swa-product-mini .swa-product-info { padding: var(--swa-space-2); }
.swa-product-mini .swa-product-title {
  font-size: var(--swa-text-sm);
  -webkit-line-clamp: 1;
}
.swa-product-mini .swa-product-price {
  font-size: var(--swa-text-sm);
}
.swa-product-mini .swa-product-atc-mini {
  position: absolute;
  bottom: var(--swa-space-2);
  right: var(--swa-space-2);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--swa-color-text-primary);
  color: var(--swa-color-bg);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  box-shadow: var(--swa-shadow-sm);
}
@media (max-width: 480px) {
  .swa-product-carousel .swa-product-mini { min-width: 150px; max-width: 150px; }
}
```

- [ ] **Step 2: Implement ui-product-card.js**

Create `extensions/chat-bubble/assets/modules/ui-product-card.js`:

```js
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

function variantPicker(product, onChange) {
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
      onChange(selectedId);
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
      btn.textContent = 'Couldn\'t add — Retry';
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

  const variants = variantPicker(product, () => {});
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

  // Clicking inside the variant picker or ATC shouldn't navigate.
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
      } catch (err) {
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
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-product-card.js
git commit -m "feat(widget): build product card with ATC + variants + status badge"
```

---

### Task 4: Cart summary block

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-cart-summary.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append cart summary styles)

- [ ] **Step 1: Append cart summary CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Cart summary
 * ============================================================ */
.swa-cart {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  overflow: hidden;
}
.swa-cart-header {
  padding: var(--swa-space-3);
  border-bottom: 1px solid var(--swa-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
}
.swa-cart-header strong { color: var(--swa-color-text-primary); }
.swa-cart-line {
  padding: var(--swa-space-3);
  display: flex;
  gap: var(--swa-space-3);
  border-bottom: 1px solid var(--swa-color-border);
}
.swa-cart-line:last-of-type { border-bottom: none; }
.swa-cart-line-img {
  width: 56px;
  height: 56px;
  border-radius: var(--swa-radius-sm);
  background: var(--swa-color-bg-subtle);
  flex-shrink: 0;
  object-fit: cover;
}
.swa-cart-line-meta { flex: 1; min-width: 0; }
.swa-cart-line-title {
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  color: var(--swa-color-text-primary);
}
.swa-cart-line-variant {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  margin-top: 2px;
}
.swa-cart-line-controls {
  display: flex;
  align-items: center;
  gap: var(--swa-space-2);
  margin-top: var(--swa-space-2);
}
.swa-qty-stepper {
  display: inline-flex;
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  overflow: hidden;
}
.swa-qty-stepper button {
  width: 28px;
  height: 28px;
  background: var(--swa-color-bg);
  border: none;
  cursor: pointer;
  font-size: var(--swa-text-base);
  color: var(--swa-color-text-primary);
}
.swa-qty-stepper button:disabled { color: var(--swa-color-text-tertiary); cursor: not-allowed; }
.swa-qty-stepper button:hover:not(:disabled) { background: var(--swa-color-bg-subtle); }
.swa-qty-stepper .swa-qty-num {
  min-width: 30px;
  text-align: center;
  font-size: var(--swa-text-sm);
  line-height: 28px;
  border-left: 1px solid var(--swa-color-border-strong);
  border-right: 1px solid var(--swa-color-border-strong);
}
.swa-cart-line-remove {
  background: none;
  border: none;
  color: var(--swa-color-text-tertiary);
  cursor: pointer;
  font-size: var(--swa-text-base);
  padding: 0;
}
.swa-cart-line-remove[data-confirm="true"] { color: var(--swa-color-danger-fg); }
.swa-cart-line-price {
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  margin-left: auto;
}

.swa-cart-discount {
  padding: var(--swa-space-3);
  border-top: 1px solid var(--swa-color-border);
  border-bottom: 1px solid var(--swa-color-border);
  font-size: var(--swa-text-sm);
}
.swa-cart-discount-toggle {
  color: var(--swa-color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font: inherit;
}
.swa-cart-discount-form {
  display: flex;
  gap: var(--swa-space-2);
  margin-top: var(--swa-space-2);
}
.swa-cart-discount-form input {
  flex: 1;
  padding: 6px var(--swa-space-2);
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  font: inherit;
}
.swa-cart-discount-error {
  color: var(--swa-color-danger-fg);
  margin-top: var(--swa-space-1);
  font-size: var(--swa-text-xs);
}

.swa-cart-totals {
  padding: var(--swa-space-3);
  font-size: var(--swa-text-sm);
}
.swa-cart-totals-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--swa-space-1);
}
.swa-cart-totals-row.subtotal {
  font-weight: var(--swa-weight-semibold);
  color: var(--swa-color-text-primary);
}
.swa-cart-shipping {
  color: var(--swa-color-text-tertiary);
  font-size: var(--swa-text-xs);
}

.swa-cart-checkout {
  display: block;
  width: 100%;
  background: var(--swa-color-text-primary);
  color: var(--swa-color-bg);
  border: none;
  padding: var(--swa-space-3);
  font-size: var(--swa-text-base);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
.swa-cart-checkout:hover { opacity: 0.92; }
.swa-cart-save-link {
  display: block;
  text-align: center;
  padding: var(--swa-space-2);
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  background: var(--swa-color-bg-subtle);
  border: none;
  cursor: pointer;
  width: 100%;
  font-family: inherit;
}
.swa-cart-empty {
  padding: var(--swa-space-4);
  text-align: center;
  color: var(--swa-color-text-secondary);
  font-size: var(--swa-text-sm);
}
.swa-cart-empty a {
  color: var(--swa-color-brand);
  cursor: pointer;
  text-decoration: underline;
}
```

- [ ] **Step 2: Implement ui-cart-summary.js**

Create `extensions/chat-bubble/assets/modules/ui-cart-summary.js`:

```js
import { el } from './dom.js';
import { formatMoney, formatQty } from './format.js';
import { getCart, updateLine, removeLine, applyDiscount, getCheckoutUrl } from './cart.js';

/**
 * Builds a cart summary node. The block can be rendered standalone (with a
 * fresh cart fetch) or with a snapshot passed in.
 */
export function createCartSummary({ initialCart, onSaveForLater } = {}) {
  const node = el('div', { class: 'swa-cart', role: 'region', 'aria-label': 'Shopping cart' });

  async function render(cart) {
    node.innerHTML = '';
    if (!cart || cart.itemCount === 0) {
      node.appendChild(el('div', { class: 'swa-cart-empty' }, 'Your cart is empty.'));
      return;
    }

    // Header
    node.appendChild(el('div', { class: 'swa-cart-header' },
      el('div', null, el('strong', null, `Cart · ${formatQty(cart.itemCount)} items`)),
      el('div', null, formatMoney(cart.subtotal, cart.currency)),
    ));

    // Lines
    for (const line of cart.lines) {
      const stepper = el('div', { class: 'swa-qty-stepper' });
      const dec = el('button', { type: 'button', 'aria-label': 'Decrease quantity' }, '−');
      const num = el('span', { class: 'swa-qty-num' }, formatQty(line.quantity));
      const inc = el('button', { type: 'button', 'aria-label': 'Increase quantity' }, '+');
      if (line.quantity <= 1) dec.disabled = true;
      stepper.append(dec, num, inc);

      dec.addEventListener('click', async () => {
        if (line.quantity <= 1) return;
        const next = await updateLine(line.key, line.quantity - 1);
        render(next);
      });
      inc.addEventListener('click', async () => {
        const next = await updateLine(line.key, line.quantity + 1);
        render(next);
      });

      const remove = el('button', { class: 'swa-cart-line-remove', type: 'button', 'aria-label': 'Remove item' }, '×');
      remove.addEventListener('click', async () => {
        if (remove.dataset.confirm !== 'true') {
          remove.dataset.confirm = 'true';
          remove.textContent = 'Remove?';
          setTimeout(() => { remove.dataset.confirm = 'false'; remove.textContent = '×'; }, 3000);
          return;
        }
        const next = await removeLine(line.key);
        render(next);
      });

      node.appendChild(el('div', { class: 'swa-cart-line' },
        line.image ? el('img', { class: 'swa-cart-line-img', src: line.image, alt: line.title, loading: 'lazy' }) : el('div', { class: 'swa-cart-line-img' }),
        el('div', { class: 'swa-cart-line-meta' },
          el('div', { class: 'swa-cart-line-title' }, line.title),
          line.variant ? el('div', { class: 'swa-cart-line-variant' }, line.variant) : null,
          el('div', { class: 'swa-cart-line-controls' }, stepper, remove,
            el('div', { class: 'swa-cart-line-price' }, formatMoney(line.linePrice, cart.currency)),
          ),
        ),
      ));
    }

    // Discount expander
    const discountWrap = el('div', { class: 'swa-cart-discount' });
    const toggle = el('button', { class: 'swa-cart-discount-toggle', type: 'button' },
      cart.discountCode ? `Discount: ${cart.discountCode} · Change` : 'Have a code? ▾');
    const form = el('form', { class: 'swa-cart-discount-form', style: 'display:none' },
      el('input', { type: 'text', placeholder: 'Enter code', 'aria-label': 'Discount code' }),
      el('button', { type: 'submit', class: 'swa-chip' }, 'Apply'),
    );
    const errLine = el('div', { class: 'swa-cart-discount-error' });
    toggle.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = form.querySelector('input').value.trim();
      if (!code) return;
      errLine.textContent = '';
      try {
        const next = await applyDiscount(code);
        if (!next.discountCode || next.discountCode.toLowerCase() !== code.toLowerCase()) {
          errLine.textContent = 'Code invalid or expired';
          return;
        }
        render(next);
      } catch {
        errLine.textContent = 'Code invalid or expired';
      }
    });
    discountWrap.append(toggle, form, errLine);
    node.appendChild(discountWrap);

    // Totals
    node.appendChild(el('div', { class: 'swa-cart-totals' },
      el('div', { class: 'swa-cart-totals-row subtotal' },
        el('span', null, 'Subtotal'),
        el('span', null, formatMoney(cart.subtotal, cart.currency)),
      ),
      el('div', { class: 'swa-cart-totals-row swa-cart-shipping' },
        el('span', null, 'Shipping'),
        el('span', null, 'Calculated next step'),
      ),
    ));

    // Actions
    node.appendChild(el('a', { class: 'swa-cart-checkout', href: getCheckoutUrl() }, 'Checkout →'));
    const saveBtn = el('button', { class: 'swa-cart-save-link', type: 'button' }, 'Save cart for later');
    saveBtn.addEventListener('click', () => onSaveForLater && onSaveForLater(cart));
    node.appendChild(saveBtn);
  }

  if (initialCart) {
    render(initialCart);
  } else {
    getCart().then(render).catch((err) => {
      console.warn('[swa] cart fetch failed', err);
      node.appendChild(el('div', { class: 'swa-cart-empty' }, 'Couldn\'t load cart.'));
    });
  }

  return { node, refresh: async () => { const c = await getCart(); render(c); } };
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-cart-summary.js
git commit -m "feat(widget): build cart summary block with qty/remove/discount/checkout"
```

---

### Task 5: Save cart card

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-save-cart.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append save-cart styles)

- [ ] **Step 1: Append save-cart CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Save cart card
 * ============================================================ */
.swa-save-cart {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
}
.swa-save-cart-title {
  font-size: var(--swa-text-md);
  font-weight: var(--swa-weight-semibold);
  margin-bottom: var(--swa-space-1);
}
.swa-save-cart-sub {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  margin-bottom: var(--swa-space-3);
}
.swa-save-cart-field {
  margin-bottom: var(--swa-space-2);
}
.swa-save-cart-field input {
  width: 100%;
  padding: 8px var(--swa-space-2);
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  font: inherit;
  font-size: var(--swa-text-base);
}
.swa-save-cart-sms-toggle {
  background: none;
  border: none;
  color: var(--swa-color-text-secondary);
  cursor: pointer;
  padding: 0;
  font-size: var(--swa-text-sm);
  margin: var(--swa-space-1) 0 var(--swa-space-2);
}
.swa-save-cart-consent {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  margin-bottom: var(--swa-space-2);
  line-height: 1.5;
}
.swa-save-cart-submit {
  width: 100%;
  background: var(--swa-color-brand);
  color: var(--swa-color-brand-foreground);
  border: none;
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-2);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
}
.swa-save-cart-submit:disabled { background: var(--swa-color-border-strong); cursor: not-allowed; }
.swa-save-cart-success {
  background: var(--swa-color-success-bg);
  color: var(--swa-color-success-fg);
  padding: var(--swa-space-2);
  border-radius: var(--swa-radius-sm);
  text-align: center;
  font-size: var(--swa-text-sm);
  margin-top: var(--swa-space-2);
}
```

- [ ] **Step 2: Implement ui-save-cart.js**

Create `extensions/chat-bubble/assets/modules/ui-save-cart.js`:

```js
import { el } from './dom.js';

/**
 * Save-cart email + optional SMS capture.
 *
 * onSubmit({ email, sms? }) returns a Promise — should resolve to indicate
 * the link was sent. The server endpoint is added in a follow-up plan.
 * For now, onSubmit can be a stub that resolves immediately.
 */
export function createSaveCartCard({ onSubmit }) {
  const node = el('div', { class: 'swa-save-cart' });
  node.appendChild(el('div', { class: 'swa-save-cart-title' }, 'Save your cart for later'));
  node.appendChild(el('div', { class: 'swa-save-cart-sub' }, "We'll email you a link — pick up where you left off."));

  const emailField = el('div', { class: 'swa-save-cart-field' });
  const emailInput = el('input', { type: 'email', placeholder: 'you@example.com', required: 'true', 'aria-label': 'Email' });
  emailField.appendChild(emailInput);

  const smsField = el('div', { class: 'swa-save-cart-field', style: 'display:none' });
  const smsInput = el('input', { type: 'tel', placeholder: '+1 555-1234', 'aria-label': 'Phone (optional)' });
  smsField.appendChild(smsInput);

  const smsToggle = el('button', { class: 'swa-save-cart-sms-toggle', type: 'button' }, 'Add SMS reminder ▾');
  smsToggle.addEventListener('click', () => {
    smsField.style.display = smsField.style.display === 'none' ? 'block' : 'none';
    smsToggle.textContent = smsField.style.display === 'none' ? 'Add SMS reminder ▾' : 'Hide SMS reminder ▴';
  });

  const consent = el('div', { class: 'swa-save-cart-consent' },
    'By saving, you agree to receive a cart reminder. No marketing.');

  const submit = el('button', { class: 'swa-save-cart-submit', type: 'submit' }, 'Send me the link');
  const success = el('div', { class: 'swa-save-cart-success', style: 'display:none' }, '✓ Sent — check your email.');

  const form = el('form', null, emailField, smsToggle, smsField, consent, submit, success);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      await onSubmit({ email, sms: smsInput.value.trim() || null });
      form.querySelectorAll('input, button').forEach(elN => { elN.disabled = true; });
      success.style.display = 'block';
      submit.textContent = 'Sent';
    } catch {
      submit.disabled = false;
      submit.textContent = 'Try again';
    }
  });

  node.appendChild(form);
  return node;
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-save-cart.js
git commit -m "feat(widget): build save-cart card with email + optional SMS"
```

---

### Task 6: Order status block

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-order-status.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append order styles)

- [ ] **Step 1: Append order styles**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Order status card
 * ============================================================ */
.swa-order {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
}
.swa-order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--swa-space-2);
}
.swa-order-number {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
}
.swa-order-status-pill {
  font-size: var(--swa-text-xs);
  font-weight: var(--swa-weight-medium);
  padding: 2px var(--swa-space-2);
  border-radius: var(--swa-radius-full);
}
.swa-order-status-pill[data-status="processing"] { background: var(--swa-color-warning-bg); color: var(--swa-color-warning-fg); }
.swa-order-status-pill[data-status="shipped"]    { background: var(--swa-color-info-bg);    color: var(--swa-color-info-fg); }
.swa-order-status-pill[data-status="delivered"]  { background: var(--swa-color-success-bg); color: var(--swa-color-success-fg); }
.swa-order-status-pill[data-status="cancelled"]  { background: var(--swa-color-bg-subtle);  color: var(--swa-color-text-tertiary); }

.swa-order-items {
  border-top: 1px solid var(--swa-color-border);
  border-bottom: 1px solid var(--swa-color-border);
  padding: var(--swa-space-2) 0;
  margin: var(--swa-space-2) 0;
}
.swa-order-item {
  display: flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-1) 0;
  font-size: var(--swa-text-sm);
}
.swa-order-item img {
  width: 32px;
  height: 32px;
  border-radius: var(--swa-radius-sm);
  object-fit: cover;
}
.swa-order-item-meta { flex: 1; }
.swa-order-item-qty {
  color: var(--swa-color-text-tertiary);
  font-size: var(--swa-text-xs);
}
.swa-order-total {
  display: flex;
  justify-content: space-between;
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  margin-bottom: var(--swa-space-3);
}
.swa-order-actions {
  display: flex;
  gap: var(--swa-space-2);
}
.swa-order-actions > * { flex: 1; }
.swa-order-track {
  text-align: center;
  padding: var(--swa-space-2);
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-primary);
  text-decoration: none;
}
.swa-order-reorder {
  text-align: center;
  padding: var(--swa-space-2);
  background: var(--swa-color-brand);
  color: var(--swa-color-brand-foreground);
  border: none;
  border-radius: var(--swa-radius-sm);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
}
```

- [ ] **Step 2: Implement ui-order-status.js**

Create `extensions/chat-bubble/assets/modules/ui-order-status.js`:

```js
import { el } from './dom.js';
import { formatMoney, formatQty } from './format.js';

/**
 * Order block shape:
 * { type: 'order_status', orderNumber, date, status: 'processing'|'shipped'|'delivered'|'cancelled',
 *   total, currency, items: [{ title, image, quantity }], trackingUrl?, lineIds: [variantId] }
 */
export function createOrderStatus(block, { onReorder } = {}) {
  const node = el('div', { class: 'swa-order' });

  node.appendChild(el('div', { class: 'swa-order-header' },
    el('div', { class: 'swa-order-number' }, `Order #${block.orderNumber} · ${block.date || ''}`),
    el('div', { class: 'swa-order-status-pill', dataset: { status: block.status } },
      block.status.charAt(0).toUpperCase() + block.status.slice(1)),
  ));

  const itemsWrap = el('div', { class: 'swa-order-items' });
  const visible = (block.items || []).slice(0, 3);
  for (const item of visible) {
    itemsWrap.appendChild(el('div', { class: 'swa-order-item' },
      item.image ? el('img', { src: item.image, alt: item.title, loading: 'lazy' }) : null,
      el('div', { class: 'swa-order-item-meta' }, item.title),
      el('div', { class: 'swa-order-item-qty' }, `× ${formatQty(item.quantity)}`),
    ));
  }
  const more = (block.items || []).length - visible.length;
  if (more > 0) {
    itemsWrap.appendChild(el('div', { class: 'swa-order-item-qty' }, `+${more} more`));
  }
  node.appendChild(itemsWrap);

  node.appendChild(el('div', { class: 'swa-order-total' },
    el('span', null, 'Total'),
    el('span', null, formatMoney(block.total, block.currency)),
  ));

  const actions = el('div', { class: 'swa-order-actions' });
  if (block.trackingUrl && (block.status === 'shipped' || block.status === 'delivered')) {
    actions.appendChild(el('a', {
      class: 'swa-order-track',
      href: block.trackingUrl,
      target: '_blank',
      rel: 'noopener',
    }, 'Track ↗'));
  }
  const reorderBtn = el('button', { class: 'swa-order-reorder', type: 'button' }, 'Reorder');
  reorderBtn.addEventListener('click', () => onReorder && onReorder(block));
  actions.appendChild(reorderBtn);
  node.appendChild(actions);

  return node;
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-order-status.js
git commit -m "feat(widget): build order status block with reorder + tracking"
```

---

### Task 7: Auth prompt card

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-auth-prompt.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append auth styles)

- [ ] **Step 1: Append auth styles**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Auth prompt
 * ============================================================ */
.swa-auth {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
  text-align: center;
}
.swa-auth-title {
  font-size: var(--swa-text-md);
  font-weight: var(--swa-weight-medium);
  margin-bottom: var(--swa-space-1);
}
.swa-auth-sub {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  margin-bottom: var(--swa-space-3);
}
.swa-auth-button {
  background: var(--swa-color-brand);
  color: var(--swa-color-brand-foreground);
  border: none;
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-2) var(--swa-space-4);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
}
.swa-auth-success {
  background: var(--swa-color-success-bg);
  color: var(--swa-color-success-fg);
  padding: var(--swa-space-2);
  border-radius: var(--swa-radius-sm);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
}
```

- [ ] **Step 2: Implement ui-auth-prompt.js**

Create `extensions/chat-bubble/assets/modules/ui-auth-prompt.js`:

```js
import { el } from './dom.js';

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;

/**
 * Inline sign-in card.
 * block: { type: 'auth_prompt', authUrl, title?, subtitle?, originatingIntent? }
 * onSuccess() runs after the popup closes signalling success.
 */
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
    // Popup blocked — fall back to redirect.
    window.location.href = url;
    return;
  }

  function onMessage(e) {
    // Existing auth callback posts a message; reuse that channel.
    if (e.data && e.data.type === 'shop_auth_success') {
      window.removeEventListener('message', onMessage);
      onAuthSuccess();
      try { popup.close(); } catch {}
    }
  }
  window.addEventListener('message', onMessage);

  // Fallback poll: detect manual close.
  const poll = setInterval(() => {
    if (popup.closed) {
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
    }
  }, 500);
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-auth-prompt.js
git commit -m "feat(widget): build auth-prompt card with OAuth popup"
```

---

### Task 8: Dispatch new block types in ui-turn

**Files:**
- Modify: `extensions/chat-bubble/assets/modules/ui-turn.js`

- [ ] **Step 1: Update ui-turn.js dispatch**

Replace `extensions/chat-bubble/assets/modules/ui-turn.js`:

```js
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
    import('./ui-save-cart.js').then(({ createSaveCartCard }) => slot.replaceWith(createSaveCartCard({ onSubmit: ctx.onSaveCartSubmit || (() => Promise.resolve()) })));
    return slot;
  }
  if (block.type === 'order_status') {
    const slot = el('div');
    import('./ui-order-status.js').then(({ createOrderStatus }) => slot.replaceWith(createOrderStatus(block, { onReorder: ctx.onReorder })));
    return slot;
  }
  if (block.type === 'auth_prompt') {
    const slot = el('div');
    import('./ui-auth-prompt.js').then(({ createAuthPrompt }) => slot.replaceWith(createAuthPrompt(block, { onSuccess: ctx.onAuthSuccess })));
    return slot;
  }
  return el('div', { class: 'swa-block-unknown', 'data-type': block.type });
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/modules/ui-turn.js
git commit -m "feat(widget): dispatch product/cart/order/save-cart/auth blocks in ui-turn"
```

---

### Task 9: Wire ctx into stream + chat.js handlers

**Files:**
- Modify: `extensions/chat-bubble/assets/modules/ui-stream.js` — pass ctx into createTurnNode
- Modify: `extensions/chat-bubble/assets/chat.js` — supply ctx (save-cart, reorder, auth handlers)

- [ ] **Step 1: Update ui-stream.js to forward ctx**

Replace `extensions/chat-bubble/assets/modules/ui-stream.js`:

```js
import { el } from './dom.js';
import { createTurnNode } from './ui-turn.js';

export function createStream({ turnCtx = {} } = {}) {
  const welcomeSlot = el('div', { class: 'swa-stream-welcome-slot' });
  const turnsWrap = el('div', { class: 'swa-stream-turns' });
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
  }, welcomeSlot, turnsWrap);

  const turnNodes = new Map();

  function setWelcome(panelNode) {
    welcomeSlot.innerHTML = '';
    if (panelNode) welcomeSlot.appendChild(panelNode);
  }

  function bindConversation(conv) {
    function render() {
      const turns = conv.getTurns();
      for (const t of turns) {
        if (!turnNodes.has(t.id)) {
          const ctl = createTurnNode(t, turnCtx);
          turnNodes.set(t.id, ctl);
          turnsWrap.appendChild(ctl.node);
        } else {
          turnNodes.get(t.id).update();
        }
      }
      node.scrollTop = node.scrollHeight;
    }
    conv.subscribe(render);
    render();
  }

  return { node, setWelcome, bindConversation };
}
```

- [ ] **Step 2: Wire handlers in chat.js**

Replace the `createStream()` call in `extensions/chat-bubble/assets/chat.js`:

Find:

```js
const stream = createStream();
```

Replace with:

```js
const stream = createStream({
  turnCtx: {
    onATCSuccess: (cart) => {
      // Surface a cart_summary block after a successful add-to-cart.
      if (currentAssistantTurnId) {
        conversation.appendBlock(currentAssistantTurnId, { type: 'cart_summary', cart });
      }
    },
    onSaveCartSubmit: ({ email, sms }) => {
      console.log('[swa] save cart for', email, sms);
      // Real endpoint added in a future plan; for now we just resolve.
      return Promise.resolve();
    },
    onReorder: async (orderBlock) => {
      console.log('[swa] reorder requested for order', orderBlock.orderNumber);
      // Plan 4 wires the actual reorder mutation; emit a follow-up assistant message stub for now.
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
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass (47 — was 41 + 6 new from format + cart-helpers).

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-stream.js
git commit -m "feat(widget): wire turn context for new block types"
```

---

### Task 10: Update test-surfaces

**Files:**
- Modify: `extensions/chat-bubble/assets/test-surfaces.html`

- [ ] **Step 1: Append new surfaces to test-surfaces.html**

Add the following sections to `test-surfaces.html` before the closing `</body>` tag and add the new imports + render code to the `<script>` block. (Replace the file with the version below for clarity.)

Overwrite `extensions/chat-bubble/assets/test-surfaces.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shop AI Widget — Surface Tests</title>
  <link rel="stylesheet" href="./chat.css">
  <style>
    body { margin: 0; padding: 40px; font-family: -apple-system, sans-serif; background: #f5f5f7; }
    h2 { font-size: 14px; margin: 40px 0 12px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .stage { background: #fff; padding: 24px; border-radius: 12px; min-height: 80px; position: relative; }
    .grid { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; }
  </style>
</head>
<body>
  <h1>Shop AI Widget — Surface Tests (Plans 1, 2, 3)</h1>

  <h2>Orbs</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div class="grid" id="orb-grid"></div>
  </div>

  <h2>Launcher</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;height:140px;">
    <div id="launcher-stage"></div>
  </div>

  <h2>Header</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="header-stage" style="width:420px;"></div>
  </div>

  <h2>Product card — full</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="product-card-stage" style="width:380px;"></div>
  </div>

  <h2>Product card — on sale</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="product-card-sale-stage" style="width:380px;"></div>
  </div>

  <h2>Product carousel</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="product-carousel-stage" style="width:420px;"></div>
  </div>

  <h2>Cart summary</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="cart-stage" style="width:420px;"></div>
  </div>

  <h2>Save-cart card</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="savecart-stage" style="width:380px;"></div>
  </div>

  <h2>Order status — shipped</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="order-shipped-stage" style="width:380px;"></div>
  </div>

  <h2>Order status — processing</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="order-processing-stage" style="width:380px;"></div>
  </div>

  <h2>Auth prompt</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="auth-stage" style="width:380px;"></div>
  </div>

  <h2>Composer</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="composer-stage" style="width:420px;"></div>
  </div>

  <script type="module">
    import { createOrb } from './modules/orb.js';
    import { createLauncher } from './modules/ui-launcher.js';
    import { createHeader } from './modules/ui-header.js';
    import { createComposer } from './modules/ui-composer.js';
    import { createState, INITIAL_STATE } from './modules/state.js';
    import { createProductCard, createProductCarousel } from './modules/ui-product-card.js';
    import { createCartSummary } from './modules/ui-cart-summary.js';
    import { createSaveCartCard } from './modules/ui-save-cart.js';
    import { createOrderStatus } from './modules/ui-order-status.js';
    import { createAuthPrompt } from './modules/ui-auth-prompt.js';

    // Orbs
    for (const size of [16, 22, 32, 60, 96]) {
      const o = createOrb({ size });
      const w = document.createElement('div');
      w.style.textAlign = 'center';
      const l = document.createElement('div');
      l.style.cssText = 'font-size:11px;color:#888;margin-top:6px';
      l.textContent = `${size}px`;
      w.append(o, l);
      document.getElementById('orb-grid').appendChild(w);
    }

    // Launcher
    const restState = createState({ ...INITIAL_STATE, shopName: 'Shop LC' });
    const pillState = createState({ ...INITIAL_STATE, shopName: 'Shop LC', hasUnread: true, pendingMessagePreview: 'Found 3 rings in your size.' });
    const lstage = document.getElementById('launcher-stage');
    const restCtl = createLauncher({ state: restState });
    const pillCtl = createLauncher({ state: pillState });
    lstage.append(restCtl.node, document.createTextNode('   '), pillCtl.node, pillCtl.previewBubble);

    // Header
    document.getElementById('header-stage').appendChild(createHeader({ state: createState({ ...INITIAL_STATE, shopName: 'Shop LC' }) }));

    // Product card — full
    const product = {
      id: 'p1', title: 'Diamond Halo Engagement Ring', subtitle: '14k White Gold · VS2 Clarity',
      image: 'https://picsum.photos/seed/halo/600/400', url: '#',
      price: 249900, currency: 'USD',
      rating: { average: 4.8, count: 124 },
      status: { label: 'Ships in 3 days' },
      variants: [{ id: 'v1', label: 'Size 6', available: true }, { id: 'v2', label: 'Size 7', available: true }, { id: 'v3', label: 'Size 8', available: false }],
    };
    document.getElementById('product-card-stage').appendChild(createProductCard(product));

    // Product card — sale
    const saleProduct = { ...product, price: 199900, compareAtPrice: 249900, title: 'Halo Ring — On sale', status: 'low_stock' };
    document.getElementById('product-card-sale-stage').appendChild(createProductCard(saleProduct));

    // Carousel
    document.getElementById('product-carousel-stage').appendChild(createProductCarousel([
      { id: 'a', title: 'Halo Solitaire', subtitle: '14k · Size 7', image: 'https://picsum.photos/seed/a/300/300', price: 249900, url: '#' },
      { id: 'b', title: 'Three-Stone',     subtitle: '18k · Size 7', image: 'https://picsum.photos/seed/b/300/300', price: 320000, url: '#' },
      { id: 'c', title: 'Classic Solitaire', subtitle: '14k · Size 7', image: 'https://picsum.photos/seed/c/300/300', price: 189000, url: '#' },
      { id: 'd', title: 'Pavé Band',         subtitle: '14k · Size 7', image: 'https://picsum.photos/seed/d/300/300', price: 149000, url: '#' },
    ]));

    // Cart
    const fakeCart = {
      itemCount: 3, subtotal: 14850, total: 14850, currency: 'USD',
      lines: [
        { key: 'k1', title: 'Halo Solitaire', variant: '14k White · Size 7', quantity: 1, linePrice: 9900, image: 'https://picsum.photos/seed/halo/100/100' },
        { key: 'k2', title: 'Care Kit', variant: 'Polish + cloth', quantity: 2, linePrice: 4950, image: 'https://picsum.photos/seed/care/100/100' },
      ],
    };
    document.getElementById('cart-stage').appendChild(createCartSummary({ initialCart: fakeCart }).node);

    // Save-cart
    document.getElementById('savecart-stage').appendChild(createSaveCartCard({ onSubmit: async ({ email }) => { alert(`Save link for ${email}`); } }));

    // Orders
    document.getElementById('order-shipped-stage').appendChild(createOrderStatus({
      orderNumber: '1234', date: 'May 10', status: 'shipped',
      total: 14850, currency: 'USD',
      items: [
        { title: 'Halo Solitaire', image: 'https://picsum.photos/seed/halo/100/100', quantity: 1 },
        { title: 'Care Kit', image: 'https://picsum.photos/seed/care/100/100', quantity: 2 },
      ],
      trackingUrl: 'https://example.com/track/1234',
    }, { onReorder: () => alert('reorder!') }));

    document.getElementById('order-processing-stage').appendChild(createOrderStatus({
      orderNumber: '5678', date: 'today', status: 'processing',
      total: 24000, currency: 'USD',
      items: [{ title: 'Three-stone ring', image: 'https://picsum.photos/seed/3st/100/100', quantity: 1 }],
    }, { onReorder: () => alert('reorder!') }));

    // Auth
    document.getElementById('auth-stage').appendChild(createAuthPrompt({
      authUrl: '#',
      title: 'Sign in to see your orders',
      subtitle: 'Connect your account — we won\'t see your password.',
    }, { onSuccess: () => alert('connected') }));

    // Composer
    document.getElementById('composer-stage').appendChild(createComposer({ onSubmit: (v) => alert(`Sent: ${v}`) }).node);
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/test-surfaces.html
git commit -m "build(widget): add product, cart, order, auth surfaces to test page"
```

---

### Task 11: Verify, lint, finalize

- [ ] **Step 1: Run full test suite**

```bash
cd /Applications/pe/shop-chat-agent && npm test
```

Expected: all tests pass (~47 — Plan 1's 19 + Plan 2's 22 + Plan 3's format 6 + cart-helpers 6).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: only the 3 pre-existing errors in `app/routes/auth.callback.jsx` (×2) and `app/routes/chat.jsx`. No new errors from Plan 3 modules.

If a new error appears, fix it inline (most likely candidates: `no-constant-condition`, unused imports). Re-run.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Final commit**

If lint or typecheck required fixes, commit them:

```bash
git add -A
git commit -m "chore(widget): finalize plan 3 product + customer actions"
```

If no fixes needed, skip.

---

## Self-Review

**1. Spec coverage (sections §10 + §11 of the design spec):**

- §10.1 Single product card with status badge, subtitle, rating, price, ATC — Task 3 ✓
- §10.1 Discount display (strikethrough + sale price + save badge) — Task 3 ✓
- §10.1 Inline variant picker (2–5 variants) — Task 3 ✓
- §10.2 ATC state machine (default → loading → success → settled / error) — Task 3 ✓
- §10.2 Whole-card-tappable to PDP — Task 3 ✓
- §10.3 Carousel with 1.5-card peek + quick "+" ATC — Task 3 ✓
- §11.1 Action inventory — informational; nothing to implement
- §11.2 Cart summary block (header, lines, qty stepper, remove, discount, subtotal, checkout, save-link, empty state) — Task 4 ✓
- §11.3 Checkout transition — Task 4 (link to `/checkout` — Shopify-handled). State-preservation deferred to Plan 4 because it depends on Plan 4's returning-user resume flow.
- §11.4 Express checkout — **deferred to a v1.1 follow-up plan.** Shop Pay / Apple Pay / Google Pay involve platform-specific Web Payments / Payment Request API integration that is significant on its own. Capturing as a known follow-up here, not silently dropping.
- §11.5 Order status block — Task 6 ✓ (rendering; data must come from the assistant via the existing `/chat` SSE)
- §11.6 Save cart card — Task 5 ✓ (form + consent; the actual email-sending backend stub is a no-op pending email infra)
- §11.7 Sign-in prompt with OAuth popup — Task 7 ✓
- §11.8 What requires leaving the widget — informational; transition principle implemented via the checkout link (Task 4) and tracking link (Task 6)

**2. Placeholder scan:** no TBDs. Deferrals explicitly named.

**3. Type consistency:**

- `createProductCard(product, {onATCSuccess})` consumed by ui-turn.js dispatch ✓
- `createProductCarousel(items, {onATCSuccess})` consumed by ui-turn.js dispatch ✓
- `createCartSummary({initialCart, onSaveForLater})` returns `{node, refresh}` — consumed by ui-turn.js ✓
- `createSaveCartCard({onSubmit})` returns DOM node — consumed by ui-turn.js ✓
- `createOrderStatus(block, {onReorder})` returns DOM node — consumed by ui-turn.js ✓
- `createAuthPrompt(block, {onSuccess})` returns DOM node — consumed by ui-turn.js ✓
- `createStream({turnCtx})` — chat.js passes turnCtx; ui-stream forwards to createTurnNode ✓
- Cart shape (`itemCount`, `subtotal`, `currency`, `lines: [{key,title,variant,quantity,linePrice,image}]`) — produced by `normalizeCart`, consumed by `createCartSummary` ✓
- Product card block shape declared in Task 3 description matches the keys used in `ui-product-card.js` ✓

No issues.

---

## What's NOT in this plan

| Item | Goes to |
|---|---|
| Express checkout (Shop Pay / Apple Pay / Google Pay) | v1.1 follow-up (Web Payments / Payment Request API) |
| Sizing widget | Plan 4 |
| Comparison sheet (3+ products) | Plan 4 |
| Proactive trigger engine | Plan 4 |
| Returning-user resume card | Plan 4 |
| Error mid-stream banner + auto-retry | Plan 4 |
| Offline state | Plan 4 |
| Rate-limited state | Plan 4 |
| Image upload composer + image_preview + vision_result | Plan 4 |
| Auto-scroll pause + "↓ New messages" pill | Plan 4 |
| Full A11y audit | Plan 4 |
| Save-cart email backend (sending the actual reminder email) | Outside widget UI scope; product/back-end work |
| Reorder backend mutation (Customer MCP) | Hooked from a future backend plan |
