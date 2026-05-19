import { el } from './dom.js';
import { formatMoney, formatQty } from './format.js';
import { getCart, updateLine, removeLine, applyDiscount, getCheckoutUrl } from './cart.js';

export function createCartSummary({ initialCart, onSaveForLater } = {}) {
  const node = el('div', { class: 'swa-cart', role: 'region', 'aria-label': 'Shopping cart' });

  async function render(cart) {
    node.innerHTML = '';
    if (!cart || cart.itemCount === 0) {
      node.appendChild(el('div', { class: 'swa-cart-empty' }, 'Your cart is empty.'));
      return;
    }

    node.appendChild(el('div', { class: 'swa-cart-header' },
      el('div', null, el('strong', null, `Cart · ${formatQty(cart.itemCount)} items`)),
      el('div', null, formatMoney(cart.subtotal, cart.currency)),
    ));

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
      node.appendChild(el('div', { class: 'swa-cart-empty' }, "Couldn't load cart."));
    });
  }

  return { node, refresh: async () => { const c = await getCart(); render(c); } };
}
