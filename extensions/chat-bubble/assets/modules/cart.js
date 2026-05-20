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
    image: line.image || (line.featured_image && line.featured_image.url) || null,
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
    discountCode: (cart.cart_level_discount_applications && cart.cart_level_discount_applications[0] && cart.cart_level_discount_applications[0].title) || null,
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

function numericVariantId(id) {
  if (!id) return id;
  // Strip GID prefix: "gid://shopify/ProductVariant/12345" → 12345
  const str = String(id);
  const match = str.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : id;
}

export async function addToCart({ variantId, quantity = 1, properties }) {
  const id = numericVariantId(variantId);
  const body = { items: [{ id, quantity, ...(properties && { properties }) }] };
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
