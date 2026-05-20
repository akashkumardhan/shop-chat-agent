"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // extensions/chat-bubble/assets/modules/dom.js
  function el(tag2, attrs, ...children) {
    const node = document.createElement(tag2);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v !== null && v !== void 0 && v !== false) {
        node.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  var qs;
  var init_dom = __esm({
    "extensions/chat-bubble/assets/modules/dom.js"() {
      "use strict";
      qs = (sel, root = document) => root.querySelector(sel);
    }
  });

  // extensions/chat-bubble/assets/modules/ui-tool-use.js
  var ui_tool_use_exports = {};
  __export(ui_tool_use_exports, {
    createToolUseNode: () => createToolUseNode
  });
  function createToolUseNode(_block) {
    return el(
      "div",
      {
        class: "swa-bubble swa-bubble-assistant swa-typing-indicator",
        role: "status",
        "aria-label": "Searching"
      },
      el("span", { class: "swa-typing-dot" }),
      el("span", { class: "swa-typing-dot" }),
      el("span", { class: "swa-typing-dot" })
    );
  }
  var init_ui_tool_use = __esm({
    "extensions/chat-bubble/assets/modules/ui-tool-use.js"() {
      "use strict";
      init_dom();
    }
  });

  // extensions/chat-bubble/assets/modules/format.js
  function formatMoney(cents, currency = "USD") {
    const value = (cents || 0) / 100;
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }
  function formatQty(n) {
    if (n == null) return "0";
    return String(Math.max(0, Math.trunc(n)));
  }
  var init_format = __esm({
    "extensions/chat-bubble/assets/modules/format.js"() {
      "use strict";
    }
  });

  // extensions/chat-bubble/assets/modules/cart.js
  function validateQty(n) {
    if (n == null || isNaN(n)) return 0;
    return Math.max(0, Math.floor(Number(n)));
  }
  function normalizeLine(line) {
    const variant = line.variant_title && line.variant_title !== "Default Title" ? line.variant_title : null;
    return {
      key: line.key,
      title: line.product_title || line.title,
      variant,
      quantity: line.quantity,
      linePrice: line.final_line_price ?? line.line_price ?? 0,
      image: line.image || line.featured_image && line.featured_image.url || null,
      url: line.url || null
    };
  }
  function normalizeCart(cart) {
    if (!cart) return { itemCount: 0, subtotal: 0, total: 0, currency: "USD", lines: [], token: null };
    return {
      token: cart.token || null,
      itemCount: cart.item_count || 0,
      subtotal: cart.items_subtotal_price || 0,
      total: cart.total_price || 0,
      currency: cart.currency || "USD",
      discountCode: cart.cart_level_discount_applications && cart.cart_level_discount_applications[0] && cart.cart_level_discount_applications[0].title || null,
      lines: (cart.items || []).map(normalizeLine)
    };
  }
  async function postJson(url, body) {
    const res = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const text2 = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text2);
    } catch {
      payload = {};
    }
    if (!res.ok) {
      const err = new Error(payload.message || payload.description || `${url} failed: ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }
  async function getCart() {
    const res = await fetch("/cart.js", { headers: JSON_HEADERS });
    return normalizeCart(await res.json());
  }
  function numericVariantId(id) {
    if (!id) return id;
    const str = String(id);
    const match = str.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : id;
  }
  async function addToCart({ variantId, quantity = 1, properties }) {
    const id = numericVariantId(variantId);
    const body = { items: [{ id, quantity, ...properties && { properties } }] };
    await postJson("/cart/add.js", body);
    return getCart();
  }
  async function updateLine(key, quantity) {
    await postJson("/cart/change.js", { id: key, quantity: validateQty(quantity) });
    return getCart();
  }
  async function removeLine(key) {
    await postJson("/cart/change.js", { id: key, quantity: 0 });
    return getCart();
  }
  async function applyDiscount(code) {
    await postJson("/cart/update.js", { discount: code });
    return getCart();
  }
  function getCheckoutUrl() {
    return "/checkout";
  }
  var JSON_HEADERS;
  var init_cart = __esm({
    "extensions/chat-bubble/assets/modules/cart.js"() {
      "use strict";
      JSON_HEADERS = { "Content-Type": "application/json", "Accept": "application/json" };
    }
  });

  // extensions/chat-bubble/assets/modules/ui-product-card.js
  var ui_product_card_exports = {};
  __export(ui_product_card_exports, {
    createProductCard: () => createProductCard,
    createProductCarousel: () => createProductCarousel
  });
  function statusBadge(status) {
    if (!status || status === "in_stock") return null;
    if (status === "sold_out") {
      return el("div", { class: "swa-product-badge", "data-tone": "danger" }, "Sold out");
    }
    if (status === "low_stock") {
      return el("div", { class: "swa-product-badge", "data-tone": "warning" }, "Low stock");
    }
    if (typeof status === "object" && status.label) {
      return el("div", { class: "swa-product-badge" }, status.label);
    }
    return null;
  }
  function imagePlaceholder() {
    const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg2.setAttribute("viewBox", "0 0 64 64");
    svg2.setAttribute("fill", "none");
    svg2.setAttribute("aria-hidden", "true");
    svg2.setAttribute("class", "swa-product-img-placeholder");
    svg2.innerHTML = '<rect width="64" height="64" fill="#f3f4f6"/><path d="M18 46l12-14 8 9 6-7 12 12H18z" fill="#d1d5db"/><circle cx="40" cy="24" r="5" fill="#d1d5db"/>';
    return svg2;
  }
  function priceBlock(product) {
    const currency = product.currency || "USD";
    if (product.compareAtPrice && product.compareAtPrice > product.price) {
      const save = product.compareAtPrice - product.price;
      return el(
        "div",
        { class: "swa-product-price-wrap" },
        el("span", { class: "swa-product-price swa-product-price-sale" }, formatMoney(product.price, currency)),
        el("span", { class: "swa-product-price-strike" }, formatMoney(product.compareAtPrice, currency)),
        el("span", { class: "swa-product-save-badge" }, `Save ${formatMoney(save, currency)}`)
      );
    }
    return el(
      "div",
      { class: "swa-product-price-wrap" },
      el("span", { class: "swa-product-price" }, formatMoney(product.price, currency))
    );
  }
  function rating(product) {
    if (!product.rating || !product.rating.count || product.rating.count < 3) return null;
    return el(
      "div",
      { class: "swa-product-rating" },
      `\u2605 ${product.rating.average.toFixed(1)} \xB7 ${product.rating.count} reviews`
    );
  }
  function variantPicker(product) {
    if (!Array.isArray(product.variants) || product.variants.length < 2) return null;
    const wrap = el("div", { class: "swa-product-variants" });
    let selectedId = (product.variants.find((v) => v.available) || product.variants[0]).id;
    for (const v of product.variants) {
      const chip = el("button", {
        class: "swa-variant-chip",
        type: "button",
        title: v.available ? "" : "Out of stock",
        dataset: {
          selected: v.id === selectedId ? "true" : "false",
          unavailable: v.available ? "false" : "true"
        }
      }, v.label);
      if (!v.available) chip.disabled = true;
      chip.addEventListener("click", () => {
        selectedId = v.id;
        for (const c of wrap.children) c.dataset.selected = "false";
        chip.dataset.selected = "true";
      });
      wrap.appendChild(chip);
    }
    return { node: wrap, getSelected: () => selectedId };
  }
  function createATCBtn({ product, getVariantId, onSuccess }) {
    const isSoldOut = product.status === "sold_out";
    const btn = el("button", {
      class: "swa-product-atc",
      type: "button",
      dataset: { state: isSoldOut ? "disabled" : "default" }
    });
    btn.innerHTML = isSoldOut ? "Notify me when available" : `${cartIconSVG}<span>Add to Cart</span>`;
    if (isSoldOut) return btn;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.state === "loading" || btn.dataset.state === "disabled") return;
      btn.dataset.state = "loading";
      btn.innerHTML = '<span class="swa-atc-spinner"></span><span>Adding\u2026</span>';
      try {
        const variantId = getVariantId() || product.variantId || product.id;
        const cart = await addToCart({ variantId, quantity: 1 });
        btn.dataset.state = "success";
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2,8 6,12 14,4"/></svg><span>Added to Cart!</span>`;
        const existing = btn.parentElement?.querySelector(".swa-atc-checkout-link");
        if (!existing && btn.parentElement) {
          const link2 = el("a", {
            class: "swa-atc-checkout-link",
            href: "/checkout",
            target: "_blank",
            rel: "noopener"
          }, "Proceed to Checkout \u2192");
          btn.after(link2);
        }
        onSuccess && onSuccess(cart);
      } catch (err) {
        console.error("[swa] ATC error", err);
        btn.dataset.state = "error";
        btn.innerHTML = `<span>Couldn't add \u2014 Retry</span>`;
        setTimeout(() => {
          btn.dataset.state = "default";
          btn.innerHTML = `${cartIconSVG}<span>Add to Cart</span>`;
        }, 3e3);
      }
    });
    return btn;
  }
  function createProductCard(product, { onATCSuccess } = {}) {
    const imgWrap = el("div", { class: "swa-product-image" });
    if (product.image) {
      imgWrap.appendChild(el("img", { src: product.image, alt: product.title, loading: "lazy" }));
    } else {
      imgWrap.appendChild(imagePlaceholder());
    }
    const badge = statusBadge(product.status);
    if (badge) imgWrap.appendChild(badge);
    const meta = el(
      "div",
      { class: "swa-product-meta" },
      el("div", { class: "swa-product-title" }, product.title),
      product.subtitle ? el("div", { class: "swa-product-subtitle" }, product.subtitle) : null,
      rating(product)
    );
    const variants = variantPicker(product);
    const atc = createATCBtn({
      product,
      getVariantId: () => variants?.getSelected(),
      onSuccess: onATCSuccess
    });
    const viewLink = product.url && product.url !== "#" ? el("a", { class: "swa-product-view-link", href: product.url, target: "_blank", rel: "noopener" }, "View Details") : null;
    let imgSlot;
    if (product.url && product.url !== "#") {
      imgSlot = el("a", { class: "swa-product-link", href: product.url, target: "_blank", rel: "noopener" });
    } else {
      imgSlot = el("div", { class: "swa-product-link" });
    }
    imgSlot.appendChild(imgWrap);
    const card = el(
      "div",
      { class: "swa-product" },
      imgSlot,
      el(
        "div",
        { class: "swa-product-info" },
        el("div", { class: "swa-product-row1" }, meta, priceBlock(product)),
        variants ? variants.node : null,
        atc,
        viewLink
      )
    );
    return card;
  }
  function createProductCarousel(items, { onATCSuccess } = {}) {
    const carousel = el("div", { class: "swa-product-carousel" });
    for (const p of items) {
      const mini = el("div", { class: "swa-product-mini" });
      const imgWrap = el("div", { class: "swa-product-image" });
      if (p.image) {
        imgWrap.appendChild(el("img", { src: p.image, alt: p.title, loading: "lazy" }));
      } else {
        imgWrap.appendChild(imagePlaceholder());
      }
      const badge = statusBadge(p.status);
      if (badge) imgWrap.appendChild(badge);
      const imgSlot = p.url && p.url !== "#" ? el("a", { class: "swa-product-mini-img-link", href: p.url, target: "_blank", rel: "noopener" }, imgWrap) : imgWrap;
      const priceEl = el("div", { class: "swa-product-price" }, formatMoney(p.price, p.currency || "USD"));
      let variantChips = null;
      if (Array.isArray(p.variants) && p.variants.length >= 2 && p.variants.length <= 6) {
        let selectedVariantId = (p.variants.find((v) => v.available) || p.variants[0]).id;
        variantChips = el("div", { class: "swa-product-variants swa-product-variants--mini" });
        for (const v of p.variants.slice(0, 4)) {
          const chip = el("button", {
            class: "swa-variant-chip",
            type: "button",
            title: v.available ? "" : "Out of stock",
            dataset: { selected: v.id === selectedVariantId ? "true" : "false", unavailable: v.available ? "false" : "true" }
          }, v.label);
          if (!v.available) chip.disabled = true;
          chip.addEventListener("click", () => {
            selectedVariantId = v.id;
            for (const c of variantChips.children) c.dataset.selected = "false";
            chip.dataset.selected = "true";
            const vd = p.variants.find((x) => x.id === selectedVariantId);
            if (vd) priceEl.textContent = formatMoney(vd.price, vd.currency || p.currency || "USD");
          });
          variantChips.appendChild(chip);
        }
        if (p.variants.length > 4) {
          variantChips.appendChild(el("span", { class: "swa-variant-more" }, `+${p.variants.length - 4}`));
        }
      }
      const isSoldOut = p.status === "sold_out";
      const atcMini = el("button", {
        class: "swa-product-atc-mini",
        type: "button",
        dataset: { state: isSoldOut ? "disabled" : "default" },
        disabled: isSoldOut
      }, isSoldOut ? "Sold Out" : "Add to Cart");
      if (!isSoldOut) {
        atcMini.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (atcMini.disabled) return;
          atcMini.disabled = true;
          atcMini.textContent = "Adding\u2026";
          try {
            const cart = await addToCart({ variantId: p.variantId || p.id, quantity: 1 });
            atcMini.textContent = "\u2713 Added";
            atcMini.dataset.state = "success";
            const existing = mini.querySelector(".swa-atc-checkout-link");
            if (!existing) {
              const link2 = el("a", {
                class: "swa-atc-checkout-link swa-atc-checkout-link--mini",
                href: "/checkout",
                target: "_blank",
                rel: "noopener"
              }, "Checkout \u2192");
              mini.appendChild(link2);
            }
            onATCSuccess && onATCSuccess(cart);
          } catch {
            atcMini.disabled = false;
            atcMini.textContent = "Retry";
            setTimeout(() => {
              atcMini.textContent = "Add to Cart";
            }, 1500);
          }
        });
      }
      const titleEl = p.url && p.url !== "#" ? el("a", { class: "swa-product-title", href: p.url, target: "_blank", rel: "noopener" }, p.title) : el("div", { class: "swa-product-title" }, p.title);
      mini.append(
        imgSlot,
        el(
          "div",
          { class: "swa-product-info" },
          titleEl,
          p.subtitle ? el("div", { class: "swa-product-subtitle" }, p.subtitle) : null,
          priceEl,
          variantChips,
          atcMini
        )
      );
      carousel.appendChild(mini);
    }
    return carousel;
  }
  var cartIconSVG;
  var init_ui_product_card = __esm({
    "extensions/chat-bubble/assets/modules/ui-product-card.js"() {
      "use strict";
      init_dom();
      init_format();
      init_cart();
      cartIconSVG = `<svg class="swa-atc-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M1 1h2l.8 4m0 0L5.5 13h9l2-8H3.8z"/><circle cx="7" cy="17" r="1.2"/><circle cx="14" cy="17" r="1.2"/></svg>`;
    }
  });

  // extensions/chat-bubble/assets/modules/ui-cart-summary.js
  var ui_cart_summary_exports = {};
  __export(ui_cart_summary_exports, {
    createCartSummary: () => createCartSummary
  });
  function createCartSummary({ initialCart, onSaveForLater } = {}) {
    const node = el("div", { class: "swa-cart", role: "region", "aria-label": "Shopping cart" });
    async function render(cart) {
      node.innerHTML = "";
      if (!cart || cart.itemCount === 0) {
        node.appendChild(el("div", { class: "swa-cart-empty" }, "Your cart is empty."));
        return;
      }
      node.appendChild(el(
        "div",
        { class: "swa-cart-header" },
        el("div", null, el("strong", null, `Cart \xB7 ${formatQty(cart.itemCount)} items`)),
        el("div", null, formatMoney(cart.subtotal, cart.currency))
      ));
      for (const line of cart.lines) {
        const stepper = el("div", { class: "swa-qty-stepper" });
        const dec = el("button", { type: "button", "aria-label": "Decrease quantity" }, "\u2212");
        const num = el("span", { class: "swa-qty-num" }, formatQty(line.quantity));
        const inc = el("button", { type: "button", "aria-label": "Increase quantity" }, "+");
        if (line.quantity <= 1) dec.disabled = true;
        stepper.append(dec, num, inc);
        dec.addEventListener("click", async () => {
          if (line.quantity <= 1) return;
          const next = await updateLine(line.key, line.quantity - 1);
          render(next);
        });
        inc.addEventListener("click", async () => {
          const next = await updateLine(line.key, line.quantity + 1);
          render(next);
        });
        const remove = el("button", { class: "swa-cart-line-remove", type: "button", "aria-label": "Remove item" }, "\xD7");
        remove.addEventListener("click", async () => {
          if (remove.dataset.confirm !== "true") {
            remove.dataset.confirm = "true";
            remove.textContent = "Remove?";
            setTimeout(() => {
              remove.dataset.confirm = "false";
              remove.textContent = "\xD7";
            }, 3e3);
            return;
          }
          const next = await removeLine(line.key);
          render(next);
        });
        node.appendChild(el(
          "div",
          { class: "swa-cart-line" },
          line.image ? el("img", { class: "swa-cart-line-img", src: line.image, alt: line.title, loading: "lazy" }) : el("div", { class: "swa-cart-line-img" }),
          el(
            "div",
            { class: "swa-cart-line-meta" },
            el("div", { class: "swa-cart-line-title" }, line.title),
            line.variant ? el("div", { class: "swa-cart-line-variant" }, line.variant) : null,
            el(
              "div",
              { class: "swa-cart-line-controls" },
              stepper,
              remove,
              el("div", { class: "swa-cart-line-price" }, formatMoney(line.linePrice, cart.currency))
            )
          )
        ));
      }
      const discountWrap = el("div", { class: "swa-cart-discount" });
      const toggle = el(
        "button",
        { class: "swa-cart-discount-toggle", type: "button" },
        cart.discountCode ? `Discount: ${cart.discountCode} \xB7 Change` : "Have a code? \u25BE"
      );
      const form = el(
        "form",
        { class: "swa-cart-discount-form", style: "display:none" },
        el("input", { type: "text", placeholder: "Enter code", "aria-label": "Discount code" }),
        el("button", { type: "submit", class: "swa-chip" }, "Apply")
      );
      const errLine = el("div", { class: "swa-cart-discount-error" });
      toggle.addEventListener("click", () => {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = form.querySelector("input").value.trim();
        if (!code) return;
        errLine.textContent = "";
        try {
          const next = await applyDiscount(code);
          if (!next.discountCode || next.discountCode.toLowerCase() !== code.toLowerCase()) {
            errLine.textContent = "Code invalid or expired";
            return;
          }
          render(next);
        } catch {
          errLine.textContent = "Code invalid or expired";
        }
      });
      discountWrap.append(toggle, form, errLine);
      node.appendChild(discountWrap);
      node.appendChild(el(
        "div",
        { class: "swa-cart-totals" },
        el(
          "div",
          { class: "swa-cart-totals-row subtotal" },
          el("span", null, "Subtotal"),
          el("span", null, formatMoney(cart.subtotal, cart.currency))
        ),
        el(
          "div",
          { class: "swa-cart-totals-row swa-cart-shipping" },
          el("span", null, "Shipping"),
          el("span", null, "Calculated next step")
        )
      ));
      node.appendChild(el("a", { class: "swa-cart-checkout", href: getCheckoutUrl() }, "Checkout \u2192"));
      const saveBtn = el("button", { class: "swa-cart-save-link", type: "button" }, "Save cart for later");
      saveBtn.addEventListener("click", () => onSaveForLater && onSaveForLater(cart));
      node.appendChild(saveBtn);
    }
    if (initialCart) {
      render(initialCart);
    } else {
      getCart().then(render).catch((err) => {
        console.warn("[swa] cart fetch failed", err);
        node.appendChild(el("div", { class: "swa-cart-empty" }, "Couldn't load cart."));
      });
    }
    return { node, refresh: async () => {
      const c = await getCart();
      render(c);
    } };
  }
  var init_ui_cart_summary = __esm({
    "extensions/chat-bubble/assets/modules/ui-cart-summary.js"() {
      "use strict";
      init_dom();
      init_format();
      init_cart();
    }
  });

  // extensions/chat-bubble/assets/modules/ui-save-cart.js
  var ui_save_cart_exports = {};
  __export(ui_save_cart_exports, {
    createSaveCartCard: () => createSaveCartCard
  });
  function createSaveCartCard({ onSubmit }) {
    const node = el("div", { class: "swa-save-cart" });
    node.appendChild(el("div", { class: "swa-save-cart-title" }, "Save your cart for later"));
    node.appendChild(el("div", { class: "swa-save-cart-sub" }, "We'll email you a link \u2014 pick up where you left off."));
    const emailField = el("div", { class: "swa-save-cart-field" });
    const emailInput = el("input", { type: "email", placeholder: "you@example.com", required: "true", "aria-label": "Email" });
    emailField.appendChild(emailInput);
    const smsField = el("div", { class: "swa-save-cart-field", style: "display:none" });
    const smsInput = el("input", { type: "tel", placeholder: "+1 555-1234", "aria-label": "Phone (optional)" });
    smsField.appendChild(smsInput);
    const smsToggle = el("button", { class: "swa-save-cart-sms-toggle", type: "button" }, "Add SMS reminder \u25BE");
    smsToggle.addEventListener("click", () => {
      smsField.style.display = smsField.style.display === "none" ? "block" : "none";
      smsToggle.textContent = smsField.style.display === "none" ? "Add SMS reminder \u25BE" : "Hide SMS reminder \u25B4";
    });
    const consent = el(
      "div",
      { class: "swa-save-cart-consent" },
      "By saving, you agree to receive a cart reminder. No marketing."
    );
    const submit = el("button", { class: "swa-save-cart-submit", type: "submit" }, "Send me the link");
    const success = el("div", { class: "swa-save-cart-success", style: "display:none" }, "\u2713 Sent \u2014 check your email.");
    const form = el("form", null, emailField, smsToggle, smsField, consent, submit, success);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) return;
      submit.disabled = true;
      submit.textContent = "Sending\u2026";
      try {
        await onSubmit({ email, sms: smsInput.value.trim() || null });
        form.querySelectorAll("input, button").forEach((elN) => {
          elN.disabled = true;
        });
        success.style.display = "block";
        submit.textContent = "Sent";
      } catch {
        submit.disabled = false;
        submit.textContent = "Try again";
      }
    });
    node.appendChild(form);
    return node;
  }
  var init_ui_save_cart = __esm({
    "extensions/chat-bubble/assets/modules/ui-save-cart.js"() {
      "use strict";
      init_dom();
    }
  });

  // extensions/chat-bubble/assets/modules/ui-order-status.js
  var ui_order_status_exports = {};
  __export(ui_order_status_exports, {
    createOrderStatus: () => createOrderStatus
  });
  function createOrderStatus(block2, { onReorder } = {}) {
    const node = el("div", { class: "swa-order" });
    node.appendChild(el(
      "div",
      { class: "swa-order-header" },
      el("div", { class: "swa-order-number" }, `Order #${block2.orderNumber} \xB7 ${block2.date || ""}`),
      el(
        "div",
        { class: "swa-order-status-pill", dataset: { status: block2.status } },
        block2.status.charAt(0).toUpperCase() + block2.status.slice(1)
      )
    ));
    const itemsWrap = el("div", { class: "swa-order-items" });
    const visible = (block2.items || []).slice(0, 3);
    for (const item of visible) {
      itemsWrap.appendChild(el(
        "div",
        { class: "swa-order-item" },
        item.image ? el("img", { src: item.image, alt: item.title, loading: "lazy" }) : null,
        el("div", { class: "swa-order-item-meta" }, item.title),
        el("div", { class: "swa-order-item-qty" }, `\xD7 ${formatQty(item.quantity)}`)
      ));
    }
    const more = (block2.items || []).length - visible.length;
    if (more > 0) {
      itemsWrap.appendChild(el("div", { class: "swa-order-item-qty" }, `+${more} more`));
    }
    node.appendChild(itemsWrap);
    node.appendChild(el(
      "div",
      { class: "swa-order-total" },
      el("span", null, "Total"),
      el("span", null, formatMoney(block2.total, block2.currency))
    ));
    const actions = el("div", { class: "swa-order-actions" });
    if (block2.trackingUrl && (block2.status === "shipped" || block2.status === "delivered")) {
      actions.appendChild(el("a", {
        class: "swa-order-track",
        href: block2.trackingUrl,
        target: "_blank",
        rel: "noopener"
      }, "Track \u2197"));
    }
    const reorderBtn = el("button", { class: "swa-order-reorder", type: "button" }, "Reorder");
    reorderBtn.addEventListener("click", () => onReorder && onReorder(block2));
    actions.appendChild(reorderBtn);
    node.appendChild(actions);
    return node;
  }
  var init_ui_order_status = __esm({
    "extensions/chat-bubble/assets/modules/ui-order-status.js"() {
      "use strict";
      init_dom();
      init_format();
    }
  });

  // extensions/chat-bubble/assets/modules/ui-auth-prompt.js
  var ui_auth_prompt_exports = {};
  __export(ui_auth_prompt_exports, {
    createAuthPrompt: () => createAuthPrompt
  });
  function createAuthPrompt(block2, { onSuccess } = {}) {
    const node = el("div", { class: "swa-auth" });
    const title = el("div", { class: "swa-auth-title" }, block2.title || "Sign in to continue");
    const sub = el("div", { class: "swa-auth-sub" }, block2.subtitle || "Connect your account to see your orders.");
    const btn = el("button", { class: "swa-auth-button", type: "button" }, "Sign in");
    btn.addEventListener("click", () => openAuthPopup(block2.authUrl, () => {
      title.remove();
      sub.remove();
      btn.remove();
      node.appendChild(el("div", { class: "swa-auth-success" }, "\u2713 Connected"));
      onSuccess && onSuccess();
    }));
    node.append(title, sub, btn);
    return node;
  }
  function openAuthPopup(url, onAuthSuccess) {
    const left = window.screenX + (window.innerWidth - POPUP_WIDTH) / 2;
    const top = window.screenY + (window.innerHeight - POPUP_HEIGHT) / 2;
    const popup = window.open(url, "swa-auth", `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`);
    if (!popup) {
      window.location.href = url;
      return;
    }
    function onMessage(e) {
      if (e.data && e.data.type === "shop_auth_success") {
        window.removeEventListener("message", onMessage);
        onAuthSuccess();
        try {
          popup.close();
        } catch {
        }
      }
    }
    window.addEventListener("message", onMessage);
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener("message", onMessage);
      }
    }, 500);
  }
  var POPUP_WIDTH, POPUP_HEIGHT;
  var init_ui_auth_prompt = __esm({
    "extensions/chat-bubble/assets/modules/ui-auth-prompt.js"() {
      "use strict";
      init_dom();
      POPUP_WIDTH = 480;
      POPUP_HEIGHT = 640;
    }
  });

  // extensions/chat-bubble/assets/modules/ui-sizing-widget.js
  var ui_sizing_widget_exports = {};
  __export(ui_sizing_widget_exports, {
    createSizingWidget: () => createSizingWidget
  });
  function createSizingWidget(block2, { onComplete } = {}) {
    const steps = block2.steps || [];
    const answers = {};
    let currentIdx = 0;
    const node = el("div", { class: "swa-sizing", role: "region", "aria-label": block2.title || "Size guide" });
    const title = el("div", { class: "swa-sizing-title" }, block2.title || "Size guide");
    const stepsRow = el("div", { class: "swa-sizing-steps" });
    for (let i = 0; i < steps.length; i++) stepsRow.appendChild(el("div", { class: "swa-sizing-step-dot" }));
    const summariesWrap = el("div");
    const activeWrap = el("div");
    const fallbackWrap = el("div");
    if (block2.fallback) {
      fallbackWrap.className = "swa-sizing-fallback";
      fallbackWrap.append(
        "Don't know yours? ",
        el("a", { href: block2.fallback.url, target: "_blank", rel: "noopener" }, block2.fallback.label || "Print a sizer \u2192")
      );
    }
    node.append(title, stepsRow, summariesWrap, activeWrap, fallbackWrap);
    function renderActive() {
      activeWrap.innerHTML = "";
      if (currentIdx >= steps.length) {
        activeWrap.appendChild(el("div", { class: "swa-sizing-complete" }, "\u2713 All set \u2014 finding your match\u2026"));
        onComplete && onComplete(answers);
        return;
      }
      const step = steps[currentIdx];
      activeWrap.appendChild(el("div", { class: "swa-sizing-question" }, step.question));
      const chipsRow = el("div", { class: "swa-sizing-chips" });
      for (const opt of step.options || []) {
        const chip = el("button", { class: "swa-sizing-chip", type: "button" }, opt.label);
        chip.addEventListener("click", () => {
          answers[step.id] = opt.value;
          const label = step.label || step.id.charAt(0).toUpperCase() + step.id.slice(1);
          const summary = el(
            "div",
            { class: "swa-sizing-summary" },
            el("strong", null, label),
            ": ",
            opt.label
          );
          summariesWrap.appendChild(summary);
          stepsRow.children[currentIdx].dataset.state = "done";
          currentIdx += 1;
          if (currentIdx < steps.length) stepsRow.children[currentIdx].dataset.state = "active";
          renderActive();
        });
        chipsRow.appendChild(chip);
      }
      activeWrap.appendChild(chipsRow);
    }
    if (steps.length > 0) stepsRow.children[0].dataset.state = "active";
    renderActive();
    return { node };
  }
  var init_ui_sizing_widget = __esm({
    "extensions/chat-bubble/assets/modules/ui-sizing-widget.js"() {
      "use strict";
      init_dom();
    }
  });

  // extensions/chat-bubble/assets/modules/ui-compare-sheet.js
  var ui_compare_sheet_exports = {};
  __export(ui_compare_sheet_exports, {
    createCompareLink: () => createCompareLink,
    openCompareSheet: () => openCompareSheet
  });
  function createCompareLink(block2, { onOpen } = {}) {
    const node = el(
      "button",
      { class: "swa-compare-link", type: "button" },
      `Compare: ${(block2.items || []).map((i) => i.title).join(" \xB7 ")} \u2197`
    );
    node.addEventListener("click", () => onOpen && onOpen(block2));
    return node;
  }
  function openCompareSheet(block2, { container }) {
    const backdrop = el("div", { class: "swa-compare-sheet-backdrop" });
    const sheet = el("div", { class: "swa-compare-sheet", role: "dialog", "aria-label": "Compare products" });
    const closeBtn = el("button", {
      class: "swa-icon-button",
      type: "button",
      "aria-label": "Close compare"
    });
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    sheet.appendChild(el(
      "div",
      { class: "swa-compare-sheet-header" },
      el("div", { class: "swa-compare-sheet-title" }, "Compare"),
      closeBtn
    ));
    const items = block2.items || [];
    const attrKeys = [...new Set(items.flatMap((i) => Object.keys(i.attrs || {})))];
    const body = el("div", { class: "swa-compare-sheet-body" });
    const table = el("div", { class: "swa-compare-table" });
    table.style.setProperty("--cols", String(items.length));
    const head = el("div", { class: "swa-compare-row head" }, el("div", { class: "label" }, ""));
    for (const it of items) head.appendChild(el("div", null, it.title));
    table.appendChild(head);
    const thumbs = el("div", { class: "swa-compare-row" }, el("div", { class: "label" }, ""));
    for (const it of items) {
      const cell = el("div");
      if (it.image) cell.appendChild(el("img", { class: "thumb", src: it.image, alt: it.title }));
      else cell.appendChild(el("div", { class: "thumb" }));
      thumbs.appendChild(cell);
    }
    table.appendChild(thumbs);
    for (const key of attrKeys) {
      const row = el("div", { class: "swa-compare-row" }, el("div", { class: "label" }, key));
      for (const it of items) row.appendChild(el("div", null, (it.attrs || {})[key] ?? "\u2014"));
      table.appendChild(row);
    }
    body.appendChild(table);
    sheet.appendChild(body);
    if (block2.verdict) sheet.appendChild(el("div", { class: "swa-compare-verdict" }, `\u2192 ${block2.verdict}`));
    function close() {
      sheet.dataset.open = "false";
      backdrop.dataset.visible = "false";
      setTimeout(() => {
        sheet.remove();
        backdrop.remove();
      }, 320);
    }
    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    container.append(backdrop, sheet);
    requestAnimationFrame(() => {
      backdrop.dataset.visible = "true";
      sheet.dataset.open = "true";
    });
    return { close };
  }
  var init_ui_compare_sheet = __esm({
    "extensions/chat-bubble/assets/modules/ui-compare-sheet.js"() {
      "use strict";
      init_dom();
    }
  });

  // extensions/chat-bubble/assets/modules/ui-image-preview.js
  var ui_image_preview_exports = {};
  __export(ui_image_preview_exports, {
    createImagePreview: () => createImagePreview
  });
  function createImagePreview(block2) {
    return el(
      "div",
      { class: "swa-image-preview" },
      el("img", { src: block2.dataUrl, alt: block2.alt || "Uploaded image", loading: "lazy" })
    );
  }
  var init_ui_image_preview = __esm({
    "extensions/chat-bubble/assets/modules/ui-image-preview.js"() {
      "use strict";
      init_dom();
    }
  });

  // extensions/chat-bubble/assets/chat.src.js
  init_dom();

  // extensions/chat-bubble/assets/modules/state.js
  function createState(initial) {
    const values = { ...initial };
    const subs = /* @__PURE__ */ new Map();
    for (const k of Object.keys(initial)) subs.set(k, /* @__PURE__ */ new Set());
    function assertKey(k) {
      if (!subs.has(k)) {
        throw new Error(`WidgetState: unknown key "${k}". Define it in createState's initial map.`);
      }
    }
    return {
      get(k) {
        assertKey(k);
        return values[k];
      },
      set(k, v) {
        assertKey(k);
        if (values[k] === v) return;
        values[k] = v;
        for (const fn of subs.get(k)) fn(v);
      },
      subscribe(k, fn) {
        assertKey(k);
        subs.get(k).add(fn);
        return () => subs.get(k).delete(fn);
      }
    };
  }
  var INITIAL_STATE = {
    isOpen: false,
    isMinimized: false,
    hasUnread: false,
    pendingMessagePreview: null,
    isOnline: true,
    rateLimitedUntil: 0,
    shopName: "",
    brandColor: "#5046E4"
  };

  // extensions/chat-bubble/assets/modules/ui-launcher.js
  init_dom();

  // extensions/chat-bubble/assets/modules/orb.js
  function createOrb({ size, paused = false } = {}) {
    if (typeof size !== "number" || size <= 0) {
      throw new Error(`createOrb: size must be a positive number, got ${size}`);
    }
    const el2 = document.createElement("div");
    el2.className = "swa-orb";
    el2.style.width = `${size}px`;
    el2.style.height = `${size}px`;
    if (paused) el2.classList.add("swa-orb-paused");
    if (size >= 22) {
      const sparkle = document.createElement("span");
      sparkle.className = "swa-orb-sparkle";
      sparkle.setAttribute("aria-hidden", "true");
      sparkle.textContent = "\u2726";
      el2.appendChild(sparkle);
    }
    return el2;
  }

  // extensions/chat-bubble/assets/modules/ui-launcher.js
  var COLLAPSE_AFTER_MS = 1e4;
  function createLauncher({ state, sizeDesktop = 60, sizeMobile = 56 }) {
    const isMobile = () => window.matchMedia("(max-width: 480px)").matches;
    const baseSize = () => isMobile() ? sizeMobile : sizeDesktop;
    const orb = createOrb({ size: baseSize() });
    const label = el("span", { class: "swa-launcher-label" });
    const dot = el("span", { class: "swa-launcher-unread-dot" });
    const button = el("button", {
      class: "swa-launcher",
      type: "button",
      "aria-label": "Open shopping assistant",
      dataset: { mode: "circle" }
    }, orb);
    const previewBubble = el("div", {
      class: "swa-preview-bubble",
      dataset: { visible: "false" },
      role: "status",
      "aria-live": "polite"
    });
    const previewSource = el("div", { class: "swa-preview-source" });
    const previewBody = el("div", { class: "swa-preview-body" });
    previewBubble.append(previewSource, previewBody);
    button.addEventListener("click", () => {
      state.set("isOpen", true);
      state.set("hasUnread", false);
      state.set("pendingMessagePreview", null);
    });
    let collapseTimer = null;
    function applyMode() {
      const hasUnread = state.get("hasUnread");
      const isOpen = state.get("isOpen");
      const showPill = hasUnread && !isOpen;
      if (showPill) {
        button.dataset.mode = "pill";
        button.setAttribute("aria-label", `${state.get("shopName") || "Shop"} AI \u2014 new message`);
        const orbSize = 40;
        orb.style.width = `${orbSize}px`;
        orb.style.height = `${orbSize}px`;
        label.textContent = `${state.get("shopName") || "Shop"} AI`;
        if (!button.contains(label)) button.append(label, dot);
        clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => {
          state.set("hasUnread", false);
          state.set("pendingMessagePreview", null);
        }, COLLAPSE_AFTER_MS);
      } else {
        button.dataset.mode = "circle";
        button.setAttribute("aria-label", "Open shopping assistant");
        orb.style.width = `${baseSize()}px`;
        orb.style.height = `${baseSize()}px`;
        label.remove();
        dot.remove();
        clearTimeout(collapseTimer);
      }
    }
    function applyPreview() {
      const preview = state.get("pendingMessagePreview");
      const isOpen = state.get("isOpen");
      if (preview && !isOpen) {
        previewSource.textContent = `${state.get("shopName") || "Shop"} AI \xB7 just now`;
        previewBody.textContent = preview;
        previewBubble.dataset.visible = "true";
      } else {
        previewBubble.dataset.visible = "false";
      }
    }
    state.subscribe("hasUnread", applyMode);
    state.subscribe("isOpen", applyMode);
    state.subscribe("shopName", applyMode);
    state.subscribe("pendingMessagePreview", applyPreview);
    state.subscribe("isOpen", applyPreview);
    const mql = window.matchMedia("(max-width: 480px)");
    const handle = () => applyMode();
    if (mql.addEventListener) mql.addEventListener("change", handle);
    return { node: button, previewBubble };
  }

  // extensions/chat-bubble/assets/modules/ui-window.js
  init_dom();

  // extensions/chat-bubble/assets/modules/a11y.js
  var FOCUSABLE_SEL = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  function trapFocus(container) {
    function onKey(e) {
      if (e.key !== "Tab") return;
      const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SEL)).filter((elN) => !elN.hidden);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener("keydown", onKey);
    return () => container.removeEventListener("keydown", onKey);
  }

  // extensions/chat-bubble/assets/modules/ui-window.js
  function createWindow({ state, launcher }) {
    const headerSlot = el("div", { class: "swa-window-header-slot" });
    const streamSlot = el("div", { class: "swa-window-stream-slot" });
    const dockSlot = el("div", { class: "swa-window-dock-slot" });
    const composerSlot = el("div", { class: "swa-window-composer-slot" });
    const footerSlot = el("div", { class: "swa-window-footer-slot" });
    const node = el("div", {
      class: "swa-window",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Shopping assistant",
      "aria-hidden": "true"
    }, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot);
    const setViewportVar = () => {
      document.documentElement.style.setProperty("--swa-viewport-height", `${window.innerHeight}px`);
    };
    setViewportVar();
    window.addEventListener("resize", setViewportVar);
    let lastFocused = null;
    let releaseTrap = null;
    state.subscribe("isOpen", (isOpen) => {
      node.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (isOpen) {
        lastFocused = document.activeElement;
        document.body.classList.add("swa-locked");
        requestAnimationFrame(() => {
          const composerInput = qs(".swa-composer input, .swa-composer textarea", node);
          (composerInput || node).focus();
        });
        releaseTrap = trapFocus(node);
      } else {
        document.body.classList.remove("swa-locked");
        if (releaseTrap) {
          releaseTrap();
          releaseTrap = null;
        }
        if (lastFocused && typeof lastFocused.focus === "function") {
          lastFocused.focus();
        } else if (launcher) {
          launcher.focus();
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.get("isOpen")) {
        state.set("isOpen", false);
      }
    });
    return { node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot };
  }

  // extensions/chat-bubble/assets/modules/ui-header.js
  init_dom();
  var ICONS = {
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  };
  function iconSvg(pathInner) {
    const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg2.setAttribute("viewBox", "0 0 24 24");
    svg2.innerHTML = pathInner;
    return svg2;
  }
  function createHeader({ state }) {
    const orb = createOrb({ size: 32 });
    const name = el("div", { class: "swa-header-name" });
    const statusDot = el("span", { class: "swa-status-dot" });
    const statusText = el("span", { class: "swa-header-status-text" });
    const status = el("div", { class: "swa-header-status" }, statusDot, statusText);
    const title = el("div", { class: "swa-header-title" }, name, status);
    const minimizeBtn = el("button", {
      class: "swa-icon-button",
      type: "button",
      "aria-label": "Minimize"
    }, iconSvg(ICONS.minus));
    minimizeBtn.addEventListener("click", () => state.set("isOpen", false));
    const closeBtn = el("button", {
      class: "swa-icon-button",
      type: "button",
      "aria-label": "Close"
    }, iconSvg(ICONS.close));
    closeBtn.addEventListener("click", () => state.set("isOpen", false));
    const actions = el("div", { class: "swa-header-actions" }, minimizeBtn, closeBtn);
    const node = el("header", { class: "swa-header" }, orb, title, actions);
    function render() {
      const shop = state.get("shopName");
      name.textContent = shop ? `${shop} AI` : "Shopping Assistant";
      const online = state.get("isOnline");
      statusDot.dataset.status = online ? "online" : "offline";
      statusText.textContent = online ? "Online \xB7 AI-powered" : "Offline";
    }
    render();
    state.subscribe("shopName", render);
    state.subscribe("isOnline", render);
    return node;
  }

  // extensions/chat-bubble/assets/modules/ui-composer.js
  init_dom();
  var ICONS2 = {
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'
  };
  function icon(inner) {
    const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg2.setAttribute("viewBox", "0 0 24 24");
    svg2.innerHTML = inner;
    return svg2;
  }
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function createComposer({ onSubmit, onAttachImage } = {}) {
    const textarea = el("textarea", {
      class: "swa-composer-input",
      rows: "1",
      placeholder: "Type your message\u2026",
      "aria-label": "Message"
    });
    const fileInput = el("input", {
      type: "file",
      accept: "image/*",
      style: "display:none",
      "aria-hidden": "true"
    });
    const attachBtn = el("button", {
      class: "swa-icon-button swa-composer-attach",
      type: "button",
      "aria-label": "Attach image"
    }, icon(ICONS2.paperclip));
    const sendBtn = el("button", {
      class: "swa-composer-send",
      type: "submit",
      "aria-label": "Send message",
      disabled: "disabled"
    }, icon(ICONS2.send));
    const pendingImageWrap = el("div", { class: "swa-composer-pending-image", style: "display:none" });
    const node = el("form", { class: "swa-composer" }, attachBtn, fileInput, textarea, sendBtn);
    let pendingImage = null;
    function autoExpand() {
      textarea.style.height = "auto";
      const max = 4 * 22;
      textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
    }
    function syncEnabled() {
      sendBtn.disabled = textarea.value.trim().length === 0 && !pendingImage;
    }
    function clearImage() {
      pendingImage = null;
      pendingImageWrap.innerHTML = "";
      pendingImageWrap.style.display = "none";
      attachBtn.dataset.pending = "false";
      syncEnabled();
    }
    function setPendingImage(image) {
      pendingImage = image;
      pendingImageWrap.innerHTML = "";
      pendingImageWrap.style.display = "flex";
      pendingImageWrap.appendChild(el("img", { src: image.dataUrl, alt: image.name }));
      pendingImageWrap.appendChild(el("span", null, image.name));
      const remove = el("button", { type: "button", "aria-label": "Remove image" }, "\xD7");
      remove.addEventListener("click", clearImage);
      pendingImageWrap.appendChild(remove);
      attachBtn.dataset.pending = "true";
      syncEnabled();
    }
    function submit() {
      const text2 = textarea.value.trim();
      if (!text2 && !pendingImage) return;
      const payload = { text: text2 };
      if (pendingImage) payload.image = pendingImage;
      textarea.value = "";
      clearImage();
      autoExpand();
      syncEnabled();
      onSubmit && onSubmit(payload);
    }
    textarea.addEventListener("input", () => {
      autoExpand();
      syncEnabled();
    });
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    node.addEventListener("submit", (e) => {
      e.preventDefault();
      submit();
    });
    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (file.size > MAX_IMAGE_BYTES) {
        alert("Image too large (max 5MB).");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("Only image files are supported.");
        return;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        const image = { dataUrl, name: file.name };
        setPendingImage(image);
        onAttachImage && onAttachImage(image);
      } catch {
        alert("Could not read image.");
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        textarea.focus();
      }
    });
    return { node, pendingImageNode: pendingImageWrap, submit, focus: () => textarea.focus(), clearImage };
  }

  // extensions/chat-bubble/assets/modules/ui-stream.js
  init_dom();

  // extensions/chat-bubble/assets/modules/ui-turn.js
  init_dom();

  // node_modules/marked/lib/marked.esm.js
  function _getDefaults() {
    return {
      async: false,
      breaks: false,
      extensions: null,
      gfm: true,
      hooks: null,
      pedantic: false,
      renderer: null,
      silent: false,
      tokenizer: null,
      walkTokens: null
    };
  }
  var _defaults = _getDefaults();
  function changeDefaults(newDefaults) {
    _defaults = newDefaults;
  }
  var escapeTest = /[&<>"']/;
  var escapeReplace = new RegExp(escapeTest.source, "g");
  var escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
  var escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, "g");
  var escapeReplacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  var getEscapeReplacement = (ch) => escapeReplacements[ch];
  function escape$1(html3, encode) {
    if (encode) {
      if (escapeTest.test(html3)) {
        return html3.replace(escapeReplace, getEscapeReplacement);
      }
    } else {
      if (escapeTestNoEncode.test(html3)) {
        return html3.replace(escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html3;
  }
  var caret = /(^|[^\[])\^/g;
  function edit(regex, opt) {
    let source = typeof regex === "string" ? regex : regex.source;
    opt = opt || "";
    const obj = {
      replace: (name, val) => {
        let valSource = typeof val === "string" ? val : val.source;
        valSource = valSource.replace(caret, "$1");
        source = source.replace(name, valSource);
        return obj;
      },
      getRegex: () => {
        return new RegExp(source, opt);
      }
    };
    return obj;
  }
  function cleanUrl(href) {
    try {
      href = encodeURI(href).replace(/%25/g, "%");
    } catch {
      return null;
    }
    return href;
  }
  var noopTest = { exec: () => null };
  function splitCells(tableRow, count) {
    const row = tableRow.replace(/\|/g, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === "\\")
        escaped = !escaped;
      if (escaped) {
        return "|";
      } else {
        return " |";
      }
    }), cells = row.split(/ \|/);
    let i = 0;
    if (!cells[0].trim()) {
      cells.shift();
    }
    if (cells.length > 0 && !cells[cells.length - 1].trim()) {
      cells.pop();
    }
    if (count) {
      if (cells.length > count) {
        cells.splice(count);
      } else {
        while (cells.length < count)
          cells.push("");
      }
    }
    for (; i < cells.length; i++) {
      cells[i] = cells[i].trim().replace(/\\\|/g, "|");
    }
    return cells;
  }
  function rtrim(str, c, invert) {
    const l = str.length;
    if (l === 0) {
      return "";
    }
    let suffLen = 0;
    while (suffLen < l) {
      const currChar = str.charAt(l - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }
    return str.slice(0, l - suffLen);
  }
  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    let level = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    return -1;
  }
  function outputLink(cap, link2, raw, lexer2) {
    const href = link2.href;
    const title = link2.title ? escape$1(link2.title) : null;
    const text2 = cap[1].replace(/\\([\[\]])/g, "$1");
    if (cap[0].charAt(0) !== "!") {
      lexer2.state.inLink = true;
      const token = {
        type: "link",
        raw,
        href,
        title,
        text: text2,
        tokens: lexer2.inlineTokens(text2)
      };
      lexer2.state.inLink = false;
      return token;
    }
    return {
      type: "image",
      raw,
      href,
      title,
      text: escape$1(text2)
    };
  }
  function indentCodeCompensation(raw, text2) {
    const matchIndentToCode = raw.match(/^(\s+)(?:```)/);
    if (matchIndentToCode === null) {
      return text2;
    }
    const indentToCode = matchIndentToCode[1];
    return text2.split("\n").map((node) => {
      const matchIndentInNode = node.match(/^\s+/);
      if (matchIndentInNode === null) {
        return node;
      }
      const [indentInNode] = matchIndentInNode;
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length);
      }
      return node;
    }).join("\n");
  }
  var _Tokenizer = class {
    options;
    rules;
    // set by the lexer
    lexer;
    // set by the lexer
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(src) {
      const cap = this.rules.block.newline.exec(src);
      if (cap && cap[0].length > 0) {
        return {
          type: "space",
          raw: cap[0]
        };
      }
    }
    code(src) {
      const cap = this.rules.block.code.exec(src);
      if (cap) {
        const text2 = cap[0].replace(/^(?: {1,4}| {0,3}\t)/gm, "");
        return {
          type: "code",
          raw: cap[0],
          codeBlockStyle: "indented",
          text: !this.options.pedantic ? rtrim(text2, "\n") : text2
        };
      }
    }
    fences(src) {
      const cap = this.rules.block.fences.exec(src);
      if (cap) {
        const raw = cap[0];
        const text2 = indentCodeCompensation(raw, cap[3] || "");
        return {
          type: "code",
          raw,
          lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
          text: text2
        };
      }
    }
    heading(src) {
      const cap = this.rules.block.heading.exec(src);
      if (cap) {
        let text2 = cap[2].trim();
        if (/#$/.test(text2)) {
          const trimmed = rtrim(text2, "#");
          if (this.options.pedantic) {
            text2 = trimmed.trim();
          } else if (!trimmed || / $/.test(trimmed)) {
            text2 = trimmed.trim();
          }
        }
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[1].length,
          text: text2,
          tokens: this.lexer.inline(text2)
        };
      }
    }
    hr(src) {
      const cap = this.rules.block.hr.exec(src);
      if (cap) {
        return {
          type: "hr",
          raw: rtrim(cap[0], "\n")
        };
      }
    }
    blockquote(src) {
      const cap = this.rules.block.blockquote.exec(src);
      if (cap) {
        let lines = rtrim(cap[0], "\n").split("\n");
        let raw = "";
        let text2 = "";
        const tokens = [];
        while (lines.length > 0) {
          let inBlockquote = false;
          const currentLines = [];
          let i;
          for (i = 0; i < lines.length; i++) {
            if (/^ {0,3}>/.test(lines[i])) {
              currentLines.push(lines[i]);
              inBlockquote = true;
            } else if (!inBlockquote) {
              currentLines.push(lines[i]);
            } else {
              break;
            }
          }
          lines = lines.slice(i);
          const currentRaw = currentLines.join("\n");
          const currentText = currentRaw.replace(/\n {0,3}((?:=+|-+) *)(?=\n|$)/g, "\n    $1").replace(/^ {0,3}>[ \t]?/gm, "");
          raw = raw ? `${raw}
${currentRaw}` : currentRaw;
          text2 = text2 ? `${text2}
${currentText}` : currentText;
          const top = this.lexer.state.top;
          this.lexer.state.top = true;
          this.lexer.blockTokens(currentText, tokens, true);
          this.lexer.state.top = top;
          if (lines.length === 0) {
            break;
          }
          const lastToken = tokens[tokens.length - 1];
          if (lastToken?.type === "code") {
            break;
          } else if (lastToken?.type === "blockquote") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.blockquote(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
            text2 = text2.substring(0, text2.length - oldToken.text.length) + newToken.text;
            break;
          } else if (lastToken?.type === "list") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.list(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
            text2 = text2.substring(0, text2.length - oldToken.raw.length) + newToken.raw;
            lines = newText.substring(tokens[tokens.length - 1].raw.length).split("\n");
            continue;
          }
        }
        return {
          type: "blockquote",
          raw,
          tokens,
          text: text2
        };
      }
    }
    list(src) {
      let cap = this.rules.block.list.exec(src);
      if (cap) {
        let bull = cap[1].trim();
        const isordered = bull.length > 1;
        const list2 = {
          type: "list",
          raw: "",
          ordered: isordered,
          start: isordered ? +bull.slice(0, -1) : "",
          loose: false,
          items: []
        };
        bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
        if (this.options.pedantic) {
          bull = isordered ? bull : "[*+-]";
        }
        const itemRegex = new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`);
        let endsWithBlankLine = false;
        while (src) {
          let endEarly = false;
          let raw = "";
          let itemContents = "";
          if (!(cap = itemRegex.exec(src))) {
            break;
          }
          if (this.rules.block.hr.test(src)) {
            break;
          }
          raw = cap[0];
          src = src.substring(raw.length);
          let line = cap[2].split("\n", 1)[0].replace(/^\t+/, (t) => " ".repeat(3 * t.length));
          let nextLine = src.split("\n", 1)[0];
          let blankLine = !line.trim();
          let indent = 0;
          if (this.options.pedantic) {
            indent = 2;
            itemContents = line.trimStart();
          } else if (blankLine) {
            indent = cap[1].length + 1;
          } else {
            indent = cap[2].search(/[^ ]/);
            indent = indent > 4 ? 1 : indent;
            itemContents = line.slice(indent);
            indent += cap[1].length;
          }
          if (blankLine && /^[ \t]*$/.test(nextLine)) {
            raw += nextLine + "\n";
            src = src.substring(nextLine.length + 1);
            endEarly = true;
          }
          if (!endEarly) {
            const nextBulletRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`);
            const hrRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`);
            const fencesBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`);
            const headingBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`);
            const htmlBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i");
            while (src) {
              const rawLine = src.split("\n", 1)[0];
              let nextLineWithoutTabs;
              nextLine = rawLine;
              if (this.options.pedantic) {
                nextLine = nextLine.replace(/^ {1,4}(?=( {4})*[^ ])/g, "  ");
                nextLineWithoutTabs = nextLine;
              } else {
                nextLineWithoutTabs = nextLine.replace(/\t/g, "    ");
              }
              if (fencesBeginRegex.test(nextLine)) {
                break;
              }
              if (headingBeginRegex.test(nextLine)) {
                break;
              }
              if (htmlBeginRegex.test(nextLine)) {
                break;
              }
              if (nextBulletRegex.test(nextLine)) {
                break;
              }
              if (hrRegex.test(nextLine)) {
                break;
              }
              if (nextLineWithoutTabs.search(/[^ ]/) >= indent || !nextLine.trim()) {
                itemContents += "\n" + nextLineWithoutTabs.slice(indent);
              } else {
                if (blankLine) {
                  break;
                }
                if (line.replace(/\t/g, "    ").search(/[^ ]/) >= 4) {
                  break;
                }
                if (fencesBeginRegex.test(line)) {
                  break;
                }
                if (headingBeginRegex.test(line)) {
                  break;
                }
                if (hrRegex.test(line)) {
                  break;
                }
                itemContents += "\n" + nextLine;
              }
              if (!blankLine && !nextLine.trim()) {
                blankLine = true;
              }
              raw += rawLine + "\n";
              src = src.substring(rawLine.length + 1);
              line = nextLineWithoutTabs.slice(indent);
            }
          }
          if (!list2.loose) {
            if (endsWithBlankLine) {
              list2.loose = true;
            } else if (/\n[ \t]*\n[ \t]*$/.test(raw)) {
              endsWithBlankLine = true;
            }
          }
          let istask = null;
          let ischecked;
          if (this.options.gfm) {
            istask = /^\[[ xX]\] /.exec(itemContents);
            if (istask) {
              ischecked = istask[0] !== "[ ] ";
              itemContents = itemContents.replace(/^\[[ xX]\] +/, "");
            }
          }
          list2.items.push({
            type: "list_item",
            raw,
            task: !!istask,
            checked: ischecked,
            loose: false,
            text: itemContents,
            tokens: []
          });
          list2.raw += raw;
        }
        list2.items[list2.items.length - 1].raw = list2.items[list2.items.length - 1].raw.trimEnd();
        list2.items[list2.items.length - 1].text = list2.items[list2.items.length - 1].text.trimEnd();
        list2.raw = list2.raw.trimEnd();
        for (let i = 0; i < list2.items.length; i++) {
          this.lexer.state.top = false;
          list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
          if (!list2.loose) {
            const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
            const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => /\n.*\n/.test(t.raw));
            list2.loose = hasMultipleLineBreaks;
          }
        }
        if (list2.loose) {
          for (let i = 0; i < list2.items.length; i++) {
            list2.items[i].loose = true;
          }
        }
        return list2;
      }
    }
    html(src) {
      const cap = this.rules.block.html.exec(src);
      if (cap) {
        const token = {
          type: "html",
          block: true,
          raw: cap[0],
          pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
          text: cap[0]
        };
        return token;
      }
    }
    def(src) {
      const cap = this.rules.block.def.exec(src);
      if (cap) {
        const tag2 = cap[1].toLowerCase().replace(/\s+/g, " ");
        const href = cap[2] ? cap[2].replace(/^<(.*)>$/, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
        const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
        return {
          type: "def",
          tag: tag2,
          raw: cap[0],
          href,
          title
        };
      }
    }
    table(src) {
      const cap = this.rules.block.table.exec(src);
      if (!cap) {
        return;
      }
      if (!/[:|]/.test(cap[2])) {
        return;
      }
      const headers = splitCells(cap[1]);
      const aligns = cap[2].replace(/^\||\| *$/g, "").split("|");
      const rows = cap[3] && cap[3].trim() ? cap[3].replace(/\n[ \t]*$/, "").split("\n") : [];
      const item = {
        type: "table",
        raw: cap[0],
        header: [],
        align: [],
        rows: []
      };
      if (headers.length !== aligns.length) {
        return;
      }
      for (const align of aligns) {
        if (/^ *-+: *$/.test(align)) {
          item.align.push("right");
        } else if (/^ *:-+: *$/.test(align)) {
          item.align.push("center");
        } else if (/^ *:-+ *$/.test(align)) {
          item.align.push("left");
        } else {
          item.align.push(null);
        }
      }
      for (let i = 0; i < headers.length; i++) {
        item.header.push({
          text: headers[i],
          tokens: this.lexer.inline(headers[i]),
          header: true,
          align: item.align[i]
        });
      }
      for (const row of rows) {
        item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
          return {
            text: cell,
            tokens: this.lexer.inline(cell),
            header: false,
            align: item.align[i]
          };
        }));
      }
      return item;
    }
    lheading(src) {
      const cap = this.rules.block.lheading.exec(src);
      if (cap) {
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[2].charAt(0) === "=" ? 1 : 2,
          text: cap[1],
          tokens: this.lexer.inline(cap[1])
        };
      }
    }
    paragraph(src) {
      const cap = this.rules.block.paragraph.exec(src);
      if (cap) {
        const text2 = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
        return {
          type: "paragraph",
          raw: cap[0],
          text: text2,
          tokens: this.lexer.inline(text2)
        };
      }
    }
    text(src) {
      const cap = this.rules.block.text.exec(src);
      if (cap) {
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          tokens: this.lexer.inline(cap[0])
        };
      }
    }
    escape(src) {
      const cap = this.rules.inline.escape.exec(src);
      if (cap) {
        return {
          type: "escape",
          raw: cap[0],
          text: escape$1(cap[1])
        };
      }
    }
    tag(src) {
      const cap = this.rules.inline.tag.exec(src);
      if (cap) {
        if (!this.lexer.state.inLink && /^<a /i.test(cap[0])) {
          this.lexer.state.inLink = true;
        } else if (this.lexer.state.inLink && /^<\/a>/i.test(cap[0])) {
          this.lexer.state.inLink = false;
        }
        if (!this.lexer.state.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.lexer.state.inRawBlock = true;
        } else if (this.lexer.state.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.lexer.state.inRawBlock = false;
        }
        return {
          type: "html",
          raw: cap[0],
          inLink: this.lexer.state.inLink,
          inRawBlock: this.lexer.state.inRawBlock,
          block: false,
          text: cap[0]
        };
      }
    }
    link(src) {
      const cap = this.rules.inline.link.exec(src);
      if (cap) {
        const trimmedUrl = cap[2].trim();
        if (!this.options.pedantic && /^</.test(trimmedUrl)) {
          if (!/>$/.test(trimmedUrl)) {
            return;
          }
          const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
          if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
            return;
          }
        } else {
          const lastParenIndex = findClosingBracket(cap[2], "()");
          if (lastParenIndex > -1) {
            const start = cap[0].indexOf("!") === 0 ? 5 : 4;
            const linkLen = start + cap[1].length + lastParenIndex;
            cap[2] = cap[2].substring(0, lastParenIndex);
            cap[0] = cap[0].substring(0, linkLen).trim();
            cap[3] = "";
          }
        }
        let href = cap[2];
        let title = "";
        if (this.options.pedantic) {
          const link2 = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href);
          if (link2) {
            href = link2[1];
            title = link2[3];
          }
        } else {
          title = cap[3] ? cap[3].slice(1, -1) : "";
        }
        href = href.trim();
        if (/^</.test(href)) {
          if (this.options.pedantic && !/>$/.test(trimmedUrl)) {
            href = href.slice(1);
          } else {
            href = href.slice(1, -1);
          }
        }
        return outputLink(cap, {
          href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
          title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
        }, cap[0], this.lexer);
      }
    }
    reflink(src, links) {
      let cap;
      if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
        const linkString = (cap[2] || cap[1]).replace(/\s+/g, " ");
        const link2 = links[linkString.toLowerCase()];
        if (!link2) {
          const text2 = cap[0].charAt(0);
          return {
            type: "text",
            raw: text2,
            text: text2
          };
        }
        return outputLink(cap, link2, cap[0], this.lexer);
      }
    }
    emStrong(src, maskedSrc, prevChar = "") {
      let match = this.rules.inline.emStrongLDelim.exec(src);
      if (!match)
        return;
      if (match[3] && prevChar.match(/[\p{L}\p{N}]/u))
        return;
      const nextChar = match[1] || match[2] || "";
      if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
        const lLength = [...match[0]].length - 1;
        let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
        const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
        endReg.lastIndex = 0;
        maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
        while ((match = endReg.exec(maskedSrc)) != null) {
          rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
          if (!rDelim)
            continue;
          rLength = [...rDelim].length;
          if (match[3] || match[4]) {
            delimTotal += rLength;
            continue;
          } else if (match[5] || match[6]) {
            if (lLength % 3 && !((lLength + rLength) % 3)) {
              midDelimTotal += rLength;
              continue;
            }
          }
          delimTotal -= rLength;
          if (delimTotal > 0)
            continue;
          rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
          const lastCharLength = [...match[0]][0].length;
          const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
          if (Math.min(lLength, rLength) % 2) {
            const text3 = raw.slice(1, -1);
            return {
              type: "em",
              raw,
              text: text3,
              tokens: this.lexer.inlineTokens(text3)
            };
          }
          const text2 = raw.slice(2, -2);
          return {
            type: "strong",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
      }
    }
    codespan(src) {
      const cap = this.rules.inline.code.exec(src);
      if (cap) {
        let text2 = cap[2].replace(/\n/g, " ");
        const hasNonSpaceChars = /[^ ]/.test(text2);
        const hasSpaceCharsOnBothEnds = /^ /.test(text2) && / $/.test(text2);
        if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
          text2 = text2.substring(1, text2.length - 1);
        }
        text2 = escape$1(text2, true);
        return {
          type: "codespan",
          raw: cap[0],
          text: text2
        };
      }
    }
    br(src) {
      const cap = this.rules.inline.br.exec(src);
      if (cap) {
        return {
          type: "br",
          raw: cap[0]
        };
      }
    }
    del(src) {
      const cap = this.rules.inline.del.exec(src);
      if (cap) {
        return {
          type: "del",
          raw: cap[0],
          text: cap[2],
          tokens: this.lexer.inlineTokens(cap[2])
        };
      }
    }
    autolink(src) {
      const cap = this.rules.inline.autolink.exec(src);
      if (cap) {
        let text2, href;
        if (cap[2] === "@") {
          text2 = escape$1(cap[1]);
          href = "mailto:" + text2;
        } else {
          text2 = escape$1(cap[1]);
          href = text2;
        }
        return {
          type: "link",
          raw: cap[0],
          text: text2,
          href,
          tokens: [
            {
              type: "text",
              raw: text2,
              text: text2
            }
          ]
        };
      }
    }
    url(src) {
      let cap;
      if (cap = this.rules.inline.url.exec(src)) {
        let text2, href;
        if (cap[2] === "@") {
          text2 = escape$1(cap[0]);
          href = "mailto:" + text2;
        } else {
          let prevCapZero;
          do {
            prevCapZero = cap[0];
            cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
          } while (prevCapZero !== cap[0]);
          text2 = escape$1(cap[0]);
          if (cap[1] === "www.") {
            href = "http://" + cap[0];
          } else {
            href = cap[0];
          }
        }
        return {
          type: "link",
          raw: cap[0],
          text: text2,
          href,
          tokens: [
            {
              type: "text",
              raw: text2,
              text: text2
            }
          ]
        };
      }
    }
    inlineText(src) {
      const cap = this.rules.inline.text.exec(src);
      if (cap) {
        let text2;
        if (this.lexer.state.inRawBlock) {
          text2 = cap[0];
        } else {
          text2 = escape$1(cap[0]);
        }
        return {
          type: "text",
          raw: cap[0],
          text: text2
        };
      }
    }
  };
  var newline = /^(?:[ \t]*(?:\n|$))+/;
  var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
  var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
  var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
  var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
  var bullet = /(?:[*+-]|\d{1,9}[.)])/;
  var lheading = edit(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).getRegex();
  var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
  var blockText = /^[^\n]+/;
  var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
  var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
  var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
  var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
  var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
  var html = edit("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
  var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
  var blockNormal = {
    blockquote,
    code: blockCode,
    def,
    fences,
    heading,
    hr,
    html,
    lheading,
    list,
    newline,
    paragraph,
    table: noopTest,
    text: blockText
  };
  var gfmTable = edit("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockGfm = {
    ...blockNormal,
    table: gfmTable,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
  };
  var blockPedantic = {
    ...blockNormal,
    html: edit(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: noopTest,
    // fences not supported
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
  };
  var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
  var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
  var br = /^( {2,}|\\)\n(?!\s*$)/;
  var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
  var _punctuation = "\\p{P}\\p{S}";
  var punctuation = edit(/^((?![*_])[\spunctuation])/, "u").replace(/punctuation/g, _punctuation).getRegex();
  var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
  var emStrongLDelim = edit(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/, "u").replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimAst = edit("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])", "gu").replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimUnd = edit("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])", "gu").replace(/punct/g, _punctuation).getRegex();
  var anyPunctuation = edit(/\\([punct])/, "gu").replace(/punct/g, _punctuation).getRegex();
  var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
  var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
  var tag = edit("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
  var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
  var link = edit(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
  var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
  var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
  var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
  var inlineNormal = {
    _backpedal: noopTest,
    // only used for GFM url
    anyPunctuation,
    autolink,
    blockSkip,
    br,
    code: inlineCode,
    del: noopTest,
    emStrongLDelim,
    emStrongRDelimAst,
    emStrongRDelimUnd,
    escape,
    link,
    nolink,
    punctuation,
    reflink,
    reflinkSearch,
    tag,
    text: inlineText,
    url: noopTest
  };
  var inlinePedantic = {
    ...inlineNormal,
    link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
    reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
  };
  var inlineGfm = {
    ...inlineNormal,
    escape: edit(escape).replace("])", "~|])").getRegex(),
    url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
  };
  var inlineBreaks = {
    ...inlineGfm,
    br: edit(br).replace("{2,}", "*").getRegex(),
    text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
  };
  var block = {
    normal: blockNormal,
    gfm: blockGfm,
    pedantic: blockPedantic
  };
  var inline = {
    normal: inlineNormal,
    gfm: inlineGfm,
    breaks: inlineBreaks,
    pedantic: inlinePedantic
  };
  var _Lexer = class __Lexer {
    tokens;
    options;
    state;
    tokenizer;
    inlineQueue;
    constructor(options2) {
      this.tokens = [];
      this.tokens.links = /* @__PURE__ */ Object.create(null);
      this.options = options2 || _defaults;
      this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
      this.tokenizer = this.options.tokenizer;
      this.tokenizer.options = this.options;
      this.tokenizer.lexer = this;
      this.inlineQueue = [];
      this.state = {
        inLink: false,
        inRawBlock: false,
        top: true
      };
      const rules = {
        block: block.normal,
        inline: inline.normal
      };
      if (this.options.pedantic) {
        rules.block = block.pedantic;
        rules.inline = inline.pedantic;
      } else if (this.options.gfm) {
        rules.block = block.gfm;
        if (this.options.breaks) {
          rules.inline = inline.breaks;
        } else {
          rules.inline = inline.gfm;
        }
      }
      this.tokenizer.rules = rules;
    }
    /**
     * Expose Rules
     */
    static get rules() {
      return {
        block,
        inline
      };
    }
    /**
     * Static Lex Method
     */
    static lex(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.lex(src);
    }
    /**
     * Static Lex Inline Method
     */
    static lexInline(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.inlineTokens(src);
    }
    /**
     * Preprocessing
     */
    lex(src) {
      src = src.replace(/\r\n|\r/g, "\n");
      this.blockTokens(src, this.tokens);
      for (let i = 0; i < this.inlineQueue.length; i++) {
        const next = this.inlineQueue[i];
        this.inlineTokens(next.src, next.tokens);
      }
      this.inlineQueue = [];
      return this.tokens;
    }
    blockTokens(src, tokens = [], lastParagraphClipped = false) {
      if (this.options.pedantic) {
        src = src.replace(/\t/g, "    ").replace(/^ +$/gm, "");
      }
      let token;
      let lastToken;
      let cutSrc;
      while (src) {
        if (this.options.extensions && this.options.extensions.block && this.options.extensions.block.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.space(src)) {
          src = src.substring(token.raw.length);
          if (token.raw.length === 1 && tokens.length > 0) {
            tokens[tokens.length - 1].raw += "\n";
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.code(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && (lastToken.type === "paragraph" || lastToken.type === "text")) {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.fences(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.heading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.hr(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.blockquote(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.list(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.html(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.def(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && (lastToken.type === "paragraph" || lastToken.type === "text")) {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.raw;
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title
            };
          }
          continue;
        }
        if (token = this.tokenizer.table(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.lheading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        cutSrc = src;
        if (this.options.extensions && this.options.extensions.startBlock) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startBlock.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
          lastToken = tokens[tokens.length - 1];
          if (lastParagraphClipped && lastToken?.type === "paragraph") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          lastParagraphClipped = cutSrc.length !== src.length;
          src = src.substring(token.raw.length);
          continue;
        }
        if (token = this.tokenizer.text(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && lastToken.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      this.state.top = true;
      return tokens;
    }
    inline(src, tokens = []) {
      this.inlineQueue.push({ src, tokens });
      return tokens;
    }
    /**
     * Lexing/Compiling
     */
    inlineTokens(src, tokens = []) {
      let token, lastToken, cutSrc;
      let maskedSrc = src;
      let match;
      let keepPrevChar, prevChar;
      if (this.tokens.links) {
        const links = Object.keys(this.tokens.links);
        if (links.length > 0) {
          while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
            if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
              maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
            }
          }
        }
      }
      while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
      }
      while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      }
      while (src) {
        if (!keepPrevChar) {
          prevChar = "";
        }
        keepPrevChar = false;
        if (this.options.extensions && this.options.extensions.inline && this.options.extensions.inline.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.escape(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.tag(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && token.type === "text" && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.link(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.reflink(src, this.tokens.links)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && token.type === "text" && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.codespan(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.del(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.autolink(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (!this.state.inLink && (token = this.tokenizer.url(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        cutSrc = src;
        if (this.options.extensions && this.options.extensions.startInline) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startInline.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (token = this.tokenizer.inlineText(cutSrc)) {
          src = src.substring(token.raw.length);
          if (token.raw.slice(-1) !== "_") {
            prevChar = token.raw.slice(-1);
          }
          keepPrevChar = true;
          lastToken = tokens[tokens.length - 1];
          if (lastToken && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      return tokens;
    }
  };
  var _Renderer = class {
    options;
    parser;
    // set by the parser
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(token) {
      return "";
    }
    code({ text: text2, lang, escaped }) {
      const langString = (lang || "").match(/^\S*/)?.[0];
      const code = text2.replace(/\n$/, "") + "\n";
      if (!langString) {
        return "<pre><code>" + (escaped ? code : escape$1(code, true)) + "</code></pre>\n";
      }
      return '<pre><code class="language-' + escape$1(langString) + '">' + (escaped ? code : escape$1(code, true)) + "</code></pre>\n";
    }
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      return `<blockquote>
${body}</blockquote>
`;
    }
    html({ text: text2 }) {
      return text2;
    }
    heading({ tokens, depth }) {
      return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
    }
    hr(token) {
      return "<hr>\n";
    }
    list(token) {
      const ordered = token.ordered;
      const start = token.start;
      let body = "";
      for (let j = 0; j < token.items.length; j++) {
        const item = token.items[j];
        body += this.listitem(item);
      }
      const type = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
      return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
    }
    listitem(item) {
      let itemBody = "";
      if (item.task) {
        const checkbox = this.checkbox({ checked: !!item.checked });
        if (item.loose) {
          if (item.tokens.length > 0 && item.tokens[0].type === "paragraph") {
            item.tokens[0].text = checkbox + " " + item.tokens[0].text;
            if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
              item.tokens[0].tokens[0].text = checkbox + " " + item.tokens[0].tokens[0].text;
            }
          } else {
            item.tokens.unshift({
              type: "text",
              raw: checkbox + " ",
              text: checkbox + " "
            });
          }
        } else {
          itemBody += checkbox + " ";
        }
      }
      itemBody += this.parser.parse(item.tokens, !!item.loose);
      return `<li>${itemBody}</li>
`;
    }
    checkbox({ checked }) {
      return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
    }
    paragraph({ tokens }) {
      return `<p>${this.parser.parseInline(tokens)}</p>
`;
    }
    table(token) {
      let header = "";
      let cell = "";
      for (let j = 0; j < token.header.length; j++) {
        cell += this.tablecell(token.header[j]);
      }
      header += this.tablerow({ text: cell });
      let body = "";
      for (let j = 0; j < token.rows.length; j++) {
        const row = token.rows[j];
        cell = "";
        for (let k = 0; k < row.length; k++) {
          cell += this.tablecell(row[k]);
        }
        body += this.tablerow({ text: cell });
      }
      if (body)
        body = `<tbody>${body}</tbody>`;
      return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
    }
    tablerow({ text: text2 }) {
      return `<tr>
${text2}</tr>
`;
    }
    tablecell(token) {
      const content = this.parser.parseInline(token.tokens);
      const type = token.header ? "th" : "td";
      const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
      return tag2 + content + `</${type}>
`;
    }
    /**
     * span level renderer
     */
    strong({ tokens }) {
      return `<strong>${this.parser.parseInline(tokens)}</strong>`;
    }
    em({ tokens }) {
      return `<em>${this.parser.parseInline(tokens)}</em>`;
    }
    codespan({ text: text2 }) {
      return `<code>${text2}</code>`;
    }
    br(token) {
      return "<br>";
    }
    del({ tokens }) {
      return `<del>${this.parser.parseInline(tokens)}</del>`;
    }
    link({ href, title, tokens }) {
      const text2 = this.parser.parseInline(tokens);
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text2;
      }
      href = cleanHref;
      let out = '<a href="' + href + '"';
      if (title) {
        out += ' title="' + title + '"';
      }
      out += ">" + text2 + "</a>";
      return out;
    }
    image({ href, title, text: text2 }) {
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text2;
      }
      href = cleanHref;
      let out = `<img src="${href}" alt="${text2}"`;
      if (title) {
        out += ` title="${title}"`;
      }
      out += ">";
      return out;
    }
    text(token) {
      return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : token.text;
    }
  };
  var _TextRenderer = class {
    // no need for block level renderers
    strong({ text: text2 }) {
      return text2;
    }
    em({ text: text2 }) {
      return text2;
    }
    codespan({ text: text2 }) {
      return text2;
    }
    del({ text: text2 }) {
      return text2;
    }
    html({ text: text2 }) {
      return text2;
    }
    text({ text: text2 }) {
      return text2;
    }
    link({ text: text2 }) {
      return "" + text2;
    }
    image({ text: text2 }) {
      return "" + text2;
    }
    br() {
      return "";
    }
  };
  var _Parser = class __Parser {
    options;
    renderer;
    textRenderer;
    constructor(options2) {
      this.options = options2 || _defaults;
      this.options.renderer = this.options.renderer || new _Renderer();
      this.renderer = this.options.renderer;
      this.renderer.options = this.options;
      this.renderer.parser = this;
      this.textRenderer = new _TextRenderer();
    }
    /**
     * Static Parse Method
     */
    static parse(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parse(tokens);
    }
    /**
     * Static Parse Inline Method
     */
    static parseInline(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parseInline(tokens);
    }
    /**
     * Parse Loop
     */
    parse(tokens, top = true) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[anyToken.type]) {
          const genericToken = anyToken;
          const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
          if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "space": {
            out += this.renderer.space(token);
            continue;
          }
          case "hr": {
            out += this.renderer.hr(token);
            continue;
          }
          case "heading": {
            out += this.renderer.heading(token);
            continue;
          }
          case "code": {
            out += this.renderer.code(token);
            continue;
          }
          case "table": {
            out += this.renderer.table(token);
            continue;
          }
          case "blockquote": {
            out += this.renderer.blockquote(token);
            continue;
          }
          case "list": {
            out += this.renderer.list(token);
            continue;
          }
          case "html": {
            out += this.renderer.html(token);
            continue;
          }
          case "paragraph": {
            out += this.renderer.paragraph(token);
            continue;
          }
          case "text": {
            let textToken = token;
            let body = this.renderer.text(textToken);
            while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
              textToken = tokens[++i];
              body += "\n" + this.renderer.text(textToken);
            }
            if (top) {
              out += this.renderer.paragraph({
                type: "paragraph",
                raw: body,
                text: body,
                tokens: [{ type: "text", raw: body, text: body }]
              });
            } else {
              out += body;
            }
            continue;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
    /**
     * Parse Inline Tokens
     */
    parseInline(tokens, renderer) {
      renderer = renderer || this.renderer;
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[anyToken.type]) {
          const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
          if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "escape": {
            out += renderer.text(token);
            break;
          }
          case "html": {
            out += renderer.html(token);
            break;
          }
          case "link": {
            out += renderer.link(token);
            break;
          }
          case "image": {
            out += renderer.image(token);
            break;
          }
          case "strong": {
            out += renderer.strong(token);
            break;
          }
          case "em": {
            out += renderer.em(token);
            break;
          }
          case "codespan": {
            out += renderer.codespan(token);
            break;
          }
          case "br": {
            out += renderer.br(token);
            break;
          }
          case "del": {
            out += renderer.del(token);
            break;
          }
          case "text": {
            out += renderer.text(token);
            break;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
  };
  var _Hooks = class {
    options;
    block;
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    static passThroughHooks = /* @__PURE__ */ new Set([
      "preprocess",
      "postprocess",
      "processAllTokens"
    ]);
    /**
     * Process markdown before marked
     */
    preprocess(markdown) {
      return markdown;
    }
    /**
     * Process HTML after marked is finished
     */
    postprocess(html3) {
      return html3;
    }
    /**
     * Process all tokens before walk tokens
     */
    processAllTokens(tokens) {
      return tokens;
    }
    /**
     * Provide function to tokenize markdown
     */
    provideLexer() {
      return this.block ? _Lexer.lex : _Lexer.lexInline;
    }
    /**
     * Provide function to parse tokens
     */
    provideParser() {
      return this.block ? _Parser.parse : _Parser.parseInline;
    }
  };
  var Marked = class {
    defaults = _getDefaults();
    options = this.setOptions;
    parse = this.parseMarkdown(true);
    parseInline = this.parseMarkdown(false);
    Parser = _Parser;
    Renderer = _Renderer;
    TextRenderer = _TextRenderer;
    Lexer = _Lexer;
    Tokenizer = _Tokenizer;
    Hooks = _Hooks;
    constructor(...args) {
      this.use(...args);
    }
    /**
     * Run callback for every token
     */
    walkTokens(tokens, callback) {
      let values = [];
      for (const token of tokens) {
        values = values.concat(callback.call(this, token));
        switch (token.type) {
          case "table": {
            const tableToken = token;
            for (const cell of tableToken.header) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
            for (const row of tableToken.rows) {
              for (const cell of row) {
                values = values.concat(this.walkTokens(cell.tokens, callback));
              }
            }
            break;
          }
          case "list": {
            const listToken = token;
            values = values.concat(this.walkTokens(listToken.items, callback));
            break;
          }
          default: {
            const genericToken = token;
            if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
              this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
                const tokens2 = genericToken[childTokens].flat(Infinity);
                values = values.concat(this.walkTokens(tokens2, callback));
              });
            } else if (genericToken.tokens) {
              values = values.concat(this.walkTokens(genericToken.tokens, callback));
            }
          }
        }
      }
      return values;
    }
    use(...args) {
      const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
      args.forEach((pack) => {
        const opts = { ...pack };
        opts.async = this.defaults.async || opts.async || false;
        if (pack.extensions) {
          pack.extensions.forEach((ext) => {
            if (!ext.name) {
              throw new Error("extension name required");
            }
            if ("renderer" in ext) {
              const prevRenderer = extensions.renderers[ext.name];
              if (prevRenderer) {
                extensions.renderers[ext.name] = function(...args2) {
                  let ret = ext.renderer.apply(this, args2);
                  if (ret === false) {
                    ret = prevRenderer.apply(this, args2);
                  }
                  return ret;
                };
              } else {
                extensions.renderers[ext.name] = ext.renderer;
              }
            }
            if ("tokenizer" in ext) {
              if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
                throw new Error("extension level must be 'block' or 'inline'");
              }
              const extLevel = extensions[ext.level];
              if (extLevel) {
                extLevel.unshift(ext.tokenizer);
              } else {
                extensions[ext.level] = [ext.tokenizer];
              }
              if (ext.start) {
                if (ext.level === "block") {
                  if (extensions.startBlock) {
                    extensions.startBlock.push(ext.start);
                  } else {
                    extensions.startBlock = [ext.start];
                  }
                } else if (ext.level === "inline") {
                  if (extensions.startInline) {
                    extensions.startInline.push(ext.start);
                  } else {
                    extensions.startInline = [ext.start];
                  }
                }
              }
            }
            if ("childTokens" in ext && ext.childTokens) {
              extensions.childTokens[ext.name] = ext.childTokens;
            }
          });
          opts.extensions = extensions;
        }
        if (pack.renderer) {
          const renderer = this.defaults.renderer || new _Renderer(this.defaults);
          for (const prop in pack.renderer) {
            if (!(prop in renderer)) {
              throw new Error(`renderer '${prop}' does not exist`);
            }
            if (["options", "parser"].includes(prop)) {
              continue;
            }
            const rendererProp = prop;
            const rendererFunc = pack.renderer[rendererProp];
            const prevRenderer = renderer[rendererProp];
            renderer[rendererProp] = (...args2) => {
              let ret = rendererFunc.apply(renderer, args2);
              if (ret === false) {
                ret = prevRenderer.apply(renderer, args2);
              }
              return ret || "";
            };
          }
          opts.renderer = renderer;
        }
        if (pack.tokenizer) {
          const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
          for (const prop in pack.tokenizer) {
            if (!(prop in tokenizer)) {
              throw new Error(`tokenizer '${prop}' does not exist`);
            }
            if (["options", "rules", "lexer"].includes(prop)) {
              continue;
            }
            const tokenizerProp = prop;
            const tokenizerFunc = pack.tokenizer[tokenizerProp];
            const prevTokenizer = tokenizer[tokenizerProp];
            tokenizer[tokenizerProp] = (...args2) => {
              let ret = tokenizerFunc.apply(tokenizer, args2);
              if (ret === false) {
                ret = prevTokenizer.apply(tokenizer, args2);
              }
              return ret;
            };
          }
          opts.tokenizer = tokenizer;
        }
        if (pack.hooks) {
          const hooks = this.defaults.hooks || new _Hooks();
          for (const prop in pack.hooks) {
            if (!(prop in hooks)) {
              throw new Error(`hook '${prop}' does not exist`);
            }
            if (["options", "block"].includes(prop)) {
              continue;
            }
            const hooksProp = prop;
            const hooksFunc = pack.hooks[hooksProp];
            const prevHook = hooks[hooksProp];
            if (_Hooks.passThroughHooks.has(prop)) {
              hooks[hooksProp] = (arg) => {
                if (this.defaults.async) {
                  return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                    return prevHook.call(hooks, ret2);
                  });
                }
                const ret = hooksFunc.call(hooks, arg);
                return prevHook.call(hooks, ret);
              };
            } else {
              hooks[hooksProp] = (...args2) => {
                let ret = hooksFunc.apply(hooks, args2);
                if (ret === false) {
                  ret = prevHook.apply(hooks, args2);
                }
                return ret;
              };
            }
          }
          opts.hooks = hooks;
        }
        if (pack.walkTokens) {
          const walkTokens2 = this.defaults.walkTokens;
          const packWalktokens = pack.walkTokens;
          opts.walkTokens = function(token) {
            let values = [];
            values.push(packWalktokens.call(this, token));
            if (walkTokens2) {
              values = values.concat(walkTokens2.call(this, token));
            }
            return values;
          };
        }
        this.defaults = { ...this.defaults, ...opts };
      });
      return this;
    }
    setOptions(opt) {
      this.defaults = { ...this.defaults, ...opt };
      return this;
    }
    lexer(src, options2) {
      return _Lexer.lex(src, options2 ?? this.defaults);
    }
    parser(tokens, options2) {
      return _Parser.parse(tokens, options2 ?? this.defaults);
    }
    parseMarkdown(blockType) {
      const parse = (src, options2) => {
        const origOpt = { ...options2 };
        const opt = { ...this.defaults, ...origOpt };
        const throwError = this.onError(!!opt.silent, !!opt.async);
        if (this.defaults.async === true && origOpt.async === false) {
          return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
        }
        if (typeof src === "undefined" || src === null) {
          return throwError(new Error("marked(): input parameter is undefined or null"));
        }
        if (typeof src !== "string") {
          return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
        }
        if (opt.hooks) {
          opt.hooks.options = opt;
          opt.hooks.block = blockType;
        }
        const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
        const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
        if (opt.async) {
          return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html3) => opt.hooks ? opt.hooks.postprocess(html3) : html3).catch(throwError);
        }
        try {
          if (opt.hooks) {
            src = opt.hooks.preprocess(src);
          }
          let tokens = lexer2(src, opt);
          if (opt.hooks) {
            tokens = opt.hooks.processAllTokens(tokens);
          }
          if (opt.walkTokens) {
            this.walkTokens(tokens, opt.walkTokens);
          }
          let html3 = parser2(tokens, opt);
          if (opt.hooks) {
            html3 = opt.hooks.postprocess(html3);
          }
          return html3;
        } catch (e) {
          return throwError(e);
        }
      };
      return parse;
    }
    onError(silent, async) {
      return (e) => {
        e.message += "\nPlease report this to https://github.com/markedjs/marked.";
        if (silent) {
          const msg = "<p>An error occurred:</p><pre>" + escape$1(e.message + "", true) + "</pre>";
          if (async) {
            return Promise.resolve(msg);
          }
          return msg;
        }
        if (async) {
          return Promise.reject(e);
        }
        throw e;
      };
    }
  };
  var markedInstance = new Marked();
  function marked(src, opt) {
    return markedInstance.parse(src, opt);
  }
  marked.options = marked.setOptions = function(options2) {
    markedInstance.setOptions(options2);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.getDefaults = _getDefaults;
  marked.defaults = _defaults;
  marked.use = function(...args) {
    markedInstance.use(...args);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.walkTokens = function(tokens, callback) {
    return markedInstance.walkTokens(tokens, callback);
  };
  marked.parseInline = markedInstance.parseInline;
  marked.Parser = _Parser;
  marked.parser = _Parser.parse;
  marked.Renderer = _Renderer;
  marked.TextRenderer = _TextRenderer;
  marked.Lexer = _Lexer;
  marked.lexer = _Lexer.lex;
  marked.Tokenizer = _Tokenizer;
  marked.Hooks = _Hooks;
  marked.parse = marked;
  var options = marked.options;
  var setOptions = marked.setOptions;
  var use = marked.use;
  var walkTokens = marked.walkTokens;
  var parseInline = marked.parseInline;
  var parser = _Parser.parse;
  var lexer = _Lexer.lex;

  // node_modules/dompurify/dist/purify.es.mjs
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ;
        else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }
  var entries = Object.entries;
  var setPrototypeOf = Object.setPrototypeOf;
  var isFrozen = Object.isFrozen;
  var getPrototypeOf = Object.getPrototypeOf;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var freeze = Object.freeze;
  var seal = Object.seal;
  var create = Object.create;
  var _ref = typeof Reflect !== "undefined" && Reflect;
  var apply = _ref.apply;
  var construct = _ref.construct;
  if (!freeze) {
    freeze = function freeze2(x) {
      return x;
    };
  }
  if (!seal) {
    seal = function seal2(x) {
      return x;
    };
  }
  if (!apply) {
    apply = function apply2(func, thisArg) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return func.apply(thisArg, args);
    };
  }
  if (!construct) {
    construct = function construct2(Func) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return new Func(...args);
    };
  }
  var arrayForEach = unapply(Array.prototype.forEach);
  var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  var arrayPop = unapply(Array.prototype.pop);
  var arrayPush = unapply(Array.prototype.push);
  var arraySplice = unapply(Array.prototype.splice);
  var arrayIsArray = Array.isArray;
  var stringToLowerCase = unapply(String.prototype.toLowerCase);
  var stringToString = unapply(String.prototype.toString);
  var stringMatch = unapply(String.prototype.match);
  var stringReplace = unapply(String.prototype.replace);
  var stringIndexOf = unapply(String.prototype.indexOf);
  var stringTrim = unapply(String.prototype.trim);
  var numberToString = unapply(Number.prototype.toString);
  var booleanToString = unapply(Boolean.prototype.toString);
  var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
  var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
  var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  var objectToString = unapply(Object.prototype.toString);
  var regExpTest = unapply(RegExp.prototype.test);
  var typeErrorCreate = unconstruct(TypeError);
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) {
        thisArg.lastIndex = 0;
      }
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) {
      setPrototypeOf(set, null);
    }
    if (!arrayIsArray(array)) {
      return set;
    }
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) {
            array[l] = lcElement;
          }
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) {
      const isPropertyExist = objectHasOwnProperty(array, index);
      if (!isPropertyExist) {
        array[index] = null;
      }
    }
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const _ref2 of entries(object)) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const property = _ref3[0];
      const value = _ref3[1];
      const isPropertyExist = objectHasOwnProperty(object, property);
      if (isPropertyExist) {
        if (arrayIsArray(value)) {
          newObject[property] = cleanArray(value);
        } else if (value && typeof value === "object" && value.constructor === Object) {
          newObject[property] = clone(value);
        } else {
          newObject[property] = value;
        }
      }
    }
    return newObject;
  }
  function stringifyValue(value) {
    switch (typeof value) {
      case "string": {
        return value;
      }
      case "number": {
        return numberToString(value);
      }
      case "boolean": {
        return booleanToString(value);
      }
      case "bigint": {
        return bigintToString ? bigintToString(value) : "0";
      }
      case "symbol": {
        return symbolToString ? symbolToString(value) : "Symbol()";
      }
      case "undefined": {
        return objectToString(value);
      }
      case "function":
      case "object": {
        if (value === null) {
          return objectToString(value);
        }
        const valueAsRecord = value;
        const valueToString = lookupGetter(valueAsRecord, "toString");
        if (typeof valueToString === "function") {
          const stringified = valueToString(valueAsRecord);
          return typeof stringified === "string" ? stringified : objectToString(stringified);
        }
        return objectToString(value);
      }
      default: {
        return objectToString(value);
      }
    }
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) {
          return unapply(desc.get);
        }
        if (typeof desc.value === "function") {
          return unapply(desc.value);
        }
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  function isRegex(value) {
    try {
      regExpTest(value, "");
      return true;
    } catch (_unused) {
      return false;
    }
  }
  var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
  var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
  var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
  var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
  var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
  var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
  var text = freeze(["#text"]);
  var html2 = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
  var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
  var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
  var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
  var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
  var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
  var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
  var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  var IS_ALLOWED_URI = seal(
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    // eslint-disable-line no-useless-escape
  );
  var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  var ATTR_WHITESPACE = seal(
    /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
    // eslint-disable-line no-control-regex
  );
  var DOCTYPE_NAME = seal(/^html$/i);
  var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  var NODE_TYPE = {
    element: 1,
    text: 3,
    // Deprecated
    progressingInstruction: 7,
    comment: 8,
    document: 9
  };
  var getGlobal = function getGlobal2() {
    return typeof window === "undefined" ? null : window;
  };
  var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
    if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
      return null;
    }
    let suffix = null;
    const ATTR_NAME = "data-tt-policy-suffix";
    if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
      suffix = purifyHostElement.getAttribute(ATTR_NAME);
    }
    const policyName = "dompurify" + (suffix ? "#" + suffix : "");
    try {
      return trustedTypes.createPolicy(policyName, {
        createHTML(html3) {
          return html3;
        },
        createScriptURL(scriptUrl) {
          return scriptUrl;
        }
      });
    } catch (_) {
      console.warn("TrustedTypes policy " + policyName + " could not be created.");
      return null;
    }
  };
  var _createHooksMap = function _createHooksMap2() {
    return {
      afterSanitizeAttributes: [],
      afterSanitizeElements: [],
      afterSanitizeShadowDOM: [],
      beforeSanitizeAttributes: [],
      beforeSanitizeElements: [],
      beforeSanitizeShadowDOM: [],
      uponSanitizeAttribute: [],
      uponSanitizeElement: [],
      uponSanitizeShadowNode: []
    };
  };
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.4.5";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let document2 = window2.document;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    const DocumentFragment = window2.DocumentFragment, HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap, NamedNodeMap = _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap, HTMLFormElement = window2.HTMLFormElement, DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
    const ElementPrototype = Element.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) {
        document2 = template.content.ownerDocument;
      }
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
    const importNode = originalDocument.importNode;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
    let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
    let ALLOWED_TAGS2 = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
    let ALLOWED_ATTR2 = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html2, ...svg, ...mathMl, ...xml]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG && CONFIG === cfg) {
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        cfg = {};
      }
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
      SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS2 = objectHasOwnProperty(cfg, "ALLOWED_TAGS") && arrayIsArray(cfg.ALLOWED_TAGS) ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
      ALLOWED_ATTR2 = objectHasOwnProperty(cfg, "ALLOWED_ATTR") && arrayIsArray(cfg.ALLOWED_ATTR) ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
      ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") && arrayIsArray(cfg.ALLOWED_NAMESPACES) ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
      URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR) ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR, transformCaseFunc) : DEFAULT_URI_SAFE_ATTRIBUTES;
      DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") && arrayIsArray(cfg.ADD_DATA_URI_TAGS) ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS, transformCaseFunc) : DEFAULT_DATA_URI_TAGS;
      FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS) ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
      FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") && arrayIsArray(cfg.FORBID_TAGS) ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : clone({});
      FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") && arrayIsArray(cfg.FORBID_ATTR) ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : clone({});
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
      NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
      HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, ["annotation-xml"]);
      const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
      CUSTOM_ELEMENT_HANDLING = create(null);
      if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
        CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
      }
      if (SAFE_FOR_TEMPLATES) {
        ALLOW_DATA_ATTR = false;
      }
      if (RETURN_DOM_FRAGMENT) {
        RETURN_DOM = true;
      }
      if (USE_PROFILES) {
        ALLOWED_TAGS2 = addToSet({}, text);
        ALLOWED_ATTR2 = create(null);
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS2, html$1);
          addToSet(ALLOWED_ATTR2, html2);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS2, svg$1);
          addToSet(ALLOWED_ATTR2, svg);
          addToSet(ALLOWED_ATTR2, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS2, svgFilters);
          addToSet(ALLOWED_ATTR2, svg);
          addToSet(ALLOWED_ATTR2, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS2, mathMl$1);
          addToSet(ALLOWED_ATTR2, mathMl);
          addToSet(ALLOWED_ATTR2, xml);
        }
      }
      EXTRA_ELEMENT_HANDLING.tagCheck = null;
      EXTRA_ELEMENT_HANDLING.attributeCheck = null;
      if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
        if (typeof cfg.ADD_TAGS === "function") {
          EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        } else if (arrayIsArray(cfg.ADD_TAGS)) {
          if (ALLOWED_TAGS2 === DEFAULT_ALLOWED_TAGS) {
            ALLOWED_TAGS2 = clone(ALLOWED_TAGS2);
          }
          addToSet(ALLOWED_TAGS2, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
        if (typeof cfg.ADD_ATTR === "function") {
          EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        } else if (arrayIsArray(cfg.ADD_ATTR)) {
          if (ALLOWED_ATTR2 === DEFAULT_ALLOWED_ATTR) {
            ALLOWED_ATTR2 = clone(ALLOWED_ATTR2);
          }
          addToSet(ALLOWED_ATTR2, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
        addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) {
        ALLOWED_TAGS2["#text"] = true;
      }
      if (WHOLE_DOCUMENT) {
        addToSet(ALLOWED_TAGS2, ["html", "head", "body"]);
      }
      if (ALLOWED_TAGS2.table) {
        addToSet(ALLOWED_TAGS2, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        }
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        }
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        emptyHTML = trustedTypesPolicy.createHTML("");
      } else {
        if (trustedTypesPolicy === void 0) {
          trustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        }
        if (trustedTypesPolicy !== null && typeof emptyHTML === "string") {
          emptyHTML = trustedTypesPolicy.createHTML("");
        }
      }
      if (freeze) {
        freeze(cfg);
      }
      CONFIG = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      let parent = getParentNode(element);
      if (!parent || !parent.tagName) {
        parent = {
          namespaceURI: NAMESPACE,
          tagName: "template"
        };
      }
      const tagName = stringToLowerCase(element.tagName);
      const parentTagName = stringToLowerCase(parent.tagName);
      if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
        return false;
      }
      if (element.namespaceURI === SVG_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "svg";
        }
        if (parent.namespaceURI === MATHML_NAMESPACE) {
          return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
        }
        return Boolean(ALL_SVG_TAGS[tagName]);
      }
      if (element.namespaceURI === MATHML_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "math";
        }
        if (parent.namespaceURI === SVG_NAMESPACE) {
          return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
        }
        return Boolean(ALL_MATHML_TAGS[tagName]);
      }
      if (element.namespaceURI === HTML_NAMESPACE) {
        if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
        return true;
      }
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, {
        element: node
      });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element) {
      try {
        arrayPush(DOMPurify.removed, {
          attribute: element.getAttributeNode(name),
          from: element
        });
      } catch (_) {
        arrayPush(DOMPurify.removed, {
          attribute: null,
          from: element
        });
      }
      element.removeAttribute(name);
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
          try {
            _forceRemove(element);
          } catch (_) {
          }
        } else {
          try {
            element.setAttribute(name, "");
          } catch (_) {
          }
        }
      }
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) {
        dirty = "<remove></remove>" + dirty;
      } else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
        dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      }
      const dirtyPayload = trustedTypesPolicy ? trustedTypesPolicy.createHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) {
        try {
          doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
        } catch (_) {
        }
      }
      if (!doc || !doc.documentElement) {
        doc = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc.body || doc.documentElement;
      if (dirty && leadingWhitespace) {
        body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      }
      if (NAMESPACE === HTML_NAMESPACE) {
        return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
      }
      return WHOLE_DOCUMENT ? doc.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      return createNodeIterator.call(
        root.ownerDocument || root,
        root,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
        null
      );
    };
    const _scrubTemplateExpressions = function _scrubTemplateExpressions2(node) {
      node.normalize();
      const walker = createNodeIterator.call(
        node.ownerDocument || node,
        node,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
        null
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        let data = currentNode.data;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          data = stringReplace(data, expr, " ");
        });
        currentNode.data = data;
        currentNode = walker.nextNode();
      }
    };
    const _isClobbered = function _isClobbered2(element) {
      return element instanceof HTMLFormElement && (typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || !(element.attributes instanceof NamedNodeMap) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function");
    };
    const _isNode = function _isNode2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return typeof getNodeType(value) === "number";
      } catch (_) {
        return false;
      }
    };
    function _executeHooks(hooks2, currentNode, data) {
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG);
      });
    }
    const _sanitizeElements = function _sanitizeElements2(currentNode) {
      let content = null;
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(currentNode.nodeName);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS2
      });
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w!]/g, currentNode.innerHTML) && regExpTest(/<[/\w!]/g, currentNode.textContent)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
        _forceRemove(currentNode);
        return true;
      }
      if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS2[tagName]) {
        if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
            return false;
          }
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
            return false;
          }
        }
        if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
          const parentNode = getParentNode(currentNode) || currentNode.parentNode;
          const childNodes = getChildNodes(currentNode) || currentNode.childNodes;
          if (childNodes && parentNode) {
            const childCount = childNodes.length;
            for (let i = childCount - 1; i >= 0; --i) {
              const childClone = cloneNode(childNodes[i], true);
              parentNode.insertBefore(childClone, getNextSibling(currentNode));
            }
          }
        }
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode instanceof Element && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        content = currentNode.textContent;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          content = stringReplace(content, expr, " ");
        });
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, {
            element: currentNode.cloneNode()
          });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return false;
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (FORBID_ATTR[lcName]) {
        return false;
      }
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
        return false;
      }
      const nameIsPermitted = ALLOWED_ATTR2[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
      if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR$1, lcName)) ;
      else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) ;
      else if (!nameIsPermitted || FORBID_ATTR[lcName]) {
        if (
          // First condition does a very basic check if a) it's basically a valid custom element tagname AND
          // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
          _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
          // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
        ) ;
        else {
          return false;
        }
      } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
      else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
      else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if (value) {
        return false;
      } else ;
      return true;
    };
    const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      const attributes = currentNode.attributes;
      if (!attributes || _isClobbered(currentNode)) {
        return;
      }
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR2,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      while (l--) {
        const attr = attributes[l];
        const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
          _removeAttribute(name, currentNode);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
        }
        if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (lcName === "attributename" && stringMatch(value, "href")) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (hookEvent.forceKeepAttr) {
          continue;
        }
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) {
          arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
            value = stringReplace(value, expr, " ");
          });
        }
        const lcTag = transformCaseFunc(currentNode.nodeName);
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
          if (namespaceURI) ;
          else {
            switch (trustedTypes.getAttributeType(lcTag, lcName)) {
              case "TrustedHTML": {
                value = trustedTypesPolicy.createHTML(value);
                break;
              }
              case "TrustedScriptURL": {
                value = trustedTypesPolicy.createScriptURL(value);
                break;
              }
            }
          }
        }
        if (value !== initValue) {
          try {
            if (namespaceURI) {
              currentNode.setAttributeNS(namespaceURI, name, value);
            } else {
              currentNode.setAttribute(name, value);
            }
            if (_isClobbered(currentNode)) {
              _forceRemove(currentNode);
            } else {
              arrayPop(DOMPurify.removed);
            }
          } catch (_) {
            _removeAttribute(name, currentNode);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    };
    const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode);
        _sanitizeAttributes(shadowNode);
        if (shadowNode.content instanceof DocumentFragment) {
          _sanitizeShadowDOM2(shadowNode.content);
        }
      }
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    const _sanitizeAttachedShadowRoots2 = function _sanitizeAttachedShadowRoots(root) {
      if (root.nodeType === NODE_TYPE.element && root.shadowRoot instanceof DocumentFragment) {
        const sr = root.shadowRoot;
        _sanitizeAttachedShadowRoots2(sr);
        _sanitizeShadowDOM2(sr);
      }
      const childNodes = root.childNodes;
      if (!childNodes) {
        return;
      }
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      for (const child of snapshot) {
        _sanitizeAttachedShadowRoots2(child);
      }
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) {
        dirty = "<!-->";
      }
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        dirty = stringifyValue(dirty);
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      }
      if (!DOMPurify.isSupported) {
        return dirty;
      }
      if (!SET_CONFIG) {
        _parseConfig(cfg);
      }
      DOMPurify.removed = [];
      if (typeof dirty === "string") {
        IN_PLACE = false;
      }
      if (IN_PLACE) {
        const nn = dirty.nodeName;
        if (typeof nn === "string") {
          const tagName = transformCaseFunc(nn);
          if (!ALLOWED_TAGS2[tagName] || FORBID_TAGS[tagName]) {
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
        _sanitizeAttachedShadowRoots2(dirty);
      } else if (_isNode(dirty)) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
          body = importedNode;
        } else if (importedNode.nodeName === "HTML") {
          body = importedNode;
        } else {
          body.appendChild(importedNode);
        }
        _sanitizeAttachedShadowRoots2(importedNode);
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
        dirty.indexOf("<") === -1) {
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(dirty) : dirty;
        }
        body = _initDocument(dirty);
        if (!body) {
          return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
        }
      }
      if (body && FORCE_BODY) {
        _forceRemove(body.firstChild);
      }
      const nodeIterator = _createNodeIterator(IN_PLACE ? dirty : body);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode);
        _sanitizeAttributes(currentNode);
        if (currentNode.content instanceof DocumentFragment) {
          _sanitizeShadowDOM2(currentNode.content);
        }
      }
      if (IN_PLACE) {
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions(dirty);
        }
        return dirty;
      }
      if (RETURN_DOM) {
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions(body);
        }
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) {
            returnNode.appendChild(body.firstChild);
          }
        } else {
          returnNode = body;
        }
        if (ALLOWED_ATTR2.shadowroot || ALLOWED_ATTR2.shadowrootmode) {
          returnNode = importNode.call(originalDocument, returnNode, true);
        }
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS2["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
        serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      }
      if (SAFE_FOR_TEMPLATES) {
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          serializedHTML = stringReplace(serializedHTML, expr, " ");
        });
      }
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
    };
    DOMPurify.clearConfig = function() {
      CONFIG = null;
      SET_CONFIG = false;
    };
    DOMPurify.isValidAttribute = function(tag2, attr, value) {
      if (!CONFIG) {
        _parseConfig({});
      }
      const lcTag = transformCaseFunc(tag2);
      const lcName = transformCaseFunc(attr);
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") {
        return;
      }
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var purify = createDOMPurify();

  // extensions/chat-bubble/assets/modules/markdown.js
  marked.setOptions({
    breaks: true,
    gfm: true
  });
  var ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a", "code", "pre", "blockquote"];
  var ALLOWED_ATTR = ["href", "target", "rel"];
  function renderMarkdown(src) {
    if (src == null) return "";
    const str = typeof src === "string" ? src : String(src);
    const noHeaders = str.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");
    const noImages = noHeaders.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    const rawHtml = marked.parse(noImages, { async: false });
    const safe = purify.sanitize(rawHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      FORBID_TAGS: ["style", "script", "iframe", "img", "h1", "h2", "h3", "h4", "h5", "h6"]
    });
    return safe.replace(/<a\b([^>]*)>/g, (m, attrs) => {
      const hasTarget = /target\s*=/.test(attrs);
      const hasRel = /rel\s*=/.test(attrs);
      const extra = (hasTarget ? "" : ' target="_blank"') + (hasRel ? "" : ' rel="noopener nofollow"');
      return `<a${attrs}${extra}>`;
    });
  }

  // extensions/chat-bubble/assets/modules/ui-turn.js
  function createTurnNode(turn, ctx = {}) {
    const blocksWrap = el("div", { class: "swa-turn-blocks" });
    const node = el("div", { class: `swa-turn swa-turn-${turn.role}` });
    if (turn.role === "assistant") {
      node.appendChild(el("div", { class: "swa-turn-avatar" }, createOrb({ size: 22 })));
    }
    node.appendChild(blocksWrap);
    function renderBlocks() {
      blocksWrap.innerHTML = "";
      if (turn.role === "assistant" && turn.blocks.length === 0) {
        blocksWrap.appendChild(
          el(
            "div",
            { class: "swa-bubble swa-bubble-assistant swa-typing-indicator" },
            el("span", { class: "swa-typing-dot" }),
            el("span", { class: "swa-typing-dot" }),
            el("span", { class: "swa-typing-dot" })
          )
        );
        return;
      }
      const lastTextIdx = turn.blocks.reduce((acc, b, i) => b.type === "text" ? i : acc, -1);
      for (let i = 0; i < turn.blocks.length; i++) {
        const block2 = turn.blocks[i];
        if (block2.type === "tool_use" && i < lastTextIdx) continue;
        blocksWrap.appendChild(renderBlock(block2, turn.role, ctx));
      }
    }
    renderBlocks();
    return { node, update: renderBlocks };
  }
  function renderBlock(block2, role, ctx) {
    if (block2.type === "text") {
      const bubble = el("div", { class: `swa-bubble swa-bubble-${role}` });
      if (role === "assistant") bubble.innerHTML = renderMarkdown(block2.content);
      else bubble.textContent = block2.content;
      return bubble;
    }
    if (block2.type === "tool_use") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_tool_use(), ui_tool_use_exports)).then(({ createToolUseNode: createToolUseNode2 }) => slot.replaceWith(createToolUseNode2(block2)));
      return slot;
    }
    if (block2.type === "product_card") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_product_card(), ui_product_card_exports)).then(({ createProductCard: createProductCard2 }) => slot.replaceWith(createProductCard2(block2, ctx)));
      return slot;
    }
    if (block2.type === "product_carousel") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_product_card(), ui_product_card_exports)).then(({ createProductCarousel: createProductCarousel2 }) => slot.replaceWith(createProductCarousel2(block2.items, ctx)));
      return slot;
    }
    if (block2.type === "cart_summary") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_cart_summary(), ui_cart_summary_exports)).then(({ createCartSummary: createCartSummary2 }) => {
        const ctl = createCartSummary2({ initialCart: block2.cart, onSaveForLater: ctx.onSaveForLater });
        slot.replaceWith(ctl.node);
      });
      return slot;
    }
    if (block2.type === "save_cart_card") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_save_cart(), ui_save_cart_exports)).then(
        ({ createSaveCartCard: createSaveCartCard2 }) => slot.replaceWith(createSaveCartCard2({ onSubmit: ctx.onSaveCartSubmit || (() => Promise.resolve()) }))
      );
      return slot;
    }
    if (block2.type === "order_status") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_order_status(), ui_order_status_exports)).then(
        ({ createOrderStatus: createOrderStatus2 }) => slot.replaceWith(createOrderStatus2(block2, { onReorder: ctx.onReorder }))
      );
      return slot;
    }
    if (block2.type === "auth_prompt") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_auth_prompt(), ui_auth_prompt_exports)).then(
        ({ createAuthPrompt: createAuthPrompt2 }) => slot.replaceWith(createAuthPrompt2(block2, { onSuccess: ctx.onAuthSuccess }))
      );
      return slot;
    }
    if (block2.type === "sizing_widget") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_sizing_widget(), ui_sizing_widget_exports)).then(
        ({ createSizingWidget: createSizingWidget2 }) => slot.replaceWith(createSizingWidget2(block2, { onComplete: ctx.onSizingComplete }).node)
      );
      return slot;
    }
    if (block2.type === "compare_link") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_compare_sheet(), ui_compare_sheet_exports)).then(
        ({ createCompareLink: createCompareLink2 }) => slot.replaceWith(createCompareLink2(block2, { onOpen: ctx.onCompareOpen }))
      );
      return slot;
    }
    if (block2.type === "image_preview") {
      const slot = el("div");
      Promise.resolve().then(() => (init_ui_image_preview(), ui_image_preview_exports)).then(
        ({ createImagePreview: createImagePreview2 }) => slot.replaceWith(createImagePreview2(block2))
      );
      return slot;
    }
    return el("div", { class: "swa-block-unknown", "data-type": block2.type });
  }

  // extensions/chat-bubble/assets/modules/auto-scroll.js
  var THRESHOLD = 100;
  function createAutoScroll(streamEl) {
    let userSuspended = false;
    const listeners = /* @__PURE__ */ new Set();
    function isNearBottom() {
      return streamEl.scrollHeight - (streamEl.scrollTop + streamEl.clientHeight) < THRESHOLD;
    }
    function onScroll() {
      if (isNearBottom()) {
        if (userSuspended) {
          userSuspended = false;
          listeners.forEach((fn) => fn(false));
        }
      } else if (!userSuspended) {
        userSuspended = true;
        listeners.forEach((fn) => fn(true));
      }
    }
    streamEl.addEventListener("scroll", onScroll, { passive: true });
    return {
      scrollToBottom() {
        if (userSuspended) return false;
        streamEl.scrollTop = streamEl.scrollHeight;
        return true;
      },
      forceScrollToBottom() {
        userSuspended = false;
        listeners.forEach((fn) => fn(false));
        streamEl.scrollTop = streamEl.scrollHeight;
      },
      isPaused() {
        return userSuspended;
      },
      onSuspended(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
    };
  }

  // extensions/chat-bubble/assets/modules/ui-stream.js
  function createStream({ turnCtx = {} } = {}) {
    const welcomeSlot = el("div", { class: "swa-stream-welcome-slot" });
    const turnsWrap = el("div", { class: "swa-stream-turns" });
    const newMsgPill = el("button", {
      class: "swa-new-messages-pill",
      type: "button",
      "aria-label": "Scroll to bottom",
      dataset: { visible: "false" }
    });
    newMsgPill.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 8,10 12,6"/></svg>';
    const node = el("div", {
      class: "swa-stream",
      role: "log",
      "aria-live": "polite",
      "aria-relevant": "additions text"
    }, welcomeSlot, turnsWrap);
    const auto = createAutoScroll(node);
    newMsgPill.addEventListener("click", () => {
      auto.forceScrollToBottom();
    });
    auto.onSuspended((paused) => {
      newMsgPill.dataset.visible = paused ? "true" : "false";
    });
    const turnNodes = /* @__PURE__ */ new Map();
    function setWelcome(panelNode) {
      welcomeSlot.innerHTML = "";
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
        auto.scrollToBottom();
      }
      conv.subscribe(render);
      render();
    }
    return { node, pillNode: newMsgPill, setWelcome, bindConversation };
  }

  // extensions/chat-bubble/assets/modules/ui-quick-replies.js
  init_dom();
  function createQuickReplies({ onSelect }) {
    const node = el("div", { class: "swa-quick-replies", role: "group", "aria-label": "Quick replies" });
    function setChips(chips = []) {
      node.innerHTML = "";
      for (const c of chips) {
        const cls = c.isPrimary ? "swa-chip swa-chip-primary" : "swa-chip";
        const btn = el("button", {
          class: cls,
          type: "button"
        }, c.label);
        btn.addEventListener("click", () => onSelect && onSelect(c));
        node.appendChild(btn);
      }
    }
    function clear() {
      node.innerHTML = "";
    }
    return { node, setChips, clear };
  }

  // extensions/chat-bubble/assets/modules/conversation.js
  function createConversation() {
    let turns = [];
    const subscribers = /* @__PURE__ */ new Set();
    let nextId = 0;
    function notify() {
      for (const fn of subscribers) fn(turns);
    }
    function id() {
      nextId += 1;
      return `t${nextId}`;
    }
    return {
      getTurns: () => turns,
      appendUserMessage(text2) {
        const turn = { id: id(), role: "user", blocks: [{ type: "text", content: text2 }] };
        turns.push(turn);
        notify();
        return turn;
      },
      appendAssistantTurn() {
        const turn = { id: id(), role: "assistant", blocks: [] };
        turns.push(turn);
        notify();
        return turn;
      },
      appendBlock(turnId, block2) {
        const turn = turns.find((t) => t.id === turnId);
        if (!turn) return;
        turn.blocks.push(block2);
        notify();
      },
      // Update existing block of matching type in the turn, or append if none exists
      upsertBlock(turnId, block2) {
        const turn = turns.find((t) => t.id === turnId);
        if (!turn) return;
        const idx = turn.blocks.findIndex((b) => b.type === block2.type);
        if (idx >= 0) {
          turn.blocks[idx] = block2;
        } else {
          turn.blocks.push(block2);
        }
        notify();
      },
      // Remove all blocks of a given type from every turn
      removeBlockType(type) {
        let changed = false;
        for (const turn of turns) {
          const before = turn.blocks.length;
          turn.blocks = turn.blocks.filter((b) => b.type !== type);
          if (turn.blocks.length !== before) changed = true;
        }
        if (changed) notify();
      },
      appendTextChunk(turnId, chunk) {
        const turn = turns.find((t) => t.id === turnId);
        if (!turn) return;
        const last = turn.blocks[turn.blocks.length - 1];
        if (last && last.type === "text") {
          last.content += chunk;
        } else {
          turn.blocks.push({ type: "text", content: chunk });
        }
        notify();
      },
      subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      reset() {
        turns = [];
        notify();
      }
    };
  }

  // extensions/chat-bubble/assets/modules/ui-welcome.js
  init_dom();
  function createWelcomePanel({ resolved, onPrimaryAction, onChip }) {
    const node = el("div", { class: "swa-welcome", role: "region", "aria-label": "Welcome" });
    node.appendChild(el("div", { class: "swa-welcome-orb" }, createOrb({ size: 52 })));
    node.appendChild(el("div", { class: "swa-welcome-greeting" }, resolved.greeting));
    if (resolved.context_line) {
      node.appendChild(el("div", { class: "swa-welcome-context" }, resolved.context_line));
    }
    if (resolved.primary_action) {
      const pa = resolved.primary_action;
      const btn = el("button", { class: "swa-welcome-hero-button", type: "button" }, pa.button_text);
      btn.addEventListener("click", () => onPrimaryAction && onPrimaryAction(pa.flow_id, pa.label));
      node.appendChild(
        el(
          "div",
          { class: "swa-welcome-hero" },
          el("div", { class: "swa-welcome-hero-title" }, pa.label),
          el("div", { class: "swa-welcome-hero-subtitle" }, pa.subtitle),
          btn
        )
      );
      node.appendChild(el("div", { class: "swa-welcome-or" }, "\u2014 or \u2014"));
    }
    if (resolved.chips && resolved.chips.length) {
      const chipsWrap = el("div", { class: "swa-welcome-chips" });
      for (const c of resolved.chips) {
        const cls = c.isPrimary ? "swa-chip swa-chip-primary" : "swa-chip";
        const chip = el("button", { class: cls, type: "button" }, c.label);
        chip.addEventListener("click", () => onChip && onChip(c.intent, c.label));
        chipsWrap.appendChild(chip);
      }
      node.appendChild(chipsWrap);
    }
    return node;
  }

  // extensions/chat-bubble/assets/modules/api.js
  var BASE = window.shopAIChatConfig && window.shopAIChatConfig.apiBase || "https://localhost:3458";
  var CHAT_URL = `${BASE}/chat`;
  var WELCOME_URL = `${BASE}/welcome`;
  function streamChat(payload, handlers) {
    const controller = new AbortController();
    const onEvent = handlers.onEvent || (() => {
    });
    const onError = handlers.onError || (() => {
    });
    const onClose = handlers.onClose || (() => {
    });
    (async () => {
      try {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!res.ok || !res.body) {
          onError(new Error(`Chat request failed: ${res.status}`));
          onClose();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;
        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) {
            streamDone = true;
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;
            try {
              onEvent(JSON.parse(json));
            } catch (e) {
              console.warn("[swa] malformed SSE chunk:", json);
            }
          }
        }
        onClose();
      } catch (err) {
        if (err.name !== "AbortError") onError(err);
        onClose();
      }
    })();
    return { cancel: () => controller.abort() };
  }
  function streamChatWithRetry(payload, handlers) {
    let retried = false;
    let activeCtl = null;
    const proxy = {
      onEvent: handlers.onEvent || (() => {
      }),
      onError: (err) => {
        if (!retried && isTransient(err)) {
          retried = true;
          activeCtl = streamChat(payload, proxy);
          return;
        }
        (handlers.onError || (() => {
        }))(err);
      },
      onClose: handlers.onClose || (() => {
      })
    };
    activeCtl = streamChat(payload, proxy);
    return { cancel: () => activeCtl && activeCtl.cancel() };
  }
  function isTransient(err) {
    if (!err) return false;
    if (err.name === "AbortError") return false;
    if (err.message && /failed: 5\d\d/.test(err.message)) return true;
    if (err.message && /failed to fetch|networkerror/i.test(err.message)) return true;
    return false;
  }
  async function fetchWelcome({ pageType, pageContext, hasPriorConvo } = {}) {
    const params = new URLSearchParams({
      page_type: pageType || "unknown",
      has_prior_convo: hasPriorConvo ? "1" : "0"
    });
    if (pageContext) params.set("page_context", JSON.stringify(pageContext));
    const res = await fetch(`${WELCOME_URL}?${params}`, {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`Welcome request failed: ${res.status}`);
    return res.json();
  }

  // extensions/chat-bubble/assets/modules/proactive.js
  var FREQ_KEY = "swa-proactive-history";
  var COOLDOWN_MS = 5 * 60 * 1e3;
  var SESSION_CAP = 2;
  var DISMISS_SUPPRESS_MS = 24 * 60 * 60 * 1e3;
  function history() {
    try {
      return JSON.parse(sessionStorage.getItem(FREQ_KEY) || '{"fires":[],"dismissed":{}}');
    } catch {
      return { fires: [], dismissed: {} };
    }
  }
  function saveHistory(h) {
    try {
      sessionStorage.setItem(FREQ_KEY, JSON.stringify(h));
    } catch {
    }
  }
  function isPdp() {
    return /^\/products\//.test(location.pathname);
  }
  function createProactive({ onTrigger, isOpen }) {
    function canFire(id) {
      if (isOpen()) return false;
      const h = history();
      const now = Date.now();
      if (id !== "exit_intent") {
        if (h.fires.length >= SESSION_CAP) return false;
        const last = h.fires[h.fires.length - 1] || 0;
        if (now - last < COOLDOWN_MS) return false;
      }
      const dismissedAt = h.dismissed[location.pathname];
      if (dismissedAt && now - dismissedAt < DISMISS_SUPPRESS_MS) return false;
      return true;
    }
    function fire(id, copy, opts = {}) {
      if (!canFire(id)) return;
      const h = history();
      h.fires.push(Date.now());
      saveHistory(h);
      onTrigger({ id, copy, urgent: opts.urgent || false });
    }
    function markDismissed() {
      const h = history();
      h.dismissed[location.pathname] = Date.now();
      saveHistory(h);
    }
    let pdpEnterTs = isPdp() ? Date.now() : null;
    const onScroll = () => {
      if (!isPdp()) return;
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct > 0.75) {
        fire("pdp_deep_scroll", "Want to compare this to similar options?");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const dwellTimer = setInterval(() => {
      if (!isPdp() || !pdpEnterTs) return;
      if (Date.now() - pdpEnterTs > 3e4) {
        const title = document.querySelector('h1.product__title, h1.product-title, h1[itemprop="name"]');
        const productName = title ? title.textContent.trim() : "this product";
        fire("pdp_dwell", `Looking at ${productName}? I can help with sizing or comparisons.`);
        pdpEnterTs = null;
      }
    }, 5e3);
    const visits = JSON.parse(sessionStorage.getItem("swa-pdp-visits") || "[]").filter((t) => Date.now() - t < 3 * 6e4);
    if (isPdp()) {
      visits.push(Date.now());
      sessionStorage.setItem("swa-pdp-visits", JSON.stringify(visits));
      if (visits.length >= 3) {
        setTimeout(() => fire("multi_pdp", "I see you're comparing \u2014 want me to lay out the differences?"), 1500);
      }
    }
    if (location.pathname.startsWith("/cart")) {
      const cartIdle = setTimeout(() => {
        fire("cart_hesitation", "Anything making you hesitate? Our return policy is flexible.");
      }, 2 * 6e4);
      window.addEventListener("beforeunload", () => clearTimeout(cartIdle));
    }
    let exitFired = false;
    document.addEventListener("mouseout", (e) => {
      if (exitFired) return;
      if (e.clientY < 5 && !e.relatedTarget) {
        exitFired = true;
        fire("exit_intent", "Before you go \u2014 save this for later or get a quick answer?", { urgent: true });
      }
    });
    if (isPdp()) {
      const obs = new MutationObserver(() => {
        const soldOut = document.querySelector('[data-variant-sold-out="true"], .product-form__submit[disabled]');
        if (soldOut) {
          fire("oos_variant", "That size is out \u2014 want me to notify you, or suggest similar?");
          obs.disconnect();
        }
      });
      obs.observe(document.body, { subtree: true, attributes: true });
    }
    return {
      markDismissed,
      cancel: () => {
        window.removeEventListener("scroll", onScroll);
        clearInterval(dwellTimer);
      }
    };
  }

  // extensions/chat-bubble/assets/modules/ui-error-banner.js
  init_dom();
  function createErrorBanner({ message, retryLabel = "Retry", onRetry }) {
    const node = el(
      "div",
      { class: "swa-error-banner", role: "status" },
      el("span", { "aria-hidden": "true" }, "\u26A0"),
      el("span", null, message)
    );
    if (onRetry) {
      const btn = el("button", { type: "button" }, retryLabel);
      btn.addEventListener("click", () => onRetry());
      node.appendChild(btn);
    }
    return node;
  }
  function createOfflineBar() {
    const node = el(
      "div",
      { class: "swa-offline-bar" },
      el("span", { class: "dot" }),
      "You're offline \u2014 read-only mode"
    );
    return node;
  }
  function createRateLimitPill(secondsRemaining, onTick) {
    const node = el(
      "div",
      { class: "swa-ratelimit-pill", role: "status" },
      `Catching my breath, try again in ${secondsRemaining}s\u2026`
    );
    let remaining = secondsRemaining;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        node.remove();
        onTick && onTick(0);
        return;
      }
      node.textContent = `Catching my breath, try again in ${remaining}s\u2026`;
      onTick && onTick(remaining);
    }, 1e3);
    return { node, cancel: () => clearInterval(interval) };
  }

  // extensions/chat-bubble/assets/chat.src.js
  init_ui_compare_sheet();
  function buildFooter(shopName) {
    return el(
      "div",
      { class: "swa-footer" },
      `Powered by ${shopName || "Shop"} AI \xB7 `,
      el("a", { href: "#", target: "_blank", rel: "noopener" }, "Privacy")
    );
  }
  function detectPageType() {
    const path = window.location.pathname;
    if (/^\/products\//.test(path)) return "pdp";
    if (/^\/collections\//.test(path)) return "collection";
    if (/^\/cart/.test(path)) return "cart";
    if (/^\/search/.test(path)) return "search";
    if (path === "/" || path === "") return "home";
    if (/^\/blogs\//.test(path)) return "blog";
    return "unknown";
  }
  function detectPageContext() {
    const ctx = {};
    const titleEl = document.querySelector('h1.product__title, h1[itemprop="name"], .product-single__title, h1.product-title');
    if (titleEl) ctx.productTitle = titleEl.textContent.trim();
    return ctx;
  }
  function init() {
    const root = qs("#shop-ai-chat-root");
    if (!root) return;
    const config = window.shopAIChatConfig || {};
    const state = createState({
      ...INITIAL_STATE,
      shopName: config.shopName || "",
      brandColor: config.brandColor || INITIAL_STATE.brandColor,
      isOnline: navigator.onLine
    });
    if (config.brandColor) {
      root.style.setProperty("--swa-color-brand", config.brandColor);
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
          conversation.removeBlockType("cart_summary");
          if (currentAssistantTurnId) {
            conversation.appendBlock(currentAssistantTurnId, { type: "cart_summary", cart });
          }
        },
        onSaveCartSubmit: ({ email, sms }) => {
          console.log("[swa] save cart", email, sms);
          return Promise.resolve();
        },
        onReorder: (orderBlock) => {
          sendMessage({ text: `Reorder #${orderBlock.orderNumber}` });
        },
        onSaveForLater: () => {
          if (currentAssistantTurnId) {
            conversation.appendBlock(currentAssistantTurnId, { type: "save_cart_card" });
          }
        },
        onAuthSuccess: () => {
          if (lastSendPayload) sendMessage(lastSendPayload);
        },
        onSizingComplete: (answers) => {
          sendMessage({ text: "My sizing: " + Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(", ") });
        },
        onCompareOpen: (block2) => {
          openCompareSheet(block2, { container: window_.node });
        }
      }
    });
    const quickReplies = createQuickReplies({
      onSelect: (chip) => {
        sendMessage({ text: chip.label, intent: chip.intent });
        quickReplies.clear();
      }
    });
    const composer = createComposer({
      onSubmit: (payload) => sendMessage(payload),
      onAttachImage: () => {
      }
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
    offlineBar.style.display = "none";
    window_.node.insertBefore(offlineBar, window_.node.firstChild);
    root.appendChild(launcherCtl.node);
    root.appendChild(launcherCtl.previewBubble);
    root.appendChild(window_.node);
    stream.bindConversation(conversation);
    function syncOnline(online) {
      state.set("isOnline", online);
      offlineBar.style.display = online ? "none" : "block";
    }
    window.addEventListener("online", () => syncOnline(true));
    window.addEventListener("offline", () => syncOnline(false));
    syncOnline(navigator.onLine);
    let welcomeShown = false;
    state.subscribe("isOpen", (isOpen) => {
      root.dataset.state = isOpen ? "open" : "closed";
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
        resolved = { greeting: "Hi \u2014 what brings you in?", context_line: null, primary_action: null, chips: [] };
      }
      const panel = createWelcomePanel({
        resolved,
        onPrimaryAction: (flowId, label) => {
          sendMessage({ text: label, flow: flowId });
          stream.setWelcome(null);
        },
        onChip: (intent, label) => {
          sendMessage({ text: label, intent });
          stream.setWelcome(null);
        }
      });
      stream.setWelcome(panel);
    }
    function sendMessage(payload) {
      if (state.get("rateLimitedUntil") > Date.now()) return;
      lastSendPayload = payload;
      stream.setWelcome(null);
      if (payload.image) {
        conversation.appendUserMessage(payload.text || "(image)");
        const turns = conversation.getTurns();
        const userTurn = turns[turns.length - 1];
        conversation.appendBlock(userTurn.id, { type: "image_preview", dataUrl: payload.image.dataUrl, alt: payload.image.name });
      } else {
        conversation.appendUserMessage(payload.text || "");
      }
      const assistantTurn = conversation.appendAssistantTurn();
      currentAssistantTurnId = assistantTurn.id;
      if (activeStream) activeStream.cancel();
      activeStream = streamChatWithRetry(
        {
          message: payload.text || "",
          conversation_id: conversationId,
          prompt_type: config.promptType,
          page_context: { page_type: detectPageType(), ...detectPageContext(), ...payload.intent && { intent: payload.intent }, ...payload.flow && { flow: payload.flow } },
          ...payload.image && { image: payload.image.dataUrl }
        },
        {
          onEvent: handleEvent,
          onError: (err) => {
            if (err && err.status === 429) {
              handleRateLimit();
              return;
            }
            const banner = createErrorBanner({
              message: "Connection dropped. Response incomplete.",
              onRetry: () => {
                banner.remove();
                sendMessage(payload);
              }
            });
            const turnEl = stream.node.querySelector(".swa-turn:last-of-type .swa-turn-blocks");
            if (turnEl) turnEl.appendChild(banner);
          },
          onClose: () => {
            activeStream = null;
          }
        }
      );
    }
    function handleRateLimit() {
      state.set("rateLimitedUntil", Date.now() + 5e3);
      const dock = window_.dockSlot;
      const { node: pillNode } = createRateLimitPill(5, (remaining) => {
        if (remaining === 0) state.set("rateLimitedUntil", 0);
      });
      dock.appendChild(pillNode);
    }
    function handleEvent(ev) {
      if (!currentAssistantTurnId) return;
      if (ev.type === "id") {
        conversationId = ev.conversation_id;
        return;
      }
      if (ev.type === "chunk" && typeof ev.chunk === "string") {
        conversation.appendTextChunk(currentAssistantTurnId, ev.chunk);
        return;
      }
      if (ev.type === "tool_use") {
        conversation.appendBlock(currentAssistantTurnId, { type: "tool_use", label: "Searching\u2026" });
        return;
      }
      if (ev.type === "product_results" && Array.isArray(ev.products) && ev.products.length > 0) {
        if (ev.products.length === 1) {
          conversation.appendBlock(currentAssistantTurnId, { type: "product_card", ...ev.products[0] });
        } else {
          conversation.appendBlock(currentAssistantTurnId, { type: "product_carousel", items: ev.products });
        }
        return;
      }
      if (ev.type === "message_complete") return;
      if (ev.type === "error" && ev.error) {
        conversation.appendBlock(currentAssistantTurnId, { type: "text", content: `_Error: ${ev.error}_` });
      }
    }
    const proactive = createProactive({
      isOpen: () => state.get("isOpen"),
      onTrigger: ({ copy }) => {
        state.set("pendingMessagePreview", copy);
        state.set("hasUnread", true);
      }
    });
    launcherCtl.previewBubble.addEventListener("click", (e) => {
      if (e.target.matches("[data-dismiss]")) {
        proactive.markDismissed();
        state.set("pendingMessagePreview", null);
        state.set("hasUnread", false);
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.5 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.5/LICENSE *)
*/
