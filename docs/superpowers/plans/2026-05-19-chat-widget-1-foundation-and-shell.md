# Chat Widget UI — Plan 1: Foundation & Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current chat widget's visual foundation with the new design system — design tokens, animated gradient orb, modular JS structure, redesigned launcher, header, composer, and empty chat shell. After this plan ships, the widget opens with the new visual identity but chat content rendering is unchanged.

**Architecture:** Full rewrite of the theme extension. The current single-file `chat.js` (956 lines) is replaced by a modular structure (`chat.js` root + `modules/*.js`). A new CSS file built around `--swa-*` design tokens replaces the current `chat.css`. The Liquid template is replaced with new DOM that the new modules expect. A single `Orb` component renders at four sizes (60px launcher / 32px header / 22px turn / 16px favicon). Vitest is added to the repo for testing logic-heavy modules; visual surfaces are verified via a `test-surfaces.html` dev page.

**Tech Stack:** Shopify theme extension (Liquid + vanilla ES6 modules + plain CSS with custom properties), React Router 7 backend (existing), Prisma (existing), Vitest (new — for unit tests on logic modules).

**Spec reference:** [docs/superpowers/specs/2026-05-19-chat-widget-ui-design.md](../specs/2026-05-19-chat-widget-ui-design.md) — sections §1–§7.

---

## File Structure

**New files (extension):**

```
extensions/chat-bubble/
  assets/
    chat.css                    # full rewrite — token-based
    chat.js                     # entry: imports modules, calls init
    modules/
      orb.js                    # Orb factory — renders at any size
      state.js                  # Single mutable widget state object + subscribers
      api.js                    # Backend communication (chat + welcome endpoints)
      dom.js                    # DOM-utility helpers (createEl, qs, on, etc.)
      ui-launcher.js            # Launcher resting + pending-pill + open/close
      ui-header.js              # Header avatar + title + status + buttons
      ui-window.js              # Window open/close, focus management, viewport handling
      ui-composer.js            # Input area: auto-expand, keyboard, attach, send button
      ui-stream.js              # Message stream container (stub in this plan)
    test-surfaces.html          # Dev preview page rendering all surfaces in isolation
  blocks/
    chat-interface.liquid       # new DOM structure
```

**New files (repo root):**

```
vitest.config.js                # Vitest configuration
tests/extension/                # Unit tests for extension modules
  orb.test.js
  state.test.js
  ui-composer.test.js
```

**Modified files:**

```
package.json                    # add vitest dev dependency + "test" script
```

**Removed files:**

After this plan completes, the old `chat.css` and `chat.js` are fully replaced. The old `extensions/chat-bubble/assets/chat.js` is overwritten in Task 5.

---

## Module responsibilities

| Module | Responsibility |
|---|---|
| `orb.js` | Pure factory: `createOrb({size, paused})` returns a DOM element. No state. |
| `state.js` | `WidgetState` object with subscribable fields: `isOpen`, `hasUnread`, `pendingMessage`, etc. Single source of truth. |
| `api.js` | `fetchChat(payload)`, `fetchWelcome(payload)`. No DOM. Returns Promises. |
| `dom.js` | `el(tag, attrs, ...children)`, `qs(sel, root)`, `on(node, event, fn)`, `text(node, str)`. No business logic. |
| `ui-launcher.js` | Renders the launcher DOM, handles resting micro-motion, click → open, manages pending-pill expansion. Subscribes to `WidgetState`. |
| `ui-header.js` | Renders header DOM with orb + title + status + minimize/close. |
| `ui-window.js` | Manages widget window open/close, viewport detection, mobile slide-up, focus restoration on close. |
| `ui-composer.js` | Renders composer, handles input auto-expand, keyboard (Enter/Shift+Enter/Esc), attach button, send button enable/disable. |
| `ui-stream.js` | Stub in this plan — renders an empty stream container; the welcome panel + message rendering land in Plan 2. |
| `chat.js` | Root entry: imports modules, wires them up, calls init(container). |

This split lets you reason about one surface at a time. Each module is <200 LOC when complete.

---

## Tasks

### Task 1: Add Vitest test infrastructure

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json` (add devDep + script)
- Create: `tests/extension/.gitkeep`

- [ ] **Step 1: Add vitest to devDependencies**

Run from repo root:
```bash
cd /Applications/pe/shop-chat-agent && npm install --save-dev vitest@^2 happy-dom@^15
```

Expected: `package.json` gains entries; lockfile updates.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to the `scripts` block in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a placeholder test**

Create `tests/extension/.gitkeep` (empty file — ensures dir is tracked even without test files yet).

Create `tests/extension/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests to verify Vitest works**

```bash
cd /Applications/pe/shop-chat-agent && npm test
```

Expected:
```
✓ tests/extension/smoke.test.js (1)
  ✓ smoke
    ✓ vitest is wired up
```

If it fails with module errors, ensure `package.json` has `"type": "module"` (it does — verified).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js tests/extension/
git commit -m "build: add vitest for extension module tests"
```

---

### Task 2: Build the Orb component

**Files:**
- Create: `extensions/chat-bubble/assets/modules/orb.js`
- Create: `tests/extension/orb.test.js`

The Orb is the product's single visual signature, rendered at four sizes. This is a pure factory — no state, no event handling.

- [ ] **Step 1: Write the failing test**

Create `tests/extension/orb.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createOrb } from '../../extensions/chat-bubble/assets/modules/orb.js';

describe('createOrb', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a div with the swa-orb class', () => {
    const orb = createOrb({ size: 32 });
    expect(orb.tagName).toBe('DIV');
    expect(orb.classList.contains('swa-orb')).toBe(true);
  });

  it('applies the size as width and height inline style', () => {
    const orb = createOrb({ size: 60 });
    expect(orb.style.width).toBe('60px');
    expect(orb.style.height).toBe('60px');
  });

  it('renders a sparkle for sizes >= 22px', () => {
    const orb22 = createOrb({ size: 22 });
    const orb16 = createOrb({ size: 16 });
    expect(orb22.querySelector('.swa-orb-sparkle')).not.toBeNull();
    expect(orb16.querySelector('.swa-orb-sparkle')).toBeNull();
  });

  it('pauses animation when paused: true', () => {
    const orb = createOrb({ size: 60, paused: true });
    expect(orb.classList.contains('swa-orb-paused')).toBe(true);
  });

  it('throws for non-positive size', () => {
    expect(() => createOrb({ size: 0 })).toThrow();
    expect(() => createOrb({ size: -1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- orb
```

Expected: 5 tests FAIL with `Cannot find module ... orb.js`.

- [ ] **Step 3: Implement the Orb factory**

Create `extensions/chat-bubble/assets/modules/orb.js`:

```js
/**
 * Orb — animated gradient nebula component.
 * Renders at 16 / 22 / 32 / 60+ px. Sparkle omitted at 16px (favicon size).
 */
export function createOrb({ size, paused = false } = {}) {
  if (typeof size !== 'number' || size <= 0) {
    throw new Error(`createOrb: size must be a positive number, got ${size}`);
  }

  const el = document.createElement('div');
  el.className = 'swa-orb';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  if (paused) el.classList.add('swa-orb-paused');

  if (size >= 22) {
    const sparkle = document.createElement('span');
    sparkle.className = 'swa-orb-sparkle';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.textContent = '✦';
    el.appendChild(sparkle);
  }

  return el;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- orb
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/modules/orb.js tests/extension/orb.test.js
git commit -m "feat(widget): add Orb component factory"
```

---

### Task 3: Build the design-token CSS foundation

**Files:**
- Create: `extensions/chat-bubble/assets/chat.css` (new file — will replace existing)

This is the full token system from spec §4 plus the orb CSS. No tests — visual verification later.

- [ ] **Step 1: Backup the existing chat.css**

```bash
cd /Applications/pe/shop-chat-agent && cp extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.css.legacy
```

This preserves the old CSS for reference during the rewrite. We delete `.legacy` at the end of Plan 1.

- [ ] **Step 2: Rewrite chat.css with design tokens**

Overwrite `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Shop AI Chat Widget — design tokens & base styles
 * Token namespace: --swa-* (shop-widget-assistant)
 * ============================================================ */

.shop-ai-chat-container {
  /* ---------- Brand (merchant-overridable) ---------- */
  --swa-color-brand: #5046E4;
  --swa-color-brand-hover: #4239C7;
  --swa-color-brand-soft: #EEEDFC;
  --swa-color-brand-foreground: #FFFFFF;

  /* ---------- Neutral palette (light) ---------- */
  --swa-color-bg: #FFFFFF;
  --swa-color-bg-subtle: #F4F4F5;
  --swa-color-bg-elevated: #FAFAFA;
  --swa-color-text-primary: #18181B;
  --swa-color-text-secondary: #555555;
  --swa-color-text-tertiary: #888888;
  --swa-color-border: #E5E5E8;
  --swa-color-border-strong: #D4D4D8;
  --swa-color-focus-ring: rgba(80, 70, 228, 0.45);

  /* ---------- Semantic ---------- */
  --swa-color-success-bg: #F0FDF4;
  --swa-color-success-fg: #14532D;
  --swa-color-warning-bg: #FFF7ED;
  --swa-color-warning-fg: #9A3412;
  --swa-color-danger-bg: #FEF2F2;
  --swa-color-danger-fg: #B91C1C;
  --swa-color-info-bg: #EEEDFC;
  --swa-color-info-fg: #4239C7;

  /* ---------- Bubbles ---------- */
  --swa-color-bubble-user-bg: var(--swa-color-brand-soft);
  --swa-color-bubble-user-text: var(--swa-color-text-primary);
  --swa-color-bubble-assistant-bg: var(--swa-color-bg-subtle);
  --swa-color-bubble-assistant-text: var(--swa-color-text-primary);

  /* ---------- Orb palette ---------- */
  --swa-orb-color-1: #6366F1;
  --swa-orb-color-2: #8B5CF6;
  --swa-orb-color-3: #EC4899;
  --swa-orb-color-4: #3B82F6;

  /* ---------- Typography ---------- */
  --swa-font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --swa-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --swa-font-display: var(--swa-font-sans);

  --swa-text-xs: 11px;
  --swa-text-sm: 12px;
  --swa-text-base: 14px;
  --swa-text-md: 15px;
  --swa-text-lg: 17px;

  --swa-weight-regular: 400;
  --swa-weight-medium: 500;
  --swa-weight-semibold: 600;

  /* ---------- Spacing ---------- */
  --swa-space-1: 4px;
  --swa-space-2: 8px;
  --swa-space-3: 12px;
  --swa-space-4: 16px;
  --swa-space-5: 20px;
  --swa-space-6: 24px;
  --swa-space-8: 32px;
  --swa-space-10: 40px;

  /* ---------- Radius ---------- */
  --swa-radius-sm: 6px;
  --swa-radius-md: 10px;
  --swa-radius-lg: 14px;
  --swa-radius-xl: 20px;
  --swa-radius-full: 9999px;

  /* ---------- Shadow ---------- */
  --swa-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --swa-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --swa-shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.12);
  --swa-shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.18);

  /* ---------- Motion ---------- */
  --swa-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --swa-ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
  --swa-duration-fast: 120ms;
  --swa-duration-base: 200ms;
  --swa-duration-slow: 320ms;

  /* ---------- Z-index ---------- */
  --swa-z-launcher: 2147483000;
  --swa-z-window: 2147483001;
  --swa-z-modal: 2147483010;

  /* ---------- Viewport helper (set by JS for mobile) ---------- */
  --swa-viewport-height: 100vh;

  /* ---------- Base ---------- */
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: var(--swa-z-launcher);
  font-family: var(--swa-font-sans);
  font-size: var(--swa-text-base);
  color: var(--swa-color-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* ============================================================
 * Dark mode (auto — honors prefers-color-scheme)
 * ============================================================ */
@media (prefers-color-scheme: dark) {
  .shop-ai-chat-container {
    --swa-color-bg: #0F0F11;
    --swa-color-bg-subtle: #1B1B1E;
    --swa-color-bg-elevated: #17171A;
    --swa-color-text-primary: #F2F2F4;
    --swa-color-text-secondary: #B5B5BB;
    --swa-color-text-tertiary: #7F7F87;
    --swa-color-border: #2A2A2E;
    --swa-color-border-strong: #3F3F46;
  }
}

/* ============================================================
 * Reduced motion
 * ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .shop-ai-chat-container *,
  .shop-ai-chat-container *::before,
  .shop-ai-chat-container *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ============================================================
 * Orb — animated nebula
 * ============================================================ */
.swa-orb {
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #FFFFFF 0%, transparent 40%),
    radial-gradient(circle at 70% 70%, var(--swa-orb-color-3) 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, var(--swa-orb-color-4) 0%, transparent 50%),
    linear-gradient(135deg, var(--swa-orb-color-1), var(--swa-orb-color-2));
  background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
  animation: swa-orb-shift 8s ease infinite;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.swa-orb-paused {
  animation-play-state: paused;
}

.swa-orb-sparkle {
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  font-size: 0.55em;
  pointer-events: none;
  user-select: none;
}

@keyframes swa-orb-shift {
  0%, 100% { background-position: 0% 0%, 100% 100%, 0% 100%, 0% 0%; }
  50%      { background-position: 100% 100%, 0% 0%, 100% 0%, 0% 0%; }
}

/* Subsequent component styles are added in their respective tasks. */
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.css.legacy
git commit -m "feat(widget): replace chat.css with token-based foundation + orb styles"
```

---

### Task 4: Rewrite the Liquid template with new DOM

**Files:**
- Modify: `extensions/chat-bubble/blocks/chat-interface.liquid`

The new DOM is intentionally empty — JS modules build their own DOM into the root container. The Liquid template provides the root + the script tag + the merchant config bridge.

- [ ] **Step 1: Backup and rewrite the Liquid template**

```bash
cd /Applications/pe/shop-chat-agent && cp extensions/chat-bubble/blocks/chat-interface.liquid extensions/chat-bubble/blocks/chat-interface.liquid.legacy
```

- [ ] **Step 2: Overwrite the Liquid template**

Replace `extensions/chat-bubble/blocks/chat-interface.liquid` with:

```liquid
{{ 'chat.css' | asset_url | stylesheet_tag }}
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<div id="shop-ai-chat-root" class="shop-ai-chat-container" data-state="closed"></div>

<script>
  window.shopAIChatConfig = {
    shopId: {{ shop.id }},
    shopName: {{ shop.name | json }},
    brandColor: {{ block.settings.chat_bubble_color | json }},
    welcomeMessage: {{ block.settings.welcome_message | json }},
    promptType: {{ block.settings.system_prompt | json }}
  };
</script>
<script type="module" src="{{ 'chat.js' | asset_url }}"></script>

{% schema %}
{
  "name": "AI Shopping Assistant",
  "target": "body",
  "settings": [
    {
      "type": "color",
      "id": "chat_bubble_color",
      "label": "Brand color",
      "default": "#5046e4"
    },
    {
      "type": "text",
      "id": "welcome_message",
      "label": "Welcome message",
      "default": "Hi — what brings you in?"
    },
    {
      "type": "select",
      "id": "system_prompt",
      "label": "System Prompt",
      "options": [
        { "value": "standardAssistant", "label": "Standard Assistant" },
        { "value": "enthusiasticAssistant", "label": "Enthusiastic Assistant" }
      ],
      "default": "standardAssistant"
    }
  ]
}
{% endschema %}
```

Key changes from the old template:
- Root `<div>` is now empty (`#shop-ai-chat-root`) with `data-state="closed"`. JS builds the DOM.
- Config object renamed `shopAIChatConfig` (was `shopChatConfig`); adds `shopId`, `shopName`, `brandColor`.
- Script now loads as `type="module"` so `chat.js` can use ES module imports.
- Removed the inline default emoji `👋` from welcome message (matches spec — no emoji in chrome).

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/blocks/chat-interface.liquid extensions/chat-bubble/blocks/chat-interface.liquid.legacy
git commit -m "feat(widget): rewrite liquid template with module-loading shell"
```

---

### Task 5: Stub out the new modular chat.js entry

**Files:**
- Overwrite: `extensions/chat-bubble/assets/chat.js`
- Create: `extensions/chat-bubble/assets/modules/dom.js`

The new entry is a thin orchestrator that imports modules and calls `init`. Modules created in subsequent tasks. For now, `chat.js` just renders a placeholder so we can verify wiring.

- [ ] **Step 1: Backup the old chat.js**

```bash
cd /Applications/pe/shop-chat-agent && cp extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/chat.js.legacy
```

- [ ] **Step 2: Create the dom.js helper**

Create `extensions/chat-bubble/assets/modules/dom.js`:

```js
/**
 * dom — tiny helper functions to keep module code readable.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(node, event, fn, opts) {
  node.addEventListener(event, fn, opts);
  return () => node.removeEventListener(event, fn, opts);
}
```

- [ ] **Step 3: Replace chat.js with the new entry**

Overwrite `extensions/chat-bubble/assets/chat.js`:

```js
/**
 * Shop AI Chat — root entry.
 * Wires modules to the DOM and starts the widget.
 */
import { createOrb } from './modules/orb.js';
import { el, qs } from './modules/dom.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  // Temporary stub: render an orb at 60px just to verify wiring.
  // ui-launcher.js will replace this in Task 7.
  const stub = el('div', { class: 'swa-stub-launcher' }, createOrb({ size: 60 }));
  root.appendChild(stub);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 4: Add minimal stub CSS so the orb is positioned correctly**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Stub launcher (temporary — replaced in Task 7)
 * ============================================================ */
.swa-stub-launcher {
  box-shadow: var(--swa-shadow-md);
  border-radius: 50%;
  cursor: pointer;
}
```

- [ ] **Step 5: Verify locally**

Run the dev server:
```bash
cd /Applications/pe/shop-chat-agent && npm run dev
```

Open a storefront URL with the chat extension enabled. Confirm: the launcher renders as a 60px animated gradient orb with sparkle, in the bottom-right. (If the dev environment requires the Shopify CLI flow to deploy the extension, follow standard project steps for previewing theme extensions.)

This is a manual visual check — no automated test.

- [ ] **Step 6: Commit**

```bash
git add extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/chat.js.legacy extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/dom.js
git commit -m "feat(widget): introduce modular chat.js entry with orb stub"
```

---

### Task 6: Build the widget state module

**Files:**
- Create: `extensions/chat-bubble/assets/modules/state.js`
- Create: `tests/extension/state.test.js`

`WidgetState` is the single source of truth for the widget's UI state. Modules subscribe to changes rather than reading globals.

- [ ] **Step 1: Write the failing tests**

Create `tests/extension/state.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createState } from '../../extensions/chat-bubble/assets/modules/state.js';

describe('createState', () => {
  it('exposes initial values', () => {
    const s = createState({ isOpen: false, unreadCount: 0 });
    expect(s.get('isOpen')).toBe(false);
    expect(s.get('unreadCount')).toBe(0);
  });

  it('updates a value via set', () => {
    const s = createState({ isOpen: false });
    s.set('isOpen', true);
    expect(s.get('isOpen')).toBe(true);
  });

  it('notifies subscribers when a value changes', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    let lastValue;
    s.subscribe('isOpen', (v) => { calls++; lastValue = v; });
    s.set('isOpen', true);
    expect(calls).toBe(1);
    expect(lastValue).toBe(true);
  });

  it('does not notify when the value is unchanged', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    s.subscribe('isOpen', () => calls++);
    s.set('isOpen', false);
    expect(calls).toBe(0);
  });

  it('supports unsubscribing', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    const unsubscribe = s.subscribe('isOpen', () => calls++);
    s.set('isOpen', true);
    unsubscribe();
    s.set('isOpen', false);
    expect(calls).toBe(1);
  });

  it('throws when get/set/subscribe is called with an unknown key', () => {
    const s = createState({ isOpen: false });
    expect(() => s.get('bogus')).toThrow();
    expect(() => s.set('bogus', 1)).toThrow();
    expect(() => s.subscribe('bogus', () => {})).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- state
```

Expected: 6 FAIL with `Cannot find module ... state.js`.

- [ ] **Step 3: Implement createState**

Create `extensions/chat-bubble/assets/modules/state.js`:

```js
/**
 * createState — subscribable state object with a fixed key schema.
 *
 * Usage:
 *   const state = createState({ isOpen: false, unreadCount: 0 });
 *   state.subscribe('isOpen', (v) => render(v));
 *   state.set('isOpen', true);   // triggers subscribers if value changed
 */
export function createState(initial) {
  const values = { ...initial };
  const subs = new Map();
  for (const k of Object.keys(initial)) subs.set(k, new Set());

  function assertKey(k) {
    if (!subs.has(k)) {
      throw new Error(`WidgetState: unknown key "${k}". Define it in createState's initial map.`);
    }
  }

  return {
    get(k) { assertKey(k); return values[k]; },
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
    },
  };
}

/** The default widget-state schema used by chat.js root. */
export const INITIAL_STATE = {
  isOpen: false,
  isMinimized: false,
  hasUnread: false,
  pendingMessagePreview: null, // string | null
  isOnline: true,
  shopName: '',
  brandColor: '#5046E4',
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- state
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/modules/state.js tests/extension/state.test.js
git commit -m "feat(widget): add WidgetState module with subscribe/set/get"
```

---

### Task 7: Build the launcher (resting state + click to open)

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-launcher.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append launcher styles)
- Modify: `extensions/chat-bubble/assets/chat.js` (replace stub with ui-launcher)

- [ ] **Step 1: Append launcher CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Launcher
 * ============================================================ */
.swa-launcher {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--swa-shadow-md);
  border: none;
  padding: 0;
  background: transparent;
  transition: transform var(--swa-duration-base) var(--swa-ease-standard),
              box-shadow var(--swa-duration-base) var(--swa-ease-standard);
  animation: swa-launcher-float 4s ease-in-out infinite;
}
.swa-launcher:hover {
  transform: scale(1.05);
  box-shadow: var(--swa-shadow-lg);
}
.swa-launcher:active {
  transform: scale(0.95);
}
.swa-launcher:focus-visible {
  outline: 3px solid var(--swa-color-focus-ring);
  outline-offset: 2px;
}

@keyframes swa-launcher-float {
  0%, 100% { translate: 0 0; }
  50%      { translate: 0 -0.5px; }
}

@media (max-width: 480px) {
  .swa-launcher { width: 56px; height: 56px; }
}

/* Hide the temporary stub from Task 5 once ui-launcher takes over */
.swa-stub-launcher { display: none; }
```

- [ ] **Step 2: Build ui-launcher.js**

Create `extensions/chat-bubble/assets/modules/ui-launcher.js`:

```js
import { el } from './dom.js';
import { createOrb } from './orb.js';

/**
 * Renders the launcher button. Click → state.set('isOpen', true).
 * Returns the DOM node.
 */
export function createLauncher({ state, sizeDesktop = 60, sizeMobile = 56 }) {
  const size = window.matchMedia('(max-width: 480px)').matches ? sizeMobile : sizeDesktop;
  const orb = createOrb({ size });

  const button = el('button', {
    class: 'swa-launcher',
    type: 'button',
    'aria-label': 'Open shopping assistant',
  }, orb);

  button.addEventListener('click', () => {
    state.set('isOpen', true);
  });

  // Re-size orb on viewport change.
  const mql = window.matchMedia('(max-width: 480px)');
  const handleViewportChange = () => {
    const newSize = mql.matches ? sizeMobile : sizeDesktop;
    orb.style.width = `${newSize}px`;
    orb.style.height = `${newSize}px`;
  };
  if (mql.addEventListener) mql.addEventListener('change', handleViewportChange);

  return button;
}
```

- [ ] **Step 3: Wire ui-launcher into chat.js**

Overwrite `extensions/chat-bubble/assets/chat.js`:

```js
/**
 * Shop AI Chat — root entry.
 */
import { qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  // Apply merchant brand color as a CSS variable override on the root.
  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  root.appendChild(launcher);

  // Open/close state is observed in Task 8 by ui-window. For now, log it.
  state.subscribe('isOpen', (v) => {
    root.dataset.state = v ? 'open' : 'closed';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 4: Manual verification**

Run dev server, load storefront, confirm:
- Launcher appears bottom-right at 60px desktop / 56px mobile
- Subtle float micro-motion runs at 4s interval
- Click changes `data-state` on `#shop-ai-chat-root` from `closed` → `open` (verify in DevTools)

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-launcher.js
git commit -m "feat(widget): build launcher (resting + click-to-open)"
```

---

### Task 8: Build the window shell (open/close, viewport, focus management)

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-window.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append window styles)
- Modify: `extensions/chat-bubble/assets/chat.js` (mount window)

- [ ] **Step 1: Append window CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Window
 * ============================================================ */
.swa-window {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 420px;
  height: 640px;
  max-height: calc(var(--swa-viewport-height, 100vh) - 120px);
  background: var(--swa-color-bg);
  border-radius: var(--swa-radius-xl);
  box-shadow: var(--swa-shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(12px);
  transition:
    opacity var(--swa-duration-slow) var(--swa-ease-emphasized),
    transform var(--swa-duration-slow) var(--swa-ease-emphasized);
  z-index: var(--swa-z-window);
  font-size: var(--swa-text-base);
}
.shop-ai-chat-container[data-state="open"] .swa-window {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* Tablet */
@media (max-width: 768px) and (min-width: 481px) {
  .swa-window { width: 380px; height: 600px; }
}

/* Mobile — full-screen */
@media (max-width: 480px) {
  .shop-ai-chat-container {
    bottom: 16px;
    right: 16px;
  }
  .swa-window {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    height: var(--swa-viewport-height, 100vh);
    max-height: none;
    border-radius: 0;
    box-shadow: none;
    transform: translateY(100%);
    padding-bottom: env(safe-area-inset-bottom);
    padding-top: env(safe-area-inset-top);
  }
  .shop-ai-chat-container[data-state="open"] .swa-window {
    transform: translateY(0);
  }
  body.swa-locked {
    overflow: hidden;
    position: fixed;
    width: 100%;
  }
}
```

- [ ] **Step 2: Build ui-window.js**

Create `extensions/chat-bubble/assets/modules/ui-window.js`:

```js
import { el, qs } from './dom.js';

/**
 * Builds the window shell.
 *
 * Returns:
 *   { node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot }
 *
 * The slots are empty DOM nodes that other modules populate.
 */
export function createWindow({ state, launcher }) {
  const headerSlot = el('div', { class: 'swa-window-header-slot' });
  const streamSlot = el('div', { class: 'swa-window-stream-slot' });
  const dockSlot = el('div', { class: 'swa-window-dock-slot' });
  const composerSlot = el('div', { class: 'swa-window-composer-slot' });
  const footerSlot = el('div', { class: 'swa-window-footer-slot' });

  const node = el('div', {
    class: 'swa-window',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Shopping assistant',
    'aria-hidden': 'true',
  }, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot);

  // Track viewport-height for iOS Safari (dynamic viewport workaround).
  const setViewportVar = () => {
    document.documentElement.style.setProperty('--swa-viewport-height', `${window.innerHeight}px`);
  };
  setViewportVar();
  window.addEventListener('resize', setViewportVar);

  // Open/close lifecycle.
  let lastFocused = null;
  state.subscribe('isOpen', (isOpen) => {
    node.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) {
      lastFocused = document.activeElement;
      document.body.classList.add('swa-locked');
      // Focus the composer once Task 10 mounts it; for now, focus the window.
      requestAnimationFrame(() => {
        const composerInput = qs('.swa-composer input, .swa-composer textarea', node);
        (composerInput || node).focus();
      });
    } else {
      document.body.classList.remove('swa-locked');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      } else if (launcher) {
        launcher.focus();
      }
    }
  });

  // Esc to close (desktop).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.get('isOpen')) {
      state.set('isOpen', false);
    }
  });

  return { node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot };
}
```

- [ ] **Step 3: Wire window into chat.js**

Replace `extensions/chat-bubble/assets/chat.js`:

```js
import { qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  const window_ = createWindow({ state, launcher });

  root.appendChild(launcher);
  root.appendChild(window_.node);

  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 4: Manual verification**

Reload storefront:
- Click launcher → window slides up (mobile) / fades in (desktop)
- On mobile, body locks scroll
- Press Esc → window closes (desktop)
- Click outside the window → window remains open (intentional — only Esc and close button close it; close button lands in Task 9)
- Reopen → focus returns to a sensible target inside the window

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-window.js
git commit -m "feat(widget): build window shell with slot architecture"
```

---

### Task 9: Build the header

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-header.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append header styles)
- Modify: `extensions/chat-bubble/assets/chat.js` (mount header)

- [ ] **Step 1: Append header CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Header
 * ============================================================ */
.swa-header {
  height: 48px;
  padding: 0 var(--swa-space-4);
  display: flex;
  align-items: center;
  gap: var(--swa-space-3);
  border-bottom: 1px solid var(--swa-color-border);
  flex-shrink: 0;
}
.swa-header-title {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.swa-header-name {
  font-size: var(--swa-text-md);
  font-weight: var(--swa-weight-medium);
  color: var(--swa-color-text-primary);
}
.swa-header-status {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--swa-space-1);
}
.swa-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--swa-color-success-fg);
  display: inline-block;
}
.swa-status-dot[data-status="idle"] { background: var(--swa-color-text-tertiary); }
.swa-status-dot[data-status="reconnecting"] { background: var(--swa-color-warning-fg); }
.swa-status-dot[data-status="offline"] { display: none; }

.swa-header-actions {
  margin-left: auto;
  display: flex;
  gap: var(--swa-space-1);
}
.swa-icon-button {
  width: 32px;
  height: 32px;
  border-radius: var(--swa-radius-sm);
  border: none;
  background: transparent;
  color: var(--swa-color-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.swa-icon-button:hover {
  background: var(--swa-color-bg-subtle);
  color: var(--swa-color-text-primary);
}
.swa-icon-button:focus-visible {
  outline: 2px solid var(--swa-color-focus-ring);
  outline-offset: 1px;
}
.swa-icon-button svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

- [ ] **Step 2: Build ui-header.js**

Create `extensions/chat-bubble/assets/modules/ui-header.js`:

```js
import { el } from './dom.js';
import { createOrb } from './orb.js';

const ICONS = {
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

function iconSvg(pathInner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = pathInner;
  return svg;
}

/**
 * Builds the header. Subscribes to state.shopName and state.isOnline.
 * Returns the DOM node.
 */
export function createHeader({ state }) {
  const orb = createOrb({ size: 32 });

  const name = el('div', { class: 'swa-header-name' });
  const statusDot = el('span', { class: 'swa-status-dot' });
  const statusText = el('span', { class: 'swa-header-status-text' });
  const status = el('div', { class: 'swa-header-status' }, statusDot, statusText);

  const title = el('div', { class: 'swa-header-title' }, name, status);

  const minimizeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Minimize',
  }, iconSvg(ICONS.minus));
  minimizeBtn.addEventListener('click', () => state.set('isOpen', false));

  const closeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Close',
  }, iconSvg(ICONS.close));
  closeBtn.addEventListener('click', () => state.set('isOpen', false));

  const actions = el('div', { class: 'swa-header-actions' }, minimizeBtn, closeBtn);

  const node = el('header', { class: 'swa-header' }, orb, title, actions);

  function render() {
    const shop = state.get('shopName');
    name.textContent = shop ? `${shop} AI` : 'Shopping Assistant';
    const online = state.get('isOnline');
    statusDot.dataset.status = online ? 'online' : 'offline';
    statusText.textContent = online ? '● Online · AI-powered' : '○ Offline';
    // Note: the dot is rendered separately, so strip the leading "●" here.
    statusText.textContent = online ? 'Online · AI-powered' : 'Offline';
  }
  render();
  state.subscribe('shopName', render);
  state.subscribe('isOnline', render);

  return node;
}
```

- [ ] **Step 3: Mount header in chat.js**

Update `extensions/chat-bubble/assets/chat.js` — replace the `init` function's body's tail to mount the header:

```js
import { qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  const window_ = createWindow({ state, launcher });
  const header = createHeader({ state });
  window_.headerSlot.appendChild(header);

  root.appendChild(launcher);
  root.appendChild(window_.node);

  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 4: Manual verification**

Reload storefront, open widget. Confirm:
- 32px orb on the left
- `{Shop name} AI` or `Shopping Assistant` (fallback) as title
- `Online · AI-powered` with green dot as status
- Minimize and close buttons on the right, both close the widget on click
- Hover states on icon buttons visible

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-header.js
git commit -m "feat(widget): build header with orb, title, status, minimize/close"
```

---

### Task 10: Build the composer

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-composer.js`
- Create: `tests/extension/ui-composer.test.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append composer styles)
- Modify: `extensions/chat-bubble/assets/chat.js` (mount composer)

The composer is heavier than other modules because it has logic (auto-expand, keyboard handling, enable/disable). The auto-expand logic is unit-tested.

- [ ] **Step 1: Write failing tests for composer logic**

Create `tests/extension/ui-composer.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComposer } from '../../extensions/chat-bubble/assets/modules/ui-composer.js';

describe('createComposer', () => {
  let onSubmit;
  let composer;

  beforeEach(() => {
    document.body.innerHTML = '';
    onSubmit = vi.fn();
    composer = createComposer({ onSubmit });
    document.body.appendChild(composer.node);
  });

  it('renders a textarea and a send button', () => {
    expect(composer.node.querySelector('textarea')).not.toBeNull();
    expect(composer.node.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('send button is disabled when input is empty', () => {
    const btn = composer.node.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(true);
  });

  it('send button is enabled when input has non-whitespace text', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const btn = composer.node.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(false);
  });

  it('Enter submits non-empty input', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    ta.dispatchEvent(e);
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('Shift+Enter does NOT submit', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const e = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
    ta.dispatchEvent(e);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter with empty input does not submit', () => {
    const ta = composer.node.querySelector('textarea');
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    ta.dispatchEvent(e);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('input value is cleared after submit', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    composer.submit();
    expect(ta.value).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- ui-composer
```

Expected: 7 FAIL with `Cannot find module ... ui-composer.js`.

- [ ] **Step 3: Implement ui-composer.js**

Create `extensions/chat-bubble/assets/modules/ui-composer.js`:

```js
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
    const max = 4 * 22; // ~4 lines at 22px each
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

  // Keyboard shortcut: Cmd/Ctrl+/ focuses the composer (desktop).
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      textarea.focus();
    }
  });

  return { node, submit, focus: () => textarea.focus() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- ui-composer
```

Expected: 7 PASS.

- [ ] **Step 5: Append composer CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Composer
 * ============================================================ */
.swa-composer {
  display: flex;
  align-items: flex-end;
  gap: var(--swa-space-2);
  padding: var(--swa-space-3) var(--swa-space-4);
  border-top: 1px solid var(--swa-color-border);
  background: var(--swa-color-bg);
  flex-shrink: 0;
}

.swa-composer-input {
  flex: 1;
  min-height: 36px;
  max-height: 88px;
  padding: var(--swa-space-2) var(--swa-space-3);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  background: var(--swa-color-bg-subtle);
  font-family: var(--swa-font-sans);
  font-size: var(--swa-text-base);
  color: var(--swa-color-text-primary);
  resize: none;
  outline: none;
  overflow-y: auto;
  line-height: 1.4;
}

.swa-composer-input:focus {
  border-color: var(--swa-color-brand);
  background: var(--swa-color-bg);
}

/* iOS 16px-rule: prevents zoom on focus */
@media (max-width: 480px) {
  .swa-composer-input { font-size: 16px; }
}

.swa-composer-attach {
  align-self: flex-end;
  height: 36px;
}

.swa-composer-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--swa-color-brand);
  color: var(--swa-color-brand-foreground);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--swa-duration-fast) var(--swa-ease-standard);
}
.swa-composer-send:not(:disabled):hover {
  background: var(--swa-color-brand-hover);
}
.swa-composer-send:disabled {
  background: var(--swa-color-border-strong);
  cursor: not-allowed;
}
.swa-composer-send:focus-visible {
  outline: 3px solid var(--swa-color-focus-ring);
  outline-offset: 2px;
}
.swa-composer-send svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

- [ ] **Step 6: Mount composer in chat.js**

Update `extensions/chat-bubble/assets/chat.js`:

```js
import { qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';
import { createComposer } from './modules/ui-composer.js';

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  const window_ = createWindow({ state, launcher });
  const header = createHeader({ state });
  const composer = createComposer({
    onSubmit: (value) => {
      // Plan 2 wires this to api.js + ui-stream.js; for now, log it.
      console.log('[swa] message submitted:', value);
    },
    onAttach: () => {
      // Plan 4 wires image upload.
      console.log('[swa] attach clicked');
    },
  });

  window_.headerSlot.appendChild(header);
  window_.composerSlot.appendChild(composer.node);

  root.appendChild(launcher);
  root.appendChild(window_.node);

  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
    if (isOpen) requestAnimationFrame(() => composer.focus());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 7: Manual verification**

Reload storefront, open widget. Confirm:
- Composer appears at bottom with attach + textarea + send
- Send button disabled when empty, enables when typing
- Typing a long message auto-expands textarea up to ~4 lines, then scrolls inside
- Pressing Enter clears input and logs to console
- Shift+Enter inserts a newline
- Focus moves to composer when window opens
- On mobile, focus does not trigger iOS zoom (verify on actual device or simulator if available)

- [ ] **Step 8: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-composer.js tests/extension/ui-composer.test.js
git commit -m "feat(widget): build composer with auto-expand and keyboard handling"
```

---

### Task 11: Build the empty stream + footer slots

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-stream.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append stream + footer styles)
- Modify: `extensions/chat-bubble/assets/chat.js` (mount stream + footer)

In this plan the stream is just an empty container. Plan 2 implements the welcome panel and turn rendering.

- [ ] **Step 1: Append stream + footer CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Stream (placeholder — populated in Plan 2)
 * ============================================================ */
.swa-stream {
  flex: 1;
  overflow-y: auto;
  padding: var(--swa-space-4);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}
.swa-stream::-webkit-scrollbar { width: 8px; }
.swa-stream::-webkit-scrollbar-thumb {
  background: var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
}

.swa-stream-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--swa-color-text-tertiary);
  font-size: var(--swa-text-sm);
}

/* ============================================================
 * Footer
 * ============================================================ */
.swa-footer {
  padding: var(--swa-space-2) var(--swa-space-4);
  border-top: 1px solid var(--swa-color-border);
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  text-align: center;
  flex-shrink: 0;
}
.swa-footer a {
  color: var(--swa-color-text-tertiary);
  text-decoration: underline;
}
```

- [ ] **Step 2: Build ui-stream.js (stub)**

Create `extensions/chat-bubble/assets/modules/ui-stream.js`:

```js
import { el } from './dom.js';

/**
 * Stub for Plan 1. Renders an empty placeholder.
 * Plan 2 replaces this with the real welcome + turn-list rendering.
 */
export function createStream() {
  const empty = el('div', { class: 'swa-stream-empty' }, 'Chat ready — welcome panel lands in Plan 2.');
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
  }, empty);
  return { node };
}
```

- [ ] **Step 3: Mount stream + footer in chat.js**

Update `extensions/chat-bubble/assets/chat.js`:

```js
import { el, qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';
import { createComposer } from './modules/ui-composer.js';
import { createStream } from './modules/ui-stream.js';

function buildFooter(shopName) {
  return el('div', { class: 'swa-footer' },
    `Powered by ${shopName || 'Shop'} AI · `,
    el('a', { href: '#', target: '_blank', rel: 'noopener' }, 'Privacy')
  );
}

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
  });

  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const launcher = createLauncher({ state });
  const window_ = createWindow({ state, launcher });
  const header = createHeader({ state });
  const composer = createComposer({
    onSubmit: (value) => console.log('[swa] message submitted:', value),
    onAttach: () => console.log('[swa] attach clicked'),
  });
  const stream = createStream();
  const footer = buildFooter(config.shopName);

  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  root.appendChild(launcher);
  root.appendChild(window_.node);

  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
    if (isOpen) requestAnimationFrame(() => composer.focus());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 4: Manual verification**

Reload storefront, open widget. Confirm:
- Stream area is empty with placeholder text (vertically centered)
- Footer at bottom shows `Powered by {Shop} AI · Privacy`
- Window scrolls when content exceeds height (no test content yet, but verify the stream area takes the right amount of space)

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-stream.js
git commit -m "feat(widget): mount stream + footer slots (stubs for plan 2)"
```

---

### Task 12: Build pending-pill expansion (minimized-with-unread)

**Files:**
- Modify: `extensions/chat-bubble/assets/modules/ui-launcher.js` (add pending pill)
- Modify: `extensions/chat-bubble/assets/chat.css` (append pill styles)

When the widget is closed and the assistant has an unread message, the launcher transforms into a pill: `{shop} AI ●` with a red dot, and a preview bubble appears above. Auto-collapses after 10s. In this plan we build the rendering and the state hookup — populating from a real conversation lands in Plan 2.

- [ ] **Step 1: Append pill + preview-bubble CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Pending pill (launcher transforms when there's an unread)
 * ============================================================ */
.swa-launcher[data-mode="pill"] {
  width: auto;
  height: 56px;
  border-radius: var(--swa-radius-full);
  padding: 0 var(--swa-space-4) 0 var(--swa-space-2);
  display: inline-flex;
  align-items: center;
  gap: var(--swa-space-2);
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  animation: none;
}
.swa-launcher[data-mode="pill"] .swa-launcher-label {
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  color: var(--swa-color-text-primary);
}
.swa-launcher-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--swa-color-danger-fg);
}

.swa-preview-bubble {
  position: absolute;
  bottom: 84px;
  right: 0;
  max-width: 280px;
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-lg);
  box-shadow: var(--swa-shadow-md);
  padding: var(--swa-space-3);
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-primary);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity var(--swa-duration-base), transform var(--swa-duration-base);
}
.swa-preview-bubble[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.swa-preview-source {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  margin-bottom: var(--swa-space-1);
}
```

- [ ] **Step 2: Extend ui-launcher.js with pill rendering and subscriptions**

Replace `extensions/chat-bubble/assets/modules/ui-launcher.js`:

```js
import { el } from './dom.js';
import { createOrb } from './orb.js';

const COLLAPSE_AFTER_MS = 10_000;

export function createLauncher({ state, sizeDesktop = 60, sizeMobile = 56 }) {
  const isMobile = () => window.matchMedia('(max-width: 480px)').matches;
  const baseSize = () => (isMobile() ? sizeMobile : sizeDesktop);

  const orb = createOrb({ size: baseSize() });
  const label = el('span', { class: 'swa-launcher-label' });
  const dot = el('span', { class: 'swa-launcher-unread-dot' });

  const button = el('button', {
    class: 'swa-launcher',
    type: 'button',
    'aria-label': 'Open shopping assistant',
    dataset: { mode: 'circle' },
  }, orb);

  const previewBubble = el('div', {
    class: 'swa-preview-bubble',
    dataset: { visible: 'false' },
    role: 'status',
    'aria-live': 'polite',
  });
  const previewSource = el('div', { class: 'swa-preview-source' });
  const previewBody = el('div', { class: 'swa-preview-body' });
  previewBubble.append(previewSource, previewBody);

  button.addEventListener('click', () => {
    state.set('isOpen', true);
    state.set('hasUnread', false);
    state.set('pendingMessagePreview', null);
  });

  let collapseTimer = null;
  function applyMode() {
    const hasUnread = state.get('hasUnread');
    const isOpen = state.get('isOpen');
    const showPill = hasUnread && !isOpen;

    if (showPill) {
      button.dataset.mode = 'pill';
      button.setAttribute('aria-label', `${state.get('shopName') || 'Shop'} AI — new message`);
      const orbSize = 40;
      orb.style.width = `${orbSize}px`;
      orb.style.height = `${orbSize}px`;
      label.textContent = `${state.get('shopName') || 'Shop'} AI`;
      if (!button.contains(label)) button.append(label, dot);
      // Auto-collapse after 10s
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => {
        state.set('hasUnread', false);
        state.set('pendingMessagePreview', null);
      }, COLLAPSE_AFTER_MS);
    } else {
      button.dataset.mode = 'circle';
      button.setAttribute('aria-label', 'Open shopping assistant');
      orb.style.width = `${baseSize()}px`;
      orb.style.height = `${baseSize()}px`;
      label.remove();
      dot.remove();
      clearTimeout(collapseTimer);
    }
  }

  function applyPreview() {
    const preview = state.get('pendingMessagePreview');
    const isOpen = state.get('isOpen');
    if (preview && !isOpen) {
      previewSource.textContent = `${state.get('shopName') || 'Shop'} AI · just now`;
      previewBody.textContent = preview;
      previewBubble.dataset.visible = 'true';
    } else {
      previewBubble.dataset.visible = 'false';
    }
  }

  state.subscribe('hasUnread', applyMode);
  state.subscribe('isOpen', applyMode);
  state.subscribe('shopName', applyMode);
  state.subscribe('pendingMessagePreview', applyPreview);
  state.subscribe('isOpen', applyPreview);

  const mql = window.matchMedia('(max-width: 480px)');
  const handle = () => applyMode();
  if (mql.addEventListener) mql.addEventListener('change', handle);

  return { node: button, previewBubble };
}
```

- [ ] **Step 3: Wire preview bubble into chat.js**

Update `extensions/chat-bubble/assets/chat.js` — append the preview bubble alongside the launcher:

```js
// inside init(), where launcher is created — change:
//   const launcher = createLauncher({ state });
//   root.appendChild(launcher);
// to:
const launcherCtl = createLauncher({ state });
root.appendChild(launcherCtl.node);
root.appendChild(launcherCtl.previewBubble);
```

And update the `createWindow({ ... launcher })` call to pass `launcherCtl.node`:

```js
const window_ = createWindow({ state, launcher: launcherCtl.node });
```

- [ ] **Step 4: Manual verification with a test fixture**

Add a temporary debug helper in the dev console:

```js
// Run in browser devtools when widget is closed
const root = document.querySelector('#shop-ai-chat-root');
// We need state — for testing, expose it via `window.__swaState` in chat.js init.
```

Add to `chat.js` (development-only — gate by a window flag):

```js
// Append at end of init() — DEV ONLY
if (typeof window !== 'undefined') window.__swaState = state;
```

Run in console:

```js
window.__swaState.set('pendingMessagePreview', 'Found 3 rings in your size — want to take a look?');
window.__swaState.set('hasUnread', true);
```

Confirm:
- Launcher transforms from circle into a pill with `{shop} AI` + red dot
- Preview bubble appears above the pill showing the message
- After 10 seconds, both auto-collapse back to the circle launcher
- Clicking the pill opens the widget and clears the preview

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/chat.js extensions/chat-bubble/assets/modules/ui-launcher.js
git commit -m "feat(widget): add pending-pill expansion + preview bubble on unread"
```

---

### Task 13: Build a dev test-surfaces.html page

**Files:**
- Create: `extensions/chat-bubble/assets/test-surfaces.html`

This page renders all Plan 1 surfaces in isolation so visual changes can be verified without a running Shopify dev environment. Not loaded by the theme; opened directly in the browser.

- [ ] **Step 1: Create test-surfaces.html**

Create `extensions/chat-bubble/assets/test-surfaces.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shop AI Widget — Surface Tests</title>
  <link rel="stylesheet" href="./chat.css">
  <style>
    body {
      margin: 0;
      padding: 40px;
      font-family: -apple-system, sans-serif;
      background: #f5f5f7;
    }
    h2 { font-size: 14px; margin: 40px 0 12px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .stage {
      background: #fff;
      padding: 24px;
      border-radius: 12px;
      min-height: 80px;
      position: relative;
    }
    .grid { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; }
    .row { padding: 12px 0; }
  </style>
</head>
<body>
  <h1>Shop AI Widget — Surface Tests</h1>
  <p>Plan 1: foundation surfaces in isolation. Refresh after changing chat.css to see updates.</p>

  <h2>Orbs (at every size)</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div class="grid" id="orb-grid"></div>
  </div>

  <h2>Launcher (resting + pill)</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;height:140px;">
    <div id="launcher-stage"></div>
  </div>

  <h2>Header</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="header-stage" style="width:420px;"></div>
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

    // Orb grid
    const orbGrid = document.getElementById('orb-grid');
    for (const size of [16, 22, 32, 60, 96]) {
      const wrap = document.createElement('div');
      wrap.style.textAlign = 'center';
      const o = createOrb({ size });
      const lbl = document.createElement('div');
      lbl.style.fontSize = '11px';
      lbl.style.color = '#888';
      lbl.style.marginTop = '6px';
      lbl.textContent = `${size}px`;
      wrap.append(o, lbl);
      orbGrid.appendChild(wrap);
    }

    // Launcher — resting + pill states (separate state instances)
    const restState = createState({ ...INITIAL_STATE, shopName: 'Shop LC' });
    const pillState = createState({ ...INITIAL_STATE, shopName: 'Shop LC', hasUnread: true, pendingMessagePreview: 'Found 3 rings in your size.' });

    const lstage = document.getElementById('launcher-stage');
    const restCtl = createLauncher({ state: restState });
    const pillCtl = createLauncher({ state: pillState });
    lstage.append(restCtl.node, document.createTextNode('   '), pillCtl.node, pillCtl.previewBubble);

    // Header
    const headerState = createState({ ...INITIAL_STATE, shopName: 'Shop LC' });
    document.getElementById('header-stage').appendChild(createHeader({ state: headerState }));

    // Composer
    const composer = createComposer({ onSubmit: (v) => alert(`Sent: ${v}`) });
    document.getElementById('composer-stage').appendChild(composer.node);
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Open in browser:
```bash
open /Applications/pe/shop-chat-agent/extensions/chat-bubble/assets/test-surfaces.html
```

Confirm:
- Five orbs render at 16/22/32/60/96 px, all animating
- Sparkle visible on 22/32/60/96 px; not visible on 16px
- Launcher resting state (left) shows orb circle
- Launcher pill state (right) shows pill + red dot + preview bubble
- Header renders with `Shop LC AI`, online status, minimize, close
- Composer renders with attach, textarea, send button (disabled until typing)

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/test-surfaces.html
git commit -m "build(widget): add test-surfaces.html dev preview page"
```

---

### Task 14: Clean up legacy files and finalize Plan 1

**Files:**
- Delete: `extensions/chat-bubble/assets/chat.css.legacy`
- Delete: `extensions/chat-bubble/assets/chat.js.legacy`
- Delete: `extensions/chat-bubble/blocks/chat-interface.liquid.legacy`
- Modify: `extensions/chat-bubble/assets/chat.js` (remove the dev `window.__swaState` exposure)

- [ ] **Step 1: Delete legacy backups**

```bash
cd /Applications/pe/shop-chat-agent
rm extensions/chat-bubble/assets/chat.css.legacy
rm extensions/chat-bubble/assets/chat.js.legacy
rm extensions/chat-bubble/blocks/chat-interface.liquid.legacy
```

- [ ] **Step 2: Remove dev-only state exposure**

In `extensions/chat-bubble/assets/chat.js`, remove the line:

```js
if (typeof window !== 'undefined') window.__swaState = state;
```

(Plan 2 will re-introduce a debug helper behind an explicit flag.)

- [ ] **Step 3: Run full test suite**

```bash
cd /Applications/pe/shop-chat-agent && npm test
```

Expected: all tests pass (smoke, orb, state, ui-composer).

- [ ] **Step 4: Run linter and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: no errors. (If lint reports issues in the new module files, fix inline.)

- [ ] **Step 5: Final manual smoke**

Run dev server, load storefront:
- Launcher visible bottom-right, animated
- Click → window slides up (mobile) / fades in (desktop)
- Header shows `{Shop} AI` + status
- Composer enables on typing, Enter logs to console
- Close button + Esc both close the window
- No console errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(widget): clean up legacy files; finalize plan 1 foundation"
```

---

## Self-Review

Running the checks the writing-plans skill prescribes.

**1. Spec coverage (sections §1–§7 of the design spec):**

- §1 Summary — not directly implementable; informs goals
- §2 Goals & success criteria — informs acceptance, no task needed
- §3 Visual personality — Task 3 (tokens) ✓
- §4 Design tokens — Task 3 ✓
- §5 Layout & viewports — Task 8 (window) + Task 7 (launcher) ✓
- §6.1 Launcher resting — Task 7 ✓
- §6.2 Pending-pill expansion — Task 12 ✓
- §6.3 Proactive preview — **Deferred to Plan 4** (full F4 trigger engine); rendering scaffolding is in Task 12 (preview bubble exists)
- §6.4 Orb component — Task 2 ✓
- §7 Header — Task 9 ✓

Plus infrastructure: Vitest (Task 1), Liquid template rewrite (Task 4), modular chat.js entry (Task 5), state module (Task 6), composer (Task 10), stream stub + footer (Task 11), test-surfaces page (Task 13), cleanup (Task 14).

§6.3 proactive *trigger engine* is correctly out of scope for Plan 1 — it requires dwell/scroll/exit-intent detection, page-context resolution, and frequency policy, which the spec assigns to Plan 4. The preview bubble *rendering* is built in Task 12 so Plan 4 can wire signals into it.

**2. Placeholder scan:** none — every code step contains exact code.

**3. Type consistency:**

- `createOrb({size, paused})` consistent across orb.js, ui-launcher.js, ui-header.js, test-surfaces.html ✓
- `createState(initial).get/set/subscribe` consistent across state.js tests and all consumers ✓
- `createLauncher({state})` returns `{node, previewBubble}` — used consistently in chat.js (Task 12 update) and test-surfaces.html ✓
- `createWindow({state, launcher})` returns `{node, headerSlot, streamSlot, dockSlot, composerSlot, footerSlot}` — chat.js consumes these slots ✓
- `createHeader({state})` returns a DOM node — consumed via `appendChild(header)` ✓
- `createComposer({onSubmit, onAttach})` returns `{node, submit, focus}` — `composer.node` and `composer.focus()` used in chat.js ✓
- `createStream()` returns `{node}` — consumed via `appendChild(stream.node)` ✓
- `INITIAL_STATE` keys consistent: `isOpen`, `isMinimized`, `hasUnread`, `pendingMessagePreview`, `isOnline`, `shopName`, `brandColor` — all referenced keys exist ✓
- CSS class names consistent: `swa-orb`, `swa-orb-sparkle`, `swa-launcher`, `swa-window`, `swa-header`, `swa-composer`, etc. — no drift ✓

No issues found.

---

## What's NOT in this plan

Explicit deferrals (these land in subsequent plans):

| Item | Goes to |
|---|---|
| Welcome panel + welcome resolver service | Plan 2 |
| Message stream rendering (turns, bubbles, markdown, tool-use, quick-replies) | Plan 2 |
| API integration (sending messages, streaming responses) | Plan 2 |
| Product cards, carousels, ATC state machine | Plan 3 |
| Cart summary, checkout, express checkout, orders, save-cart, auth | Plan 3 |
| Sizing widget | Plan 4 |
| Comparison sheet | Plan 4 |
| Proactive trigger engine (F4) | Plan 4 |
| Returning-user resume card | Plan 4 |
| Error/offline/rate-limit states | Plan 4 |
| Auto-scroll pause behavior | Plan 4 |
| Full A11y audit (focus management is started here, finalized in Plan 4) | Plan 4 |
| Pack-level token overrides | Plan 4 |
