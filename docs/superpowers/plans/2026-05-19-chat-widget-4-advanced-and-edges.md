# Chat Widget UI — Plan 4: Advanced Blocks, Proactive Engine, Edge States, A11y

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the widget. After Plan 4 ships: sizing widget runs as a multi-step interactive block; 3+ product comparison opens as a bottom sheet; the proactive engine engages shoppers on PDP dwell / multi-PDP / cart hesitation / exit intent / OOS variants; returning users get a resume card; error / offline / rate-limited states recover gracefully; auto-scroll respects shopper intent; shopper can upload images; widget passes WCAG 2.1 AA.

**Architecture:** All new code is client-side — no new backend routes. The proactive engine is a single module subscribing to page events (URL changes, scroll, dwell timer, exit-intent, visibility change). The sizing widget is rendered from a sizing_widget block emitted by the assistant; client tracks per-step state and emits resolved answers as user messages. Comparison sheet uses a bottom-sheet overlay above the window. Edge states all key off `WidgetState` flags added in this plan.

**Spec reference:** [docs/superpowers/specs/2026-05-19-chat-widget-ui-design.md](../specs/2026-05-19-chat-widget-ui-design.md) — sections §9.5 (sizing widget), §9.6 (comparison), §9.7 (image_preview / vision_result), §9.8 (auto-scroll), §12 (edge states), §14 (A11y).

---

## File Structure

**New modules:**

```
extensions/chat-bubble/assets/modules/
  ui-sizing-widget.js      # multi-step interactive block
  ui-compare-sheet.js      # bottom sheet for 3+ products
  ui-image-preview.js      # user-uploaded image bubble
  ui-resume-card.js        # returning-user resume
  ui-error-banner.js       # mid-stream + offline + rate-limited banners
  proactive.js             # trigger engine (dwell, scroll, exit, multi-PDP)
  auto-scroll.js           # scroll-pause + "↓ New messages" pill
  a11y.js                  # focus management helpers
```

**Modified files:**

```
extensions/chat-bubble/assets/modules/state.js       # add new state keys
extensions/chat-bubble/assets/modules/ui-turn.js     # dispatch sizing_widget, compare_link, image_preview blocks
extensions/chat-bubble/assets/modules/ui-stream.js   # integrate auto-scroll-pause
extensions/chat-bubble/assets/modules/ui-composer.js # wire image attach to picker + image_preview emission
extensions/chat-bubble/assets/modules/api.js         # auto-retry once on transient errors
extensions/chat-bubble/assets/modules/conversation.js # appendImagePreview helper
extensions/chat-bubble/assets/chat.js                # mount proactive, resume card, error banners; subscribe to new state
extensions/chat-bubble/assets/chat.css               # append styles for all new blocks/states
extensions/chat-bubble/assets/test-surfaces.html     # add new surfaces
```

---

## Tasks

### Task 1: Sizing widget

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-sizing-widget.js`
- Create: `tests/extension/ui-sizing-widget.test.js`
- Modify: `extensions/chat-bubble/assets/chat.css`

Block shape from the SSE stream:

```js
{
  type: 'sizing_widget',
  flow_id: 'ring_sizer',
  title: 'Ring Size Finder',
  steps: [
    { id: 'width', question: 'What\'s the band width you\'re looking at?', options: [{value:'slim',label:'Slim (≤3mm)'}, ...], allow_freeform: false },
    ...
  ],
  fallback?: { label: 'Print a sizer', url: '/sizing/ring-printable.pdf' }
}
```

When the shopper completes a step, the widget compresses it to a one-line summary. When all steps are answered, the widget emits an `onComplete(answers)` callback so chat.js can send the resolved answers as a follow-up user message.

- [ ] **Step 1: Write failing tests for state transitions**

Create `tests/extension/ui-sizing-widget.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSizingWidget } from '../../extensions/chat-bubble/assets/modules/ui-sizing-widget.js';

const BLOCK = {
  type: 'sizing_widget',
  flow_id: 'ring',
  title: 'Ring Size Finder',
  steps: [
    { id: 'width', question: 'Width?', options: [{ value: 'slim', label: 'Slim' }, { value: 'std', label: 'Standard' }] },
    { id: 'size_in_brand', question: 'Size in another brand?', options: [{ value: '6', label: '6' }, { value: '7', label: '7' }] },
  ],
  fallback: { label: 'Print sizer', url: '/p.pdf' },
};

describe('sizing widget', () => {
  let onComplete;
  let widget;

  beforeEach(() => {
    document.body.innerHTML = '';
    onComplete = vi.fn();
    widget = createSizingWidget(BLOCK, { onComplete });
    document.body.appendChild(widget.node);
  });

  it('shows the first question initially', () => {
    expect(widget.node.textContent).toContain('Width?');
  });

  it('selecting an option in step 1 advances to step 2', () => {
    const slim = widget.node.querySelectorAll('.swa-sizing-chip')[0];
    slim.click();
    expect(widget.node.textContent).toContain('Size in another brand?');
  });

  it('completed steps show a one-line summary', () => {
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    expect(widget.node.querySelector('.swa-sizing-summary').textContent).toContain('Width');
  });

  it('calls onComplete with all answers after the last step', () => {
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ width: 'slim', size_in_brand: '6' });
  });

  it('shows fallback link', () => {
    const link = widget.node.querySelector('.swa-sizing-fallback a');
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Print sizer');
  });
});
```

- [ ] **Step 2: Append sizing widget CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Sizing widget
 * ============================================================ */
.swa-sizing {
  background: var(--swa-color-bg);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--swa-space-2);
}
.swa-sizing-title {
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-semibold);
  color: var(--swa-color-text-primary);
}
.swa-sizing-steps {
  display: flex;
  gap: var(--swa-space-1);
  margin: 0 0 var(--swa-space-2);
}
.swa-sizing-step-dot {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--swa-color-border);
}
.swa-sizing-step-dot[data-state="done"] { background: var(--swa-color-brand); }
.swa-sizing-step-dot[data-state="active"] { background: var(--swa-color-brand); opacity: 0.5; }

.swa-sizing-summary {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  padding: var(--swa-space-1) 0;
  border-bottom: 1px solid var(--swa-color-border);
}
.swa-sizing-summary strong { color: var(--swa-color-text-primary); font-weight: var(--swa-weight-medium); }

.swa-sizing-question {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-primary);
}
.swa-sizing-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--swa-space-2);
}
.swa-sizing-chip {
  padding: 8px 14px;
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-sm);
  background: var(--swa-color-bg);
  font: inherit;
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-primary);
  cursor: pointer;
}
.swa-sizing-chip:hover { background: var(--swa-color-bg-subtle); }
.swa-sizing-chip[data-selected="true"] {
  border-color: var(--swa-color-brand);
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
}

.swa-sizing-fallback {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  border-top: 1px solid var(--swa-color-border);
  padding-top: var(--swa-space-2);
}
.swa-sizing-fallback a {
  color: var(--swa-color-brand);
  text-decoration: underline;
}

.swa-sizing-complete {
  background: var(--swa-color-success-bg);
  color: var(--swa-color-success-fg);
  padding: var(--swa-space-2);
  border-radius: var(--swa-radius-sm);
  font-size: var(--swa-text-sm);
}
```

- [ ] **Step 3: Implement ui-sizing-widget.js**

Create `extensions/chat-bubble/assets/modules/ui-sizing-widget.js`:

```js
import { el } from './dom.js';

export function createSizingWidget(block, { onComplete } = {}) {
  const steps = block.steps || [];
  const answers = {};
  let currentIdx = 0;

  const node = el('div', { class: 'swa-sizing', role: 'region', 'aria-label': block.title || 'Size guide' });

  const title = el('div', { class: 'swa-sizing-title' }, block.title || 'Size guide');
  const stepsRow = el('div', { class: 'swa-sizing-steps' });
  for (let i = 0; i < steps.length; i++) stepsRow.appendChild(el('div', { class: 'swa-sizing-step-dot' }));

  const summariesWrap = el('div');
  const activeWrap = el('div');
  const fallbackWrap = el('div');

  if (block.fallback) {
    fallbackWrap.className = 'swa-sizing-fallback';
    fallbackWrap.append(
      "Don't know yours? ",
      el('a', { href: block.fallback.url, target: '_blank', rel: 'noopener' }, block.fallback.label || 'Print a sizer →'),
    );
  }

  node.append(title, stepsRow, summariesWrap, activeWrap, fallbackWrap);

  function renderActive() {
    activeWrap.innerHTML = '';
    if (currentIdx >= steps.length) {
      activeWrap.appendChild(el('div', { class: 'swa-sizing-complete' }, '✓ All set — finding your match…'));
      onComplete && onComplete(answers);
      return;
    }
    const step = steps[currentIdx];
    activeWrap.appendChild(el('div', { class: 'swa-sizing-question' }, step.question));
    const chipsRow = el('div', { class: 'swa-sizing-chips' });
    for (const opt of step.options || []) {
      const chip = el('button', { class: 'swa-sizing-chip', type: 'button' }, opt.label);
      chip.addEventListener('click', () => {
        answers[step.id] = opt.value;
        const label = step.label || step.id.charAt(0).toUpperCase() + step.id.slice(1);
        const summary = el('div', { class: 'swa-sizing-summary' },
          el('strong', null, label), ': ', opt.label
        );
        summariesWrap.appendChild(summary);
        stepsRow.children[currentIdx].dataset.state = 'done';
        currentIdx += 1;
        if (currentIdx < steps.length) stepsRow.children[currentIdx].dataset.state = 'active';
        renderActive();
      });
      chipsRow.appendChild(chip);
    }
    activeWrap.appendChild(chipsRow);
  }

  if (steps.length > 0) stepsRow.children[0].dataset.state = 'active';
  renderActive();

  return { node };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- ui-sizing-widget
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-sizing-widget.js tests/extension/ui-sizing-widget.test.js
git commit -m "feat(widget): build sizing widget multi-step block"
```

---

### Task 2: Comparison bottom sheet

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-compare-sheet.js`
- Modify: `extensions/chat-bubble/assets/chat.css`

Block shapes:

```js
// Inline mini (2 products) — already lands as a text bubble + product carousel
// Full sheet trigger (3+ products):
{ type: 'compare_link', items: [{title, image, attrs: {price, metal, ...}}], verdict?: string }
```

- [ ] **Step 1: Append compare sheet CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Compare sheet
 * ============================================================ */
.swa-compare-link {
  display: inline-flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-2) var(--swa-space-3);
  background: var(--swa-color-bg-subtle);
  border: 1px solid var(--swa-color-border);
  border-radius: var(--swa-radius-md);
  font-size: var(--swa-text-sm);
  cursor: pointer;
  align-self: flex-start;
}
.swa-compare-link:hover { background: var(--swa-color-bg-elevated); }

.swa-compare-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.35);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--swa-duration-base);
  z-index: var(--swa-z-modal);
}
.swa-compare-sheet-backdrop[data-visible="true"] {
  opacity: 1;
  pointer-events: auto;
}
.swa-compare-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 80%;
  background: var(--swa-color-bg);
  border-top-left-radius: var(--swa-radius-xl);
  border-top-right-radius: var(--swa-radius-xl);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform var(--swa-duration-slow) var(--swa-ease-emphasized);
  overflow: hidden;
}
.swa-compare-sheet[data-open="true"] { transform: translateY(0); }
.swa-compare-sheet-header {
  padding: var(--swa-space-3);
  border-bottom: 1px solid var(--swa-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.swa-compare-sheet-title {
  font-weight: var(--swa-weight-semibold);
  font-size: var(--swa-text-md);
}
.swa-compare-sheet-body {
  flex: 1;
  overflow: auto;
  padding: var(--swa-space-3);
}
.swa-compare-table {
  display: grid;
  gap: var(--swa-space-1);
  min-width: 100%;
}
.swa-compare-row {
  display: grid;
  grid-template-columns: 100px repeat(var(--cols, 3), 1fr);
  gap: var(--swa-space-2);
  font-size: var(--swa-text-sm);
  padding: var(--swa-space-1) 0;
  border-bottom: 1px solid var(--swa-color-border);
}
.swa-compare-row .label {
  position: sticky;
  left: 0;
  background: var(--swa-color-bg);
  color: var(--swa-color-text-tertiary);
}
.swa-compare-row.head {
  font-weight: var(--swa-weight-semibold);
  color: var(--swa-color-text-primary);
}
.swa-compare-row .thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--swa-color-bg-subtle);
  border-radius: var(--swa-radius-sm);
  object-fit: cover;
}
.swa-compare-verdict {
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
  padding: var(--swa-space-2) var(--swa-space-3);
  border-top: 1px solid var(--swa-color-border);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
}
```

- [ ] **Step 2: Implement ui-compare-sheet.js**

Create `extensions/chat-bubble/assets/modules/ui-compare-sheet.js`:

```js
import { el } from './dom.js';

export function createCompareLink(block, { onOpen } = {}) {
  const node = el('button', { class: 'swa-compare-link', type: 'button' },
    `Compare: ${(block.items || []).map(i => i.title).join(' · ')} ↗`);
  node.addEventListener('click', () => onOpen && onOpen(block));
  return node;
}

export function openCompareSheet(block, { container }) {
  const backdrop = el('div', { class: 'swa-compare-sheet-backdrop' });
  const sheet = el('div', { class: 'swa-compare-sheet', role: 'dialog', 'aria-label': 'Compare products' });

  const closeBtn = el('button', {
    class: 'swa-icon-button',
    type: 'button',
    'aria-label': 'Close compare',
  });
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  sheet.appendChild(el('div', { class: 'swa-compare-sheet-header' },
    el('div', { class: 'swa-compare-sheet-title' }, 'Compare'),
    closeBtn,
  ));

  const items = block.items || [];
  const attrKeys = [...new Set(items.flatMap(i => Object.keys(i.attrs || {})))];
  const body = el('div', { class: 'swa-compare-sheet-body' });
  const table = el('div', { class: 'swa-compare-table' });
  table.style.setProperty('--cols', String(items.length));

  // Head row with titles
  const head = el('div', { class: 'swa-compare-row head' }, el('div', { class: 'label' }, ''));
  for (const it of items) head.appendChild(el('div', null, it.title));
  table.appendChild(head);

  // Thumbnail row
  const thumbs = el('div', { class: 'swa-compare-row' }, el('div', { class: 'label' }, ''));
  for (const it of items) {
    const cell = el('div');
    if (it.image) cell.appendChild(el('img', { class: 'thumb', src: it.image, alt: it.title }));
    else cell.appendChild(el('div', { class: 'thumb' }));
    thumbs.appendChild(cell);
  }
  table.appendChild(thumbs);

  for (const key of attrKeys) {
    const row = el('div', { class: 'swa-compare-row' }, el('div', { class: 'label' }, key));
    for (const it of items) row.appendChild(el('div', null, (it.attrs || {})[key] ?? '—'));
    table.appendChild(row);
  }
  body.appendChild(table);
  sheet.appendChild(body);

  if (block.verdict) sheet.appendChild(el('div', { class: 'swa-compare-verdict' }, `→ ${block.verdict}`));

  function close() {
    sheet.dataset.open = 'false';
    backdrop.dataset.visible = 'false';
    setTimeout(() => { sheet.remove(); backdrop.remove(); }, 320);
  }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  container.append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.dataset.visible = 'true';
    sheet.dataset.open = 'true';
  });

  return { close };
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-compare-sheet.js
git commit -m "feat(widget): build compare sheet for 3+ products"
```

---

### Task 3: Auto-scroll pause + "↓ New messages" pill

**Files:**
- Create: `extensions/chat-bubble/assets/modules/auto-scroll.js`
- Modify: `extensions/chat-bubble/assets/modules/ui-stream.js`
- Modify: `extensions/chat-bubble/assets/chat.css`

- [ ] **Step 1: Append CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Auto-scroll pill
 * ============================================================ */
.swa-stream { position: relative; }
.swa-new-messages-pill {
  position: sticky;
  bottom: var(--swa-space-3);
  margin: 0 auto var(--swa-space-2);
  display: none;
  width: max-content;
  background: var(--swa-color-text-primary);
  color: var(--swa-color-bg);
  border: none;
  border-radius: var(--swa-radius-full);
  padding: 6px 14px;
  font-size: var(--swa-text-sm);
  cursor: pointer;
  box-shadow: var(--swa-shadow-md);
  z-index: 1;
}
.swa-new-messages-pill[data-visible="true"] { display: inline-flex; align-items: center; gap: 6px; }
```

- [ ] **Step 2: Create auto-scroll.js**

Create `extensions/chat-bubble/assets/modules/auto-scroll.js`:

```js
const THRESHOLD = 100;

/**
 * Manages auto-scroll behavior for the message stream.
 * Returns { setPaused, isPaused, scrollToBottom, onSuspended(fn) }.
 */
export function createAutoScroll(streamEl) {
  let userSuspended = false;
  const listeners = new Set();

  function isNearBottom() {
    return streamEl.scrollHeight - (streamEl.scrollTop + streamEl.clientHeight) < THRESHOLD;
  }

  function onScroll() {
    if (isNearBottom()) {
      if (userSuspended) {
        userSuspended = false;
        listeners.forEach(fn => fn(false));
      }
    } else if (!userSuspended) {
      userSuspended = true;
      listeners.forEach(fn => fn(true));
    }
  }
  streamEl.addEventListener('scroll', onScroll, { passive: true });

  return {
    scrollToBottom() {
      if (userSuspended) return false;
      streamEl.scrollTop = streamEl.scrollHeight;
      return true;
    },
    forceScrollToBottom() {
      userSuspended = false;
      listeners.forEach(fn => fn(false));
      streamEl.scrollTop = streamEl.scrollHeight;
    },
    isPaused() { return userSuspended; },
    onSuspended(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
```

- [ ] **Step 3: Update ui-stream.js to use auto-scroll**

Replace `extensions/chat-bubble/assets/modules/ui-stream.js`:

```js
import { el } from './dom.js';
import { createTurnNode } from './ui-turn.js';
import { createAutoScroll } from './auto-scroll.js';

export function createStream({ turnCtx = {} } = {}) {
  const welcomeSlot = el('div', { class: 'swa-stream-welcome-slot' });
  const turnsWrap = el('div', { class: 'swa-stream-turns' });
  const newMsgPill = el('button', {
    class: 'swa-new-messages-pill',
    type: 'button',
    dataset: { visible: 'false' },
  }, '↓ New messages');
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
  }, welcomeSlot, turnsWrap, newMsgPill);

  const auto = createAutoScroll(node);
  newMsgPill.addEventListener('click', () => {
    auto.forceScrollToBottom();
  });
  auto.onSuspended((paused) => {
    newMsgPill.dataset.visible = paused ? 'true' : 'false';
  });

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
      auto.scrollToBottom();
    }
    conv.subscribe(render);
    render();
  }

  return { node, setWelcome, bindConversation };
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/auto-scroll.js extensions/chat-bubble/assets/modules/ui-stream.js
git commit -m "feat(widget): add auto-scroll pause + new-messages pill"
```

---

### Task 4: Robustness states (returning user, mid-stream error, offline, rate-limited)

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-resume-card.js`
- Create: `extensions/chat-bubble/assets/modules/ui-error-banner.js`
- Modify: `extensions/chat-bubble/assets/modules/api.js` (auto-retry once)
- Modify: `extensions/chat-bubble/assets/modules/state.js` (add `isOnline`, `rateLimitedUntil`)
- Modify: `extensions/chat-bubble/assets/chat.css`

- [ ] **Step 1: Append CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Resume card / banners / offline bar
 * ============================================================ */
.swa-resume {
  background: color-mix(in srgb, var(--swa-color-brand) 6%, var(--swa-color-bg));
  border: 1px solid color-mix(in srgb, var(--swa-color-brand) 30%, var(--swa-color-border));
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
  margin-bottom: var(--swa-space-3);
}
.swa-resume-title {
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-semibold);
}
.swa-resume-sub {
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-secondary);
  margin: var(--swa-space-1) 0 var(--swa-space-2);
}
.swa-resume-actions { display: flex; gap: var(--swa-space-2); }
.swa-resume-actions > * { flex: 1; padding: var(--swa-space-2); border-radius: var(--swa-radius-sm); text-align: center; font-size: var(--swa-text-sm); border: none; cursor: pointer; }
.swa-resume-actions .primary { background: var(--swa-color-brand); color: var(--swa-color-brand-foreground); font-weight: var(--swa-weight-medium); }
.swa-resume-actions .ghost { background: transparent; color: var(--swa-color-text-primary); border: 1px solid var(--swa-color-border-strong); }

.swa-day-divider {
  text-align: center;
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-tertiary);
  padding: var(--swa-space-2) 0;
}
.swa-prior-turns { opacity: 0.55; }

.swa-error-banner {
  display: inline-flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-2) var(--swa-space-3);
  background: var(--swa-color-warning-bg);
  color: var(--swa-color-warning-fg);
  border-radius: var(--swa-radius-md);
  font-size: var(--swa-text-sm);
}
.swa-error-banner button {
  background: none;
  border: none;
  color: inherit;
  text-decoration: underline;
  font: inherit;
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
  margin-left: auto;
}

.swa-offline-bar {
  background: var(--swa-color-text-primary);
  color: var(--swa-color-bg);
  padding: var(--swa-space-1) var(--swa-space-3);
  font-size: var(--swa-text-xs);
  text-align: center;
  flex-shrink: 0;
}
.swa-offline-bar .dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--swa-color-warning-fg);
  margin-right: 6px;
}

.swa-ratelimit-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-1) var(--swa-space-3);
  background: var(--swa-color-bg-subtle);
  border-radius: var(--swa-radius-full);
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-secondary);
  margin: var(--swa-space-2) var(--swa-space-4);
}
```

- [ ] **Step 2: Add state keys**

Edit `extensions/chat-bubble/assets/modules/state.js`. Append to the `INITIAL_STATE` object:

Find:

```js
export const INITIAL_STATE = {
  isOpen: false,
  isMinimized: false,
  hasUnread: false,
  pendingMessagePreview: null,
  isOnline: true,
  shopName: '',
  brandColor: '#5046E4',
};
```

Replace with:

```js
export const INITIAL_STATE = {
  isOpen: false,
  isMinimized: false,
  hasUnread: false,
  pendingMessagePreview: null,
  isOnline: true,
  rateLimitedUntil: 0,
  shopName: '',
  brandColor: '#5046E4',
};
```

- [ ] **Step 3: Auto-retry once in api.js**

Edit `extensions/chat-bubble/assets/modules/api.js`. After the existing `streamChat` function, append a wrapper:

Find the export `streamChat`. After its definition, insert:

```js
/**
 * streamChatWithRetry — wraps streamChat with a single silent retry on
 * transient errors. The retry is invisible to the caller's onEvent stream,
 * but onError still fires if the retry also fails.
 */
export function streamChatWithRetry(payload, handlers) {
  let retried = false;
  let activeCtl = null;

  const proxy = {
    onEvent: handlers.onEvent || (() => {}),
    onError: (err) => {
      if (!retried && isTransient(err)) {
        retried = true;
        activeCtl = streamChat(payload, proxy);
        return;
      }
      (handlers.onError || (() => {}))(err);
    },
    onClose: handlers.onClose || (() => {}),
  };

  activeCtl = streamChat(payload, proxy);
  return { cancel: () => activeCtl && activeCtl.cancel() };
}

function isTransient(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  // Network errors and 5xx are transient.
  if (err.message && /failed: 5\d\d/.test(err.message)) return true;
  if (err.message && /failed to fetch|networkerror/i.test(err.message)) return true;
  return false;
}
```

- [ ] **Step 4: Implement ui-resume-card.js**

Create `extensions/chat-bubble/assets/modules/ui-resume-card.js`:

```js
import { el } from './dom.js';

/**
 * Returning-user resume card.
 * block: { type:'resume', summary: string, ageLabel: string }
 * handlers: { onContinue(), onStartFresh() }
 */
export function createResumeCard({ summary, ageLabel, onContinue, onStartFresh }) {
  const node = el('div', { class: 'swa-resume' });
  node.appendChild(el('div', { class: 'swa-resume-title' }, 'Pick up where you left off?'));
  node.appendChild(el('div', { class: 'swa-resume-sub' }, summary || `Last chat ${ageLabel || 'recently'}.`));
  const cont = el('button', { class: 'primary', type: 'button' }, 'Continue');
  const fresh = el('button', { class: 'ghost', type: 'button' }, 'Start fresh');
  cont.addEventListener('click', () => onContinue && onContinue());
  fresh.addEventListener('click', () => onStartFresh && onStartFresh());
  node.appendChild(el('div', { class: 'swa-resume-actions' }, cont, fresh));
  return node;
}

export function createDayDivider(label) {
  return el('div', { class: 'swa-day-divider' }, `— ${label} —`);
}
```

- [ ] **Step 5: Implement ui-error-banner.js**

Create `extensions/chat-bubble/assets/modules/ui-error-banner.js`:

```js
import { el } from './dom.js';

export function createErrorBanner({ message, retryLabel = 'Retry', onRetry }) {
  const node = el('div', { class: 'swa-error-banner', role: 'status' },
    el('span', { 'aria-hidden': 'true' }, '⚠'),
    el('span', null, message),
  );
  if (onRetry) {
    const btn = el('button', { type: 'button' }, retryLabel);
    btn.addEventListener('click', () => onRetry());
    node.appendChild(btn);
  }
  return node;
}

export function createOfflineBar() {
  const node = el('div', { class: 'swa-offline-bar' },
    el('span', { class: 'dot' }), "You're offline — read-only mode");
  return node;
}

export function createRateLimitPill(secondsRemaining, onTick) {
  const node = el('div', { class: 'swa-ratelimit-pill', role: 'status' },
    `Catching my breath, try again in ${secondsRemaining}s…`);
  let remaining = secondsRemaining;
  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      node.remove();
      onTick && onTick(0);
      return;
    }
    node.textContent = `Catching my breath, try again in ${remaining}s…`;
    onTick && onTick(remaining);
  }, 1000);
  return { node, cancel: () => clearInterval(interval) };
}
```

- [ ] **Step 6: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/state.js extensions/chat-bubble/assets/modules/api.js extensions/chat-bubble/assets/modules/ui-resume-card.js extensions/chat-bubble/assets/modules/ui-error-banner.js
git commit -m "feat(widget): add resume card, error banner, offline bar, rate-limit pill; add api auto-retry"
```

---

### Task 5: Image upload + image_preview block

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-image-preview.js`
- Modify: `extensions/chat-bubble/assets/modules/ui-composer.js`
- Modify: `extensions/chat-bubble/assets/chat.css`

- [ ] **Step 1: Append image styles**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Image preview
 * ============================================================ */
.swa-image-preview {
  max-width: 240px;
  border-radius: var(--swa-radius-md);
  overflow: hidden;
  border: 1px solid var(--swa-color-border);
  align-self: flex-end;
}
.swa-image-preview img {
  width: 100%;
  height: auto;
  display: block;
}
.swa-composer-attach[data-pending="true"] {
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
}
.swa-composer-pending-image {
  display: flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-1) var(--swa-space-2);
  background: var(--swa-color-bg-subtle);
  border-radius: var(--swa-radius-sm);
  font-size: var(--swa-text-xs);
  color: var(--swa-color-text-secondary);
  margin: 0 var(--swa-space-4) var(--swa-space-2);
}
.swa-composer-pending-image img {
  width: 32px;
  height: 32px;
  border-radius: var(--swa-radius-sm);
  object-fit: cover;
}
.swa-composer-pending-image button {
  background: none;
  border: none;
  color: var(--swa-color-text-tertiary);
  cursor: pointer;
  padding: 0;
  margin-left: auto;
}
```

- [ ] **Step 2: Create ui-image-preview.js**

Create `extensions/chat-bubble/assets/modules/ui-image-preview.js`:

```js
import { el } from './dom.js';

/**
 * block: { type:'image_preview', dataUrl, alt? }
 */
export function createImagePreview(block) {
  return el('div', { class: 'swa-image-preview' },
    el('img', { src: block.dataUrl, alt: block.alt || 'Uploaded image', loading: 'lazy' })
  );
}
```

- [ ] **Step 3: Extend ui-composer.js with file picker**

Edit `extensions/chat-bubble/assets/modules/ui-composer.js`. Replace `createComposer` to add image-attach handling:

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

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

  let pendingImage = null; // { dataUrl, name }

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
```

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-image-preview.js extensions/chat-bubble/assets/modules/ui-composer.js
git commit -m "feat(widget): add image upload + image_preview block"
```

(Composer test file gets updated in Task 9.)

---

### Task 6: Proactive trigger engine

**Files:**
- Create: `extensions/chat-bubble/assets/modules/proactive.js`

The engine detects shopper signals and emits trigger events. Signals: PDP dwell (>30s no scroll past midpoint), deep scroll on PDP (>75%), multi-PDP (≥3 in 3 min), cart hesitation (cart non-empty, 2min idle), exit intent (mouseout to URL bar / tab hidden), OOS variant toggle. Honors frequency policy.

- [ ] **Step 1: Create proactive.js**

Create `extensions/chat-bubble/assets/modules/proactive.js`:

```js
const FREQ_KEY = 'swa-proactive-history';
const COOLDOWN_MS = 5 * 60 * 1000;     // 5 min between any two triggers
const SESSION_CAP = 2;                  // max per session
const DISMISS_SUPPRESS_MS = 24 * 60 * 60 * 1000; // 24h on same URL

function history() {
  try {
    return JSON.parse(sessionStorage.getItem(FREQ_KEY) || '{"fires":[],"dismissed":{}}');
  } catch {
    return { fires: [], dismissed: {} };
  }
}
function saveHistory(h) {
  try { sessionStorage.setItem(FREQ_KEY, JSON.stringify(h)); } catch {}
}

function isPdp() { return /^\/products\//.test(location.pathname); }

/**
 * createProactive — wire shopper-signal observers; fires onTrigger({ id, copy, urgent })
 * when policy allows.
 *
 * Trigger IDs: 'pdp_dwell', 'pdp_deep_scroll', 'multi_pdp', 'cart_hesitation', 'exit_intent', 'oos_variant'
 */
export function createProactive({ onTrigger, isOpen }) {
  function canFire(id) {
    if (isOpen()) return false;
    const h = history();
    const now = Date.now();

    // Exit intent ignores caps but still gates on per-page dismissal.
    if (id !== 'exit_intent') {
      // Session cap
      if (h.fires.length >= SESSION_CAP) return false;
      // Global cooldown
      const last = h.fires[h.fires.length - 1] || 0;
      if (now - last < COOLDOWN_MS) return false;
    }

    // Per-URL dismissal
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

  // ---------- PDP dwell + deep scroll ----------
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

  // ---------- Multi-PDP ----------
  const visits = JSON.parse(sessionStorage.getItem('swa-pdp-visits') || '[]')
    .filter(t => Date.now() - t < 3 * 60_000);
  if (isPdp()) {
    visits.push(Date.now());
    sessionStorage.setItem('swa-pdp-visits', JSON.stringify(visits));
    if (visits.length >= 3) {
      setTimeout(() => fire('multi_pdp', "I see you're comparing — want me to lay out the differences?"), 1500);
    }
  }

  // ---------- Cart hesitation ----------
  if (location.pathname.startsWith('/cart')) {
    const cartIdle = setTimeout(() => {
      fire('cart_hesitation', 'Anything making you hesitate? Our return policy is flexible.');
    }, 2 * 60_000);
    window.addEventListener('beforeunload', () => clearTimeout(cartIdle));
  }

  // ---------- Exit intent (desktop) ----------
  let exitFired = false;
  document.addEventListener('mouseout', (e) => {
    if (exitFired) return;
    if (e.clientY < 5 && !e.relatedTarget) {
      exitFired = true;
      fire('exit_intent', 'Before you go — save this for later or get a quick answer?', { urgent: true });
    }
  });

  // ---------- OOS variant (best-effort scrape) ----------
  // Watches for Shopify's "sold out" indicator on PDP.
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
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/modules/proactive.js
git commit -m "feat(widget): add proactive trigger engine with frequency policy"
```

---

### Task 7: Wire it all in chat.js + ui-turn dispatch

**Files:**
- Modify: `extensions/chat-bubble/assets/chat.js`
- Modify: `extensions/chat-bubble/assets/modules/ui-turn.js`

Add dispatch for `sizing_widget`, `compare_link`, `image_preview` blocks. Mount proactive engine. Hook offline/online + rate-limit handling. Update composer→sendMessage to handle image attachments.

- [ ] **Step 1: Update ui-turn.js dispatch**

Edit `extensions/chat-bubble/assets/modules/ui-turn.js`. Inside `renderBlock`, add three new cases before the trailing unknown-block return:

```js
  if (block.type === 'sizing_widget') {
    const slot = el('div');
    import('./ui-sizing-widget.js').then(({ createSizingWidget }) =>
      slot.replaceWith(createSizingWidget(block, { onComplete: ctx.onSizingComplete }).node)
    );
    return slot;
  }
  if (block.type === 'compare_link') {
    const slot = el('div');
    import('./ui-compare-sheet.js').then(({ createCompareLink }) =>
      slot.replaceWith(createCompareLink(block, { onOpen: ctx.onCompareOpen }))
    );
    return slot;
  }
  if (block.type === 'image_preview') {
    const slot = el('div');
    import('./ui-image-preview.js').then(({ createImagePreview }) =>
      slot.replaceWith(createImagePreview(block))
    );
    return slot;
  }
```

- [ ] **Step 2: Update chat.js**

Replace `extensions/chat-bubble/assets/chat.js`:

```js
import { el, qs } from './modules/dom.js';
import { createState, INITIAL_STATE } from './modules/state.js';
import { createLauncher } from './modules/ui-launcher.js';
import { createWindow } from './modules/ui-window.js';
import { createHeader } from './modules/ui-header.js';
import { createComposer } from './modules/ui-composer.js';
import { createStream } from './modules/ui-stream.js';
import { createQuickReplies } from './modules/ui-quick-replies.js';
import { createConversation } from './modules/conversation.js';
import { createWelcomePanel } from './modules/ui-welcome.js';
import { streamChatWithRetry, fetchWelcome } from './modules/api.js';
import { createProactive } from './modules/proactive.js';
import { createResumeCard, createDayDivider } from './modules/ui-resume-card.js';
import { createErrorBanner, createOfflineBar, createRateLimitPill } from './modules/ui-error-banner.js';
import { openCompareSheet } from './modules/ui-compare-sheet.js';

function buildFooter(shopName) {
  return el('div', { class: 'swa-footer' },
    `Powered by ${shopName || 'Shop'} AI · `,
    el('a', { href: '#', target: '_blank', rel: 'noopener' }, 'Privacy')
  );
}

function detectPageType() {
  const path = window.location.pathname;
  if (/^\/products\//.test(path)) return 'pdp';
  if (/^\/collections\//.test(path)) return 'collection';
  if (/^\/cart/.test(path)) return 'cart';
  if (/^\/search/.test(path)) return 'search';
  if (path === '/' || path === '') return 'home';
  if (/^\/blogs\//.test(path)) return 'blog';
  return 'unknown';
}
function detectPageContext() {
  const ctx = {};
  const titleEl = document.querySelector('h1.product__title, h1[itemprop="name"], .product-single__title, h1.product-title');
  if (titleEl) ctx.productTitle = titleEl.textContent.trim();
  return ctx;
}
function truncate(str, n) {
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

function init() {
  const root = qs('#shop-ai-chat-root');
  if (!root) return;

  const config = window.shopAIChatConfig || {};
  const state = createState({
    ...INITIAL_STATE,
    shopName: config.shopName || '',
    brandColor: config.brandColor || INITIAL_STATE.brandColor,
    isOnline: navigator.onLine,
  });
  if (config.brandColor) {
    root.style.setProperty('--swa-color-brand', config.brandColor);
  }

  const conversation = createConversation();
  let conversationId = null;
  let activeStream = null;
  let currentAssistantTurnId = null;
  let lastSendPayload = null;

  // ---------- UI ----------
  const launcherCtl = createLauncher({ state });
  const window_ = createWindow({ state, launcher: launcherCtl.node });
  const header = createHeader({ state });

  const stream = createStream({
    turnCtx: {
      onATCSuccess: (cart) => {
        if (currentAssistantTurnId) {
          conversation.appendBlock(currentAssistantTurnId, { type: 'cart_summary', cart });
        }
      },
      onSaveCartSubmit: ({ email, sms }) => {
        console.log('[swa] save cart', email, sms);
        return Promise.resolve();
      },
      onReorder: (orderBlock) => {
        sendMessage({ text: `Reorder #${orderBlock.orderNumber}` });
      },
      onSaveForLater: () => {
        if (currentAssistantTurnId) {
          conversation.appendBlock(currentAssistantTurnId, { type: 'save_cart_card' });
        }
      },
      onAuthSuccess: () => {
        if (lastSendPayload) sendMessage(lastSendPayload);
      },
      onSizingComplete: (answers) => {
        sendMessage({ text: 'My sizing: ' + Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(', ') });
      },
      onCompareOpen: (block) => {
        openCompareSheet(block, { container: window_.node });
      },
    },
  });

  const quickReplies = createQuickReplies({
    onSelect: (chip) => {
      sendMessage({ text: chip.label, intent: chip.intent });
      quickReplies.clear();
    },
  });
  const composer = createComposer({
    onSubmit: (payload) => sendMessage(payload),
    onAttachImage: () => {},
  });
  const footer = buildFooter(config.shopName);

  // Pending image preview lives between the dock and the composer.
  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.dockSlot.appendChild(quickReplies.node);
  window_.dockSlot.appendChild(composer.pendingImageNode);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  // Offline bar above header — inserted into the window directly.
  const offlineBar = createOfflineBar();
  offlineBar.style.display = 'none';
  window_.node.insertBefore(offlineBar, window_.node.firstChild);

  root.appendChild(launcherCtl.node);
  root.appendChild(launcherCtl.previewBubble);
  root.appendChild(window_.node);

  stream.bindConversation(conversation);

  // ---------- Online / offline ----------
  function syncOnline(online) {
    state.set('isOnline', online);
    offlineBar.style.display = online ? 'none' : 'block';
  }
  window.addEventListener('online', () => syncOnline(true));
  window.addEventListener('offline', () => syncOnline(false));
  syncOnline(navigator.onLine);

  // ---------- Welcome ----------
  let welcomeShown = false;
  state.subscribe('isOpen', (isOpen) => {
    root.dataset.state = isOpen ? 'open' : 'closed';
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
      resolved = { greeting: 'Hi — what brings you in?', context_line: null, primary_action: null, chips: [] };
    }
    const panel = createWelcomePanel({
      resolved,
      onPrimaryAction: (flowId, label) => { sendMessage({ text: label, flow: flowId }); stream.setWelcome(null); },
      onChip: (intent, label) => { sendMessage({ text: label, intent }); stream.setWelcome(null); },
    });
    stream.setWelcome(panel);
  }

  // ---------- Send ----------
  function sendMessage(payload) {
    if (state.get('rateLimitedUntil') > Date.now()) return;
    lastSendPayload = payload;
    stream.setWelcome(null);

    // If image is attached, emit an image_preview block on the user turn first.
    if (payload.image) {
      conversation.appendUserMessage(payload.text || '(image)');
      // Replace the user turn's last block with image preview alongside text.
      const turns = conversation.getTurns();
      const userTurn = turns[turns.length - 1];
      conversation.appendBlock(userTurn.id, { type: 'image_preview', dataUrl: payload.image.dataUrl, alt: payload.image.name });
    } else {
      conversation.appendUserMessage(payload.text || '');
    }

    const assistantTurn = conversation.appendAssistantTurn();
    currentAssistantTurnId = assistantTurn.id;
    if (activeStream) activeStream.cancel();

    activeStream = streamChatWithRetry(
      {
        message: payload.text || '',
        conversation_id: conversationId,
        prompt_type: config.promptType,
        page_context: { page_type: detectPageType(), ...detectPageContext(), ...(payload.intent && { intent: payload.intent }), ...(payload.flow && { flow: payload.flow }) },
        ...(payload.image && { image: payload.image.dataUrl }),
      },
      {
        onEvent: handleEvent,
        onError: (err) => {
          if (err && err.status === 429) {
            handleRateLimit();
            return;
          }
          const banner = createErrorBanner({
            message: 'Connection dropped. Response incomplete.',
            onRetry: () => { banner.remove(); sendMessage(payload); },
          });
          conversation.appendBlock(currentAssistantTurnId, { type: 'text', content: ' ' });
          // Append banner directly after the partial assistant turn:
          const turnEl = stream.node.querySelector(`.swa-turn:last-of-type .swa-turn-blocks`);
          if (turnEl) turnEl.appendChild(banner);
        },
        onClose: () => { activeStream = null; },
      }
    );
  }

  function handleRateLimit() {
    const until = Date.now() + 5000;
    state.set('rateLimitedUntil', until);
    const dock = window_.dockSlot;
    const { node: pillNode } = createRateLimitPill(5, (remaining) => {
      if (remaining === 0) state.set('rateLimitedUntil', 0);
    });
    dock.appendChild(pillNode);
  }

  function handleEvent(ev) {
    if (!currentAssistantTurnId) return;
    if (ev.type === 'id') { conversationId = ev.conversation_id; return; }
    if (ev.type === 'chunk' && typeof ev.chunk === 'string') {
      conversation.appendTextChunk(currentAssistantTurnId, ev.chunk);
      return;
    }
    if (ev.type === 'tool_use') {
      const m = /Calling tool:\s+(\w+)\s+with arguments:\s+(.+)/.exec(ev.tool_use_message || '');
      const label = m ? `Calling ${m[1]}` : 'Searching';
      const params = m ? truncate(m[2], 80) : '';
      conversation.appendBlock(currentAssistantTurnId, { type: 'tool_use', label, params });
      return;
    }
    if (ev.type === 'message_complete') return;
    if (ev.type === 'error' && ev.error) {
      conversation.appendBlock(currentAssistantTurnId, { type: 'text', content: `_Error: ${ev.error}_` });
    }
  }

  // ---------- Proactive ----------
  const proactive = createProactive({
    isOpen: () => state.get('isOpen'),
    onTrigger: ({ id, copy }) => {
      // Reuse the launcher's existing preview-bubble mechanism by setting the state.
      state.set('pendingMessagePreview', copy);
      state.set('hasUnread', true);
    },
  });

  // Dismissing the preview bubble counts as a per-page dismissal.
  launcherCtl.previewBubble.addEventListener('click', (e) => {
    if (e.target.matches('[data-dismiss]')) {
      proactive.markDismissed();
      state.set('pendingMessagePreview', null);
      state.set('hasUnread', false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all previous tests still pass plus new sizing-widget tests = ~58 tests.

- [ ] **Step 4: Commit**

```bash
git add extensions/chat-bubble/assets/modules/ui-turn.js extensions/chat-bubble/assets/chat.js
git commit -m "feat(widget): wire sizing/compare/image dispatch + proactive engine + edge states"
```

---

### Task 8: A11y helpers

**Files:**
- Create: `extensions/chat-bubble/assets/modules/a11y.js`
- Modify: `extensions/chat-bubble/assets/modules/ui-window.js`

- [ ] **Step 1: Create a11y.js**

Create `extensions/chat-bubble/assets/modules/a11y.js`:

```js
/**
 * a11y — small helpers for focus management and aria announcements.
 */

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function trapFocus(container) {
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SEL)).filter(el => !el.hidden);
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
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

let liveRegion;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    document.body.appendChild(liveRegion);
  }
  // Empty then set to force re-announcement.
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 50);
}
```

- [ ] **Step 2: Use trapFocus in ui-window.js**

Edit `extensions/chat-bubble/assets/modules/ui-window.js`. Add the import and trap focus when the window is open. Find:

```js
import { el, qs } from './dom.js';
```

Replace with:

```js
import { el, qs } from './dom.js';
import { trapFocus } from './a11y.js';
```

Then inside `createWindow`, after the `node` declaration, add:

```js
  let releaseTrap = null;
```

And inside the `state.subscribe('isOpen', ...)` callback, in the `if (isOpen)` branch after the `requestAnimationFrame`, add:

```js
      releaseTrap = trapFocus(node);
```

And in the `else` branch, add:

```js
      if (releaseTrap) { releaseTrap(); releaseTrap = null; }
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/modules/a11y.js extensions/chat-bubble/assets/modules/ui-window.js
git commit -m "feat(widget): add focus trap + aria live region"
```

---

### Task 9: Update test-surfaces with the new blocks

**Files:**
- Modify: `extensions/chat-bubble/assets/test-surfaces.html`

Append new sections for sizing widget, compare sheet button (opens an overlay), image preview bubble, resume card, error banner, offline bar.

- [ ] **Step 1: Edit test-surfaces.html — append sections**

In `extensions/chat-bubble/assets/test-surfaces.html`, just before the closing `</body>` tag, insert these new sections (above the existing script block):

Find:

```html
  <h2>Composer</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="composer-stage" style="width:420px;"></div>
  </div>

  <script type="module">
```

Replace with:

```html
  <h2>Sizing widget</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="sizing-stage" style="width:380px;"></div>
  </div>

  <h2>Compare link (opens sheet)</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="compare-stage" style="width:380px;height:120px;position:relative;"></div>
  </div>

  <h2>Image preview bubble</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="image-stage" style="width:380px;display:flex;flex-direction:column;align-items:flex-end;"></div>
  </div>

  <h2>Returning-user resume</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="resume-stage" style="width:380px;"></div>
  </div>

  <h2>Error banner</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="error-stage" style="width:380px;"></div>
  </div>

  <h2>Offline bar</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;padding:0;">
    <div id="offline-stage" style="width:420px;"></div>
  </div>

  <h2>Composer</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="composer-stage" style="width:420px;"></div>
  </div>

  <script type="module">
```

Then add imports to the existing `<script type="module">` block (at the top of imports):

Find:

```html
    import { createAuthPrompt } from './modules/ui-auth-prompt.js';
```

Replace with:

```html
    import { createAuthPrompt } from './modules/ui-auth-prompt.js';
    import { createSizingWidget } from './modules/ui-sizing-widget.js';
    import { createCompareLink, openCompareSheet } from './modules/ui-compare-sheet.js';
    import { createImagePreview } from './modules/ui-image-preview.js';
    import { createResumeCard } from './modules/ui-resume-card.js';
    import { createErrorBanner, createOfflineBar } from './modules/ui-error-banner.js';
```

Then before the closing `</script>` of that block, append:

```js
    // Sizing
    document.getElementById('sizing-stage').appendChild(createSizingWidget({
      title: 'Ring Size Finder',
      steps: [
        { id: 'width', label: 'Width', question: "What's the band width you're looking at?", options: [
          { value: 'slim', label: 'Slim (≤3mm)' }, { value: 'std', label: 'Standard (4–5mm)' }, { value: 'wide', label: 'Wide (6mm+)' }, { value: 'unknown', label: 'Not sure' },
        ]},
        { id: 'brand_size', label: 'Brand size', question: "What's your size in another brand?", options: [
          { value: '5', label: '5' }, { value: '6', label: '6' }, { value: '7', label: '7' }, { value: '8', label: '8' },
        ]},
      ],
      fallback: { label: 'Print a sizer →', url: '#' },
    }, { onComplete: (a) => alert(JSON.stringify(a)) }).node);

    // Compare
    const compareBlock = {
      verdict: 'Halo balances daily wear & sparkle; pick Solitaire if budget matters most.',
      items: [
        { title: 'Halo', image: 'https://picsum.photos/seed/halo/200/200', attrs: { Price: '$2,499', Metal: '14k', Resize: 'Yes', Setting: 'Halo' } },
        { title: '3-Stone', image: 'https://picsum.photos/seed/3st/200/200', attrs: { Price: '$3,200', Metal: '18k', Resize: 'Limited', Setting: '3-stone' } },
        { title: 'Solitaire', image: 'https://picsum.photos/seed/sol/200/200', attrs: { Price: '$1,890', Metal: '14k', Resize: 'Yes', Setting: 'Prong' } },
      ],
    };
    const cstage = document.getElementById('compare-stage');
    cstage.appendChild(createCompareLink(compareBlock, { onOpen: (b) => openCompareSheet(b, { container: cstage }) }));

    // Image preview
    document.getElementById('image-stage').appendChild(createImagePreview({
      dataUrl: 'https://picsum.photos/seed/imgupload/300/300',
      alt: 'Uploaded inspiration photo',
    }));

    // Resume
    document.getElementById('resume-stage').appendChild(createResumeCard({
      summary: 'You were comparing the Halo and 3-Stone.',
      ageLabel: '2 days ago',
      onContinue: () => alert('continue'),
      onStartFresh: () => alert('fresh'),
    }));

    // Error banner
    document.getElementById('error-stage').appendChild(createErrorBanner({
      message: 'Connection dropped. Response incomplete.',
      onRetry: () => alert('retry'),
    }));

    // Offline bar
    document.getElementById('offline-stage').appendChild(createOfflineBar());
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/test-surfaces.html
git commit -m "build(widget): add sizing, compare, image, resume, error, offline surfaces to test page"
```

---

### Task 10: Verify + finalize

- [ ] **Step 1: Run full test suite**

```bash
cd /Applications/pe/shop-chat-agent && npm test
```

Expected: all tests pass (~58 — Plans 1+2+3's 53 + Plan 4's sizing-widget 5).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: only the 4 pre-existing errors in `app/routes/*`. If new errors appear, fix them (most likely candidates: empty catch blocks, no-empty, no-prototype-builtins).

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Final commit**

If lint or typecheck required fixes, commit them. Otherwise skip.

```bash
git add -A
git commit -m "chore(widget): finalize plan 4 advanced blocks + edge states"
```

---

## Self-Review

**1. Spec coverage:**

- §9.5 Sizing widget — Task 1 ✓
- §9.6 Comparison sheet (3+ products) — Task 2 ✓
- §9.7 Image preview block — Task 5 ✓
- §9.7 Vision result block — falls back to assistant text + product carousel already rendered by Plans 2 & 3 (no new block needed; the spec calls it a *composition* of text + carousel, both already implemented)
- §9.8 Auto-scroll pause + new-messages pill — Task 3 ✓
- §12.2 Mid-stream error + auto-retry — Task 4 (banner) + api.js wrapper ✓
- §12.3 Offline state — Task 4 + chat.js syncOnline ✓
- §12.4 Post-handoff card — **out of scope** (depends on backend handoff flow that does not yet exist; deferred to a future plan once handoff routing lands)
- §12.6 Compare sheet — Task 2 ✓
- §12.7 Rate-limited — Task 4 (createRateLimitPill) + handleRateLimit in chat.js ✓
- §14 Accessibility — Task 8 (focus trap + aria live region); existing landmarks/roles already in place from Plans 1–3

**2. Placeholder scan:** No TBDs. Deferrals (post-handoff card) called out explicitly.

**3. Type consistency:**

- `createSizingWidget(block, {onComplete})` returns `{node}` — consumed by ui-turn dispatch ✓
- `createCompareLink(block, {onOpen})` returns DOM node; `openCompareSheet(block, {container})` returns `{close}` — consumed by ui-turn + chat.js ✓
- `createImagePreview(block)` returns DOM node — consumed by ui-turn ✓
- `createResumeCard({summary, ageLabel, onContinue, onStartFresh})` returns DOM node ✓
- `createErrorBanner({message, retryLabel, onRetry})` / `createOfflineBar()` / `createRateLimitPill(seconds, onTick)` — used in chat.js ✓
- `createProactive({onTrigger, isOpen})` returns `{markDismissed, cancel}` — wired in chat.js ✓
- `streamChatWithRetry(payload, handlers)` returns `{cancel}` — replaces direct `streamChat` calls in chat.js ✓
- New state keys (`rateLimitedUntil`) added to INITIAL_STATE and read in `sendMessage` ✓

No issues.

---

## What's NOT in this plan

| Item | Status |
|---|---|
| Post-handoff card | Deferred — needs backend handoff routing |
| Express checkout (Shop Pay / Apple Pay) | Deferred to v1.1 (carried forward from Plan 3) |
| Voice input | Out of scope (spec §15 non-goals) |
| Multi-language menu UI | Out of scope (F10 / Phase 2) |
| Save-cart email sending backend | Out of scope (product/backend work) |
| Reorder backend mutation | Out of scope (backend work) |
| Vision API integration for uploaded images | Out of scope (F6 — Phase 2 backend work) |
