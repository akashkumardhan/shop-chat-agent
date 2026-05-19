const FREQ_KEY = 'swa-proactive-history';
const COOLDOWN_MS = 5 * 60 * 1000;
const SESSION_CAP = 2;
const DISMISS_SUPPRESS_MS = 24 * 60 * 60 * 1000;

function history() {
  try {
    return JSON.parse(sessionStorage.getItem(FREQ_KEY) || '{"fires":[],"dismissed":{}}');
  } catch {
    return { fires: [], dismissed: {} };
  }
}
function saveHistory(h) {
  try { sessionStorage.setItem(FREQ_KEY, JSON.stringify(h)); } catch {
    // ignore: sessionStorage may be unavailable in private mode
  }
}

function isPdp() { return /^\/products\//.test(location.pathname); }

export function createProactive({ onTrigger, isOpen }) {
  function canFire(id) {
    if (isOpen()) return false;
    const h = history();
    const now = Date.now();

    if (id !== 'exit_intent') {
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
      fire('pdp_deep_scroll', 'Want to compare this to similar options?');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const dwellTimer = setInterval(() => {
    if (!isPdp() || !pdpEnterTs) return;
    if (Date.now() - pdpEnterTs > 30_000) {
      const title = document.querySelector('h1.product__title, h1.product-title, h1[itemprop="name"]');
      const productName = title ? title.textContent.trim() : 'this product';
      fire('pdp_dwell', `Looking at ${productName}? I can help with sizing or comparisons.`);
      pdpEnterTs = null;
    }
  }, 5000);

  const visits = JSON.parse(sessionStorage.getItem('swa-pdp-visits') || '[]')
    .filter(t => Date.now() - t < 3 * 60_000);
  if (isPdp()) {
    visits.push(Date.now());
    sessionStorage.setItem('swa-pdp-visits', JSON.stringify(visits));
    if (visits.length >= 3) {
      setTimeout(() => fire('multi_pdp', "I see you're comparing — want me to lay out the differences?"), 1500);
    }
  }

  if (location.pathname.startsWith('/cart')) {
    const cartIdle = setTimeout(() => {
      fire('cart_hesitation', 'Anything making you hesitate? Our return policy is flexible.');
    }, 2 * 60_000);
    window.addEventListener('beforeunload', () => clearTimeout(cartIdle));
  }

  let exitFired = false;
  document.addEventListener('mouseout', (e) => {
    if (exitFired) return;
    if (e.clientY < 5 && !e.relatedTarget) {
      exitFired = true;
      fire('exit_intent', 'Before you go — save this for later or get a quick answer?', { urgent: true });
    }
  });

  if (isPdp()) {
    const obs = new MutationObserver(() => {
      const soldOut = document.querySelector('[data-variant-sold-out="true"], .product-form__submit[disabled]');
      if (soldOut) {
        fire('oos_variant', 'That size is out — want me to notify you, or suggest similar?');
        obs.disconnect();
      }
    });
    obs.observe(document.body, { subtree: true, attributes: true });
  }

  return {
    markDismissed,
    cancel: () => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(dwellTimer);
    },
  };
}
