# Chat Widget UI — Plan 2: Conversation Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat actually work. After Plan 2 ships, a shopper can open the widget, see a context-aware welcome panel, ask a question, see streamed assistant responses with transparent tool-use indicators, and tap quick-reply chips for follow-ups.

**Architecture:** The existing SSE `/chat` endpoint (returning `id` / `chunk` / `message_complete` / `tool_use` events) is consumed by a new `api.js` module. A new server-side `welcome.server.js` resolves `(page_type, pack_id, page_context)` → a welcome bundle and is exposed at `/welcome`. The client gets a conversation store, a turn renderer (text block only — product cards land in Plan 3), a tool-use shimmer pill, a sticky quick-reply dock, and the welcome panel. Markdown is rendered with `marked` and sanitized with `DOMPurify`.

**Tech Stack:** Same as Plan 1, plus: `marked` (markdown parser) and `dompurify` (HTML sanitizer) on the client.

**Spec reference:** [docs/superpowers/specs/2026-05-19-chat-widget-ui-design.md](../specs/2026-05-19-chat-widget-ui-design.md) — sections §8 (Welcome panel) and §9 (Conversation surfaces). The block inventory in §9.2 lists 17 block types; this plan ships `text`, `tool_use`, `quick_replies`, and the welcome panel's hero CTA + chips. The remaining 13 block types land in Plans 3–4 as their domains arrive.

---

## File Structure

**New files (extension):**

```
extensions/chat-bubble/assets/modules/
  api.js                  # SSE consumption + welcome fetch
  markdown.js             # sanitized markdown → HTML
  conversation.js         # turn list + subscribers; append/update primitives
  ui-turn.js              # render a single turn (text block in this plan)
  ui-tool-use.js          # shimmer pill component
  ui-quick-replies.js     # sticky dock above composer
  ui-welcome.js           # welcome panel renderer
```

**New files (backend):**

```
app/services/
  welcome.server.js       # resolveWelcome(...)
  welcome-resolver.test.js  # unit tests (under app/services/)  — runs via vitest
app/routes/
  welcome.jsx             # GET /welcome — returns ResolvedWelcome JSON
```

**Modified files:**

```
extensions/chat-bubble/assets/chat.js       # wire api → stream → conversation → ui
extensions/chat-bubble/assets/modules/ui-stream.js  # replace stub with real turn list
extensions/chat-bubble/assets/chat.css      # append bubble, tool-use pill, chips, welcome panel styles
extensions/chat-bubble/assets/test-surfaces.html    # add new surfaces
package.json                                # add marked + dompurify
vitest.config.js                            # include app/services tests
```

---

## Module responsibilities

| Module | Responsibility |
|---|---|
| `api.js` | `streamChat({message, conversationId, promptType, onEvent})` returns a `cancel()` function. `fetchWelcome({pageType, pageContext, hasPriorConvo})` returns a Promise resolving to a ResolvedWelcome. |
| `markdown.js` | `renderMarkdown(src)` → safe HTML string. Allowlist: bold, italic, lists, links, code, paragraphs. Disallowed: h1/h2/h3, images. |
| `conversation.js` | Subscribable list of turns. `appendTurn(turn)`, `appendBlockToTurn(turnId, block)`, `appendTextChunk(turnId, blockIndex, chunk)`, `subscribe(fn)`. |
| `ui-turn.js` | Given a turn object, builds DOM. Handles incremental text updates by mutating the existing block node. |
| `ui-tool-use.js` | Slim shimmer pill with `Searching` + params in monospace. |
| `ui-quick-replies.js` | Sticky dock — renders chip list, fires `onSelect(chip)`. |
| `ui-welcome.js` | Welcome panel — hero greeting + (primary CTA card OR conversational fallback) + chips. |
| `welcome.server.js` | Server-side resolver — maps `(page_type, pack_id, page_context)` → welcome bundle. |

---

## Tasks

### Task 1: Add markdown + sanitizer dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install marked and dompurify**

```bash
cd /Applications/pe/shop-chat-agent && npm install marked@^14 dompurify@^3
```

Expected: lockfile updates; both packages added to `dependencies`.

- [ ] **Step 2: Run lint and tests to confirm nothing broke**

```bash
npm test && npm run lint
```

Expected: tests still pass (19); lint shows only the 4 pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add marked + dompurify for safe markdown rendering"
```

---

### Task 2: Build the markdown module

**Files:**
- Create: `extensions/chat-bubble/assets/modules/markdown.js`
- Create: `tests/extension/markdown.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/extension/markdown.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../extensions/chat-bubble/assets/modules/markdown.js';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const html = renderMarkdown('**hi**');
    expect(html).toContain('<strong>hi</strong>');
  });

  it('renders unordered lists', () => {
    const html = renderMarkdown('- one\n- two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders links', () => {
    const html = renderMarkdown('[shop](https://example.com)');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
  });

  it('strips script tags', () => {
    const html = renderMarkdown('hi<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips h1/h2/h3 headings (downgrades to bold paragraph)', () => {
    const html = renderMarkdown('# big');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('<h3');
  });

  it('strips markdown images', () => {
    const html = renderMarkdown('![alt](http://x.png)');
    expect(html).not.toContain('<img');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('').trim()).toBe('');
    expect(renderMarkdown(null).trim()).toBe('');
    expect(renderMarkdown(undefined).trim()).toBe('');
  });

  it('preserves inline code', () => {
    const html = renderMarkdown('Use `npm test`.');
    expect(html).toContain('<code>npm test</code>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- markdown
```

Expected: 8 FAIL with `Cannot find module`.

- [ ] **Step 3: Implement renderMarkdown**

Create `extensions/chat-bubble/assets/modules/markdown.js`:

```js
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked to be terse and not break on missing structure.
marked.setOptions({
  breaks: true,    // GitHub-style: \n → <br>
  gfm: true,
});

// Allowlist of HTML tags shoppers can safely see in messages.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function renderMarkdown(src) {
  if (src == null) return '';
  const str = typeof src === 'string' ? src : String(src);

  // Strip h1/h2/h3 markdown syntax before parsing (spec: no headers in messages).
  const noHeaders = str.replace(/^#{1,3}\s+/gm, '**') + (str.match(/^#{1,3}\s+/m) ? '**' : '');

  // Strip markdown image syntax: ![alt](url) → nothing
  const noImages = noHeaders.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  const rawHtml = marked.parse(noImages, { async: false });

  const safe = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['style', 'script', 'iframe', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  });

  // Force every link to open in a new tab safely.
  return safe.replace(/<a\b([^>]*)>/g, (m, attrs) => {
    const hasTarget = /target\s*=/.test(attrs);
    const hasRel = /rel\s*=/.test(attrs);
    const extra = (hasTarget ? '' : ' target="_blank"') + (hasRel ? '' : ' rel="noopener nofollow"');
    return `<a${attrs}${extra}>`;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- markdown
```

Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/modules/markdown.js tests/extension/markdown.test.js
git commit -m "feat(widget): add safe markdown renderer module"
```

---

### Task 3: Build the api module (SSE streaming)

**Files:**
- Create: `extensions/chat-bubble/assets/modules/api.js`

The api module wraps the existing `/chat` SSE endpoint. It exposes `streamChat(payload, onEvent)` which calls `onEvent` for each JSON event the server emits, and returns a `cancel()` function.

- [ ] **Step 1: Implement api.js**

Create `extensions/chat-bubble/assets/modules/api.js`:

```js
/**
 * api — single source of truth for backend calls.
 */

const CHAT_URL = '/chat';
const WELCOME_URL = '/welcome';

/**
 * streamChat — opens an SSE connection to /chat.
 *
 * @param {object} payload   { message, conversation_id?, prompt_type?, page_context? }
 * @param {object} handlers  { onEvent(eventObj), onError(err), onClose() }
 * @returns {{ cancel(): void }}
 */
export function streamChat(payload, handlers) {
  const controller = new AbortController();
  const onEvent = handlers.onEvent || (() => {});
  const onError = handlers.onError || (() => {});
  const onClose = handlers.onClose || (() => {});

  (async () => {
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        onError(new Error(`Chat request failed: ${res.status}`));
        onClose();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by blank lines; each event has "data: {json}\n"
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = raw.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            onEvent(JSON.parse(json));
          } catch (e) {
            // Tolerate malformed lines; never crash the stream.
            console.warn('[swa] malformed SSE chunk:', json);
          }
        }
      }
      onClose();
    } catch (err) {
      if (err.name !== 'AbortError') onError(err);
      onClose();
    }
  })();

  return { cancel: () => controller.abort() };
}

/**
 * fetchWelcome — requests the welcome bundle.
 */
export async function fetchWelcome({ pageType, pageContext, hasPriorConvo } = {}) {
  const params = new URLSearchParams({
    page_type: pageType || 'unknown',
    has_prior_convo: hasPriorConvo ? '1' : '0',
  });
  if (pageContext) params.set('page_context', JSON.stringify(pageContext));

  const res = await fetch(`${WELCOME_URL}?${params}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Welcome request failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/modules/api.js
git commit -m "feat(widget): add api module (SSE streamChat + fetchWelcome)"
```

(No unit tests in this task — api.js is integration-shaped; manual end-to-end check after Task 11 covers it.)

---

### Task 4: Build the conversation store

**Files:**
- Create: `extensions/chat-bubble/assets/modules/conversation.js`
- Create: `tests/extension/conversation.test.js`

The conversation store is an in-memory list of turns. A turn has `{ id, role: 'user'|'assistant', blocks: Block[] }`. A block has `{ type: 'text'|'tool_use'|..., ... }`. Subscribers get notified after each mutation.

- [ ] **Step 1: Write failing tests**

Create `tests/extension/conversation.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createConversation } from '../../extensions/chat-bubble/assets/modules/conversation.js';

describe('createConversation', () => {
  it('starts with an empty turn list', () => {
    const c = createConversation();
    expect(c.getTurns()).toEqual([]);
  });

  it('appends user turn with text block', () => {
    const c = createConversation();
    const t = c.appendUserMessage('hi');
    expect(t.role).toBe('user');
    expect(t.blocks).toHaveLength(1);
    expect(t.blocks[0]).toEqual({ type: 'text', content: 'hi' });
    expect(c.getTurns()).toHaveLength(1);
  });

  it('appends assistant turn and returns its id', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    expect(t.role).toBe('assistant');
    expect(t.blocks).toEqual([]);
    expect(typeof t.id).toBe('string');
  });

  it('appends text chunks to the last text block of a turn', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    c.appendTextChunk(t.id, 'Hello, ');
    c.appendTextChunk(t.id, 'world.');
    const turns = c.getTurns();
    expect(turns[0].blocks).toHaveLength(1);
    expect(turns[0].blocks[0]).toEqual({ type: 'text', content: 'Hello, world.' });
  });

  it('appendBlock starts a new block (does not merge with text)', () => {
    const c = createConversation();
    const t = c.appendAssistantTurn();
    c.appendTextChunk(t.id, 'searching:');
    c.appendBlock(t.id, { type: 'tool_use', label: 'Searching', params: 'size 7' });
    c.appendTextChunk(t.id, 'found it');
    const blocks = c.getTurns()[0].blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('text');
    expect(blocks[1].type).toBe('tool_use');
    expect(blocks[2].type).toBe('text');
  });

  it('notifies subscribers on mutation', () => {
    const c = createConversation();
    const fn = vi.fn();
    c.subscribe(fn);
    c.appendUserMessage('hi');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports unsubscribing', () => {
    const c = createConversation();
    const fn = vi.fn();
    const unsubscribe = c.subscribe(fn);
    unsubscribe();
    c.appendUserMessage('hi');
    expect(fn).not.toHaveBeenCalled();
  });

  it('reset clears all turns', () => {
    const c = createConversation();
    c.appendUserMessage('hi');
    c.reset();
    expect(c.getTurns()).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify failures**

```bash
npm test -- conversation
```

Expected: 8 FAIL with `Cannot find module`.

- [ ] **Step 3: Implement conversation.js**

Create `extensions/chat-bubble/assets/modules/conversation.js`:

```js
/**
 * conversation — in-memory store of chat turns with subscribers.
 */
export function createConversation() {
  let turns = [];
  const subscribers = new Set();
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

    appendUserMessage(text) {
      const turn = { id: id(), role: 'user', blocks: [{ type: 'text', content: text }] };
      turns.push(turn);
      notify();
      return turn;
    },

    appendAssistantTurn() {
      const turn = { id: id(), role: 'assistant', blocks: [] };
      turns.push(turn);
      notify();
      return turn;
    },

    appendBlock(turnId, block) {
      const turn = turns.find(t => t.id === turnId);
      if (!turn) return;
      turn.blocks.push(block);
      notify();
    },

    appendTextChunk(turnId, chunk) {
      const turn = turns.find(t => t.id === turnId);
      if (!turn) return;
      const last = turn.blocks[turn.blocks.length - 1];
      if (last && last.type === 'text') {
        last.content += chunk;
      } else {
        turn.blocks.push({ type: 'text', content: chunk });
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
    },
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- conversation
```

Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/chat-bubble/assets/modules/conversation.js tests/extension/conversation.test.js
git commit -m "feat(widget): add conversation store"
```

---

### Task 5: Build turn renderer (text block)

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-turn.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append bubble styles)

- [ ] **Step 1: Append bubble CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Turns and bubbles
 * ============================================================ */
.swa-turn {
  display: flex;
  gap: var(--swa-space-2);
  align-items: flex-start;
  margin-bottom: var(--swa-space-3);
}
.swa-turn-user {
  justify-content: flex-end;
}
.swa-turn-assistant .swa-turn-blocks {
  max-width: 88%;
}
.swa-turn-user .swa-turn-blocks {
  max-width: 80%;
}
.swa-turn-avatar {
  flex-shrink: 0;
}
.swa-turn-blocks {
  display: flex;
  flex-direction: column;
  gap: var(--swa-space-2);
}

.swa-bubble {
  padding: var(--swa-space-2) var(--swa-space-3);
  font-size: var(--swa-text-base);
  line-height: 1.45;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.swa-bubble-user {
  background: var(--swa-color-bubble-user-bg);
  color: var(--swa-color-bubble-user-text);
  border-radius: var(--swa-radius-md) var(--swa-radius-md) var(--swa-radius-sm) var(--swa-radius-md);
}
.swa-bubble-assistant {
  background: var(--swa-color-bubble-assistant-bg);
  color: var(--swa-color-bubble-assistant-text);
  border-radius: var(--swa-radius-md) var(--swa-radius-md) var(--swa-radius-md) var(--swa-radius-sm);
}

.swa-bubble p { margin: 0 0 var(--swa-space-2); }
.swa-bubble p:last-child { margin-bottom: 0; }
.swa-bubble ul, .swa-bubble ol { margin: var(--swa-space-2) 0; padding-left: var(--swa-space-5); }
.swa-bubble li { margin-bottom: var(--swa-space-1); }
.swa-bubble a { color: var(--swa-color-brand); text-decoration: underline; }
.swa-bubble code {
  font-family: var(--swa-font-mono);
  font-size: 0.9em;
  background: rgba(0,0,0,0.06);
  padding: 1px 4px;
  border-radius: var(--swa-radius-sm);
}
```

- [ ] **Step 2: Implement ui-turn.js**

Create `extensions/chat-bubble/assets/modules/ui-turn.js`:

```js
import { el } from './dom.js';
import { createOrb } from './orb.js';
import { renderMarkdown } from './markdown.js';

/**
 * Builds a turn's DOM node and returns it along with an update() method
 * that re-renders the blocks (used during streaming).
 */
export function createTurnNode(turn) {
  const blocksWrap = el('div', { class: 'swa-turn-blocks' });
  const node = el('div', {
    class: `swa-turn swa-turn-${turn.role}`,
  });

  if (turn.role === 'assistant') {
    node.appendChild(el('div', { class: 'swa-turn-avatar' }, createOrb({ size: 22 })));
  }
  node.appendChild(blocksWrap);

  function renderBlocks() {
    blocksWrap.innerHTML = '';
    for (const block of turn.blocks) {
      blocksWrap.appendChild(renderBlock(block, turn.role));
    }
  }

  renderBlocks();
  return { node, update: renderBlocks };
}

function renderBlock(block, role) {
  if (block.type === 'text') {
    const bubble = el('div', {
      class: `swa-bubble swa-bubble-${role}`,
    });
    if (role === 'assistant') {
      bubble.innerHTML = renderMarkdown(block.content);
    } else {
      bubble.textContent = block.content;
    }
    return bubble;
  }
  if (block.type === 'tool_use') {
    // Imported lazily to avoid coupling; ui-tool-use lands in Task 6.
    const slot = el('div', { class: 'swa-block-tool-use-slot' });
    import('./ui-tool-use.js').then(({ createToolUseNode }) => {
      slot.replaceWith(createToolUseNode(block));
    });
    return slot;
  }
  // Unknown block types render as empty (forward-compat for Plans 3–4).
  return el('div', { class: 'swa-block-unknown', 'data-type': block.type });
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-turn.js
git commit -m "feat(widget): build turn renderer with text block + markdown"
```

---

### Task 6: Build tool-use shimmer pill

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-tool-use.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append pill styles)

- [ ] **Step 1: Append tool-use CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Tool-use shimmer pill
 * ============================================================ */
.swa-tool-use {
  display: inline-flex;
  align-items: center;
  gap: var(--swa-space-2);
  padding: var(--swa-space-1) var(--swa-space-3);
  border-radius: var(--swa-radius-full);
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  background:
    linear-gradient(
      90deg,
      var(--swa-color-bg-subtle) 0%,
      var(--swa-color-bg-elevated) 50%,
      var(--swa-color-bg-subtle) 100%
    );
  background-size: 200% 100%;
  animation: swa-tool-shimmer 1.5s linear infinite;
  align-self: flex-start;
}
.swa-tool-use-icon { font-size: 0.9em; }
.swa-tool-use-params {
  font-family: var(--swa-font-mono);
  font-size: 0.9em;
  color: var(--swa-color-text-primary);
}
@keyframes swa-tool-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Implement ui-tool-use.js**

Create `extensions/chat-bubble/assets/modules/ui-tool-use.js`:

```js
import { el } from './dom.js';

/**
 * createToolUseNode — slim shimmer pill.
 *
 * block: { type: 'tool_use', label?: string, params?: string }
 *   - label defaults to "Searching"
 *   - params is rendered in monospace next to the label
 */
export function createToolUseNode(block) {
  const label = block.label || 'Searching';
  const params = block.params || '';

  return el('div', { class: 'swa-tool-use', role: 'status', 'aria-live': 'polite' },
    el('span', { class: 'swa-tool-use-icon', 'aria-hidden': 'true' }, '⚙'),
    el('span', { class: 'swa-tool-use-label' }, label),
    params ? el('span', { class: 'swa-tool-use-params' }, params) : null,
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-tool-use.js
git commit -m "feat(widget): build tool-use shimmer pill"
```

---

### Task 7: Build quick-reply dock

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-quick-replies.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append chip styles)

- [ ] **Step 1: Append chip + dock CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Quick-reply dock
 * ============================================================ */
.swa-quick-replies {
  padding: var(--swa-space-2) var(--swa-space-4) 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--swa-space-2);
  flex-shrink: 0;
  border-top: 1px solid transparent;
  transition: max-height var(--swa-duration-base) var(--swa-ease-standard);
}
.swa-quick-replies:empty {
  padding: 0;
}

.swa-chip {
  padding: 6px 12px;
  border: 1px solid var(--swa-color-border-strong);
  border-radius: var(--swa-radius-full);
  background: var(--swa-color-bg);
  color: var(--swa-color-text-primary);
  font-size: var(--swa-text-sm);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--swa-duration-fast), border-color var(--swa-duration-fast);
}
.swa-chip:hover {
  background: var(--swa-color-bg-subtle);
}
.swa-chip:focus-visible {
  outline: 2px solid var(--swa-color-focus-ring);
  outline-offset: 1px;
}
.swa-chip-primary {
  background: var(--swa-color-brand-soft);
  color: var(--swa-color-info-fg);
  border-color: transparent;
  font-weight: var(--swa-weight-medium);
}
.swa-chip-primary:hover {
  background: var(--swa-color-brand-soft);
  filter: brightness(0.95);
}
```

- [ ] **Step 2: Implement ui-quick-replies.js**

Create `extensions/chat-bubble/assets/modules/ui-quick-replies.js`:

```js
import { el } from './dom.js';

/**
 * Builds the quick-reply dock.
 *
 * Usage:
 *   const dock = createQuickReplies({ onSelect: (chip) => ... });
 *   dock.setChips([{ label: 'Compare similar', intent: 'compare', isPrimary: true }, ...]);
 *   dock.clear();
 */
export function createQuickReplies({ onSelect }) {
  const node = el('div', { class: 'swa-quick-replies', role: 'group', 'aria-label': 'Quick replies' });

  function setChips(chips = []) {
    node.innerHTML = '';
    for (const c of chips) {
      const cls = c.isPrimary ? 'swa-chip swa-chip-primary' : 'swa-chip';
      const btn = el('button', {
        class: cls,
        type: 'button',
      }, c.label);
      btn.addEventListener('click', () => onSelect && onSelect(c));
      node.appendChild(btn);
    }
  }

  function clear() {
    node.innerHTML = '';
  }

  return { node, setChips, clear };
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-quick-replies.js
git commit -m "feat(widget): build quick-reply dock"
```

---

### Task 8: Build the welcome resolver service (server)

**Files:**
- Create: `app/services/welcome.server.js`
- Create: `tests/extension/welcome-resolver.test.js`
- Create: `app/routes/welcome.jsx`
- Modify: `vitest.config.js` (no change needed — already includes `tests/**/*.test.js`)

This is the only backend work in Plan 2. Pack tables are stubbed for `jewelry` only; the rest fall through to a sensible default.

- [ ] **Step 1: Write failing tests for the resolver**

Create `tests/extension/welcome-resolver.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveWelcome } from '../../app/services/welcome.server.js';

describe('resolveWelcome', () => {
  it('returns a hero primary_action for PDP on size-sensitive pack', () => {
    const w = resolveWelcome({
      pageType: 'pdp',
      packId: 'jewelry',
      pageContext: { productType: 'ring', productTitle: 'Halo Solitaire' },
    });
    expect(w.primary_action).not.toBeNull();
    expect(w.primary_action.flow_id).toBe('sizing');
    expect(w.context_line).toContain('Halo Solitaire');
    expect(w.chips.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to conversational on unknown page type', () => {
    const w = resolveWelcome({ pageType: 'unknown', packId: 'jewelry' });
    expect(w.primary_action).toBeNull();
    expect(w.greeting).toBeTruthy();
    expect(w.chips.length).toBeGreaterThanOrEqual(2);
  });

  it('uses welcome-back greeting when hasPriorConvo is true', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'jewelry', hasPriorConvo: true });
    expect(w.greeting.toLowerCase()).toContain('welcome back');
  });

  it('returns sensible defaults for unknown pack', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'pack-that-does-not-exist' });
    expect(w.greeting).toBeTruthy();
    expect(Array.isArray(w.chips)).toBe(true);
  });

  it('omits the context_line when page_context lacks a product title', () => {
    const w = resolveWelcome({ pageType: 'pdp', packId: 'jewelry' });
    expect(w.context_line).toBeNull();
  });

  it('chips are <=24 chars per label', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'jewelry' });
    for (const c of w.chips) expect(c.label.length).toBeLessThanOrEqual(24);
  });
});
```

- [ ] **Step 2: Verify failures**

```bash
npm test -- welcome-resolver
```

Expected: 6 FAIL with `Cannot find module`.

- [ ] **Step 3: Implement welcome.server.js**

Create `app/services/welcome.server.js`:

```js
/**
 * Welcome resolver.
 *
 * Maps (page_type, pack_id, page_context, has_prior_convo) → a welcome bundle
 * the client uses to render the welcome panel.
 *
 * Pack tables are intentionally minimal in v1 — only the jewelry pack is
 * fleshed out as a reference. The fallback path produces a sensible result
 * for any pack/page combo.
 */

const DEFAULT_GREETING = 'Hi — what brings you in?';
const RETURNING_GREETING = 'Welcome back.';

// Per-pack resolution tables. Keys are page_type; values are factories.
const PACK_TABLES = {
  jewelry: {
    pdp: (ctx) => ({
      primary_action: {
        flow_id: 'sizing',
        label: 'Help with sizing',
        subtitle: 'Walk through ring sizing in under a minute.',
        button_text: 'Start the size guide →',
      },
      chips: [
        { intent: 'compare', label: 'Compare similar', isPrimary: false },
        { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
        { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
      ],
      context_template: (c) => c.productTitle ? `Looking at the ${c.productTitle}` : null,
    }),
    cart: () => ({
      primary_action: {
        flow_id: 'walk_cart',
        label: 'Walk through your cart',
        subtitle: 'Anything making you hesitate? I can help.',
        button_text: 'Talk it through →',
      },
      chips: [
        { intent: 'returns_policy', label: 'Returns policy', isPrimary: false },
        { intent: 'save_for_later', label: 'Save for later', isPrimary: false },
      ],
    }),
    collection: () => ({
      primary_action: null,
      chips: [
        { intent: 'narrow_by_price', label: 'Narrow by price', isPrimary: true },
        { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
        { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
      ],
    }),
  },
};

const DEFAULT_CHIPS = [
  { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
  { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
  { intent: 'returns_policy', label: 'Returns policy', isPrimary: false },
];

export function resolveWelcome({ pageType, packId, pageContext = {}, hasPriorConvo = false } = {}) {
  const greeting = hasPriorConvo ? RETURNING_GREETING : DEFAULT_GREETING;

  const packTable = PACK_TABLES[packId] || {};
  const entry = packTable[pageType];

  if (!entry) {
    return {
      greeting,
      context_line: null,
      primary_action: null,
      chips: DEFAULT_CHIPS.slice(0, 3),
    };
  }

  const built = entry(pageContext);
  const context_line = typeof built.context_template === 'function'
    ? built.context_template(pageContext)
    : null;

  return {
    greeting,
    context_line,
    primary_action: built.primary_action,
    chips: (built.chips || DEFAULT_CHIPS).slice(0, 4),
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- welcome-resolver
```

Expected: 6 PASS.

- [ ] **Step 5: Build the /welcome route**

Create `app/routes/welcome.jsx`:

```js
import { resolveWelcome } from '../services/welcome.server.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function loader({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const url = new URL(request.url);
  const pageType = url.searchParams.get('page_type') || 'unknown';
  const packId = url.searchParams.get('pack_id') || 'jewelry';
  const hasPriorConvo = url.searchParams.get('has_prior_convo') === '1';

  let pageContext = {};
  const ctxRaw = url.searchParams.get('page_context');
  if (ctxRaw) {
    try {
      pageContext = JSON.parse(ctxRaw);
    } catch {
      pageContext = {};
    }
  }

  const welcome = resolveWelcome({ pageType, packId, pageContext, hasPriorConvo });
  return new Response(JSON.stringify(welcome), { headers: CORS_HEADERS });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/services/welcome.server.js app/routes/welcome.jsx tests/extension/welcome-resolver.test.js
git commit -m "feat(welcome): add welcome resolver service + /welcome route"
```

---

### Task 9: Build welcome panel renderer

**Files:**
- Create: `extensions/chat-bubble/assets/modules/ui-welcome.js`
- Modify: `extensions/chat-bubble/assets/chat.css` (append welcome panel styles)

- [ ] **Step 1: Append welcome panel CSS**

Append to `extensions/chat-bubble/assets/chat.css`:

```css
/* ============================================================
 * Welcome panel
 * ============================================================ */
.swa-welcome {
  padding: var(--swa-space-5) var(--swa-space-4) var(--swa-space-3);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--swa-space-2);
}
.swa-welcome-orb {
  margin-bottom: var(--swa-space-1);
}
.swa-welcome-greeting {
  font-size: var(--swa-text-md);
  font-weight: var(--swa-weight-medium);
  color: var(--swa-color-text-primary);
}
.swa-welcome-context {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
}

.swa-welcome-hero {
  background: color-mix(in srgb, var(--swa-color-brand) 6%, var(--swa-color-bg));
  border: 1px solid color-mix(in srgb, var(--swa-color-brand) 35%, var(--swa-color-border));
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-3);
  width: 100%;
  text-align: left;
  margin-top: var(--swa-space-3);
}
.swa-welcome-hero-title {
  font-size: var(--swa-text-base);
  font-weight: var(--swa-weight-semibold);
  color: var(--swa-color-text-primary);
}
.swa-welcome-hero-subtitle {
  font-size: var(--swa-text-sm);
  color: var(--swa-color-text-secondary);
  margin: var(--swa-space-1) 0 var(--swa-space-3);
}
.swa-welcome-hero-button {
  width: 100%;
  background: var(--swa-color-brand);
  color: var(--swa-color-brand-foreground);
  border: none;
  border-radius: var(--swa-radius-md);
  padding: var(--swa-space-2) var(--swa-space-3);
  font-size: var(--swa-text-sm);
  font-weight: var(--swa-weight-medium);
  cursor: pointer;
}
.swa-welcome-hero-button:hover { background: var(--swa-color-brand-hover); }
.swa-welcome-hero-button:focus-visible {
  outline: 3px solid var(--swa-color-focus-ring);
  outline-offset: 2px;
}

.swa-welcome-or {
  margin-top: var(--swa-space-3);
  font-size: var(--swa-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--swa-color-text-tertiary);
}
.swa-welcome-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--swa-space-2);
  margin-top: var(--swa-space-2);
}
```

- [ ] **Step 2: Implement ui-welcome.js**

Create `extensions/chat-bubble/assets/modules/ui-welcome.js`:

```js
import { el } from './dom.js';
import { createOrb } from './orb.js';

/**
 * Builds the welcome panel from a resolved welcome bundle.
 *
 * resolved: { greeting, context_line, primary_action: {label, subtitle, button_text, flow_id} | null, chips: [{label, intent, isPrimary}] }
 * handlers: { onPrimaryAction(flowId), onChip(intent, label) }
 */
export function createWelcomePanel({ resolved, onPrimaryAction, onChip }) {
  const node = el('div', { class: 'swa-welcome', role: 'region', 'aria-label': 'Welcome' });

  node.appendChild(el('div', { class: 'swa-welcome-orb' }, createOrb({ size: 52 })));
  node.appendChild(el('div', { class: 'swa-welcome-greeting' }, resolved.greeting));

  if (resolved.context_line) {
    node.appendChild(el('div', { class: 'swa-welcome-context' }, resolved.context_line));
  }

  if (resolved.primary_action) {
    const pa = resolved.primary_action;
    const btn = el('button', { class: 'swa-welcome-hero-button', type: 'button' }, pa.button_text);
    btn.addEventListener('click', () => onPrimaryAction && onPrimaryAction(pa.flow_id, pa.label));
    node.appendChild(
      el('div', { class: 'swa-welcome-hero' },
        el('div', { class: 'swa-welcome-hero-title' }, pa.label),
        el('div', { class: 'swa-welcome-hero-subtitle' }, pa.subtitle),
        btn,
      )
    );
    node.appendChild(el('div', { class: 'swa-welcome-or' }, '— or —'));
  }

  if (resolved.chips && resolved.chips.length) {
    const chipsWrap = el('div', { class: 'swa-welcome-chips' });
    for (const c of resolved.chips) {
      const cls = c.isPrimary ? 'swa-chip swa-chip-primary' : 'swa-chip';
      const chip = el('button', { class: cls, type: 'button' }, c.label);
      chip.addEventListener('click', () => onChip && onChip(c.intent, c.label));
      chipsWrap.appendChild(chip);
    }
    node.appendChild(chipsWrap);
  }

  return node;
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.css extensions/chat-bubble/assets/modules/ui-welcome.js
git commit -m "feat(widget): build welcome panel renderer"
```

---

### Task 10: Replace stream stub with real turn-list

**Files:**
- Overwrite: `extensions/chat-bubble/assets/modules/ui-stream.js`

The stream subscribes to the conversation store and renders turns. It also hosts the welcome panel as a special prologue block.

- [ ] **Step 1: Overwrite ui-stream.js**

Replace `extensions/chat-bubble/assets/modules/ui-stream.js`:

```js
import { el } from './dom.js';
import { createTurnNode } from './ui-turn.js';

/**
 * Stream — subscribes to conversation, renders turns in order.
 *
 * Exposes:
 *   - node                — the DOM container
 *   - setWelcome(panelNode|null)  — sets/clears the welcome prologue
 *   - bindConversation(conv)      — subscribes to a conversation store
 */
export function createStream() {
  const welcomeSlot = el('div', { class: 'swa-stream-welcome-slot' });
  const turnsWrap = el('div', { class: 'swa-stream-turns' });
  const node = el('div', {
    class: 'swa-stream',
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
  }, welcomeSlot, turnsWrap);

  // Map: turnId → { node, update }
  const turnNodes = new Map();

  function setWelcome(panelNode) {
    welcomeSlot.innerHTML = '';
    if (panelNode) welcomeSlot.appendChild(panelNode);
  }

  function bindConversation(conv) {
    function render() {
      const turns = conv.getTurns();
      // Add nodes for new turns
      for (const t of turns) {
        if (!turnNodes.has(t.id)) {
          const ctl = createTurnNode(t);
          turnNodes.set(t.id, ctl);
          turnsWrap.appendChild(ctl.node);
        } else {
          turnNodes.get(t.id).update();
        }
      }
      // Auto-scroll to bottom (Plan 4 adds the scroll-pause behavior)
      node.scrollTop = node.scrollHeight;
    }
    conv.subscribe(render);
    render();
  }

  return { node, setWelcome, bindConversation };
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/modules/ui-stream.js
git commit -m "feat(widget): replace stream stub with real turn-list renderer"
```

---

### Task 11: Wire it all up — composer → api → conversation → stream

**Files:**
- Overwrite: `extensions/chat-bubble/assets/chat.js`

This is the integration task. The composer now sends through `api.streamChat`, events drive the `conversation` store, which renders into the stream. The welcome panel fetches via `api.fetchWelcome` on first open.

- [ ] **Step 1: Overwrite chat.js**

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
import { streamChat, fetchWelcome } from './modules/api.js';

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
  // Best-effort product title scrape from common selectors.
  const titleEl = document.querySelector('h1.product__title, h1[itemprop="name"], .product-single__title, h1.product-title');
  if (titleEl) ctx.productTitle = titleEl.textContent.trim();
  return ctx;
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

  const conversation = createConversation();
  let conversationId = null;
  let activeStream = null;
  let currentAssistantTurnId = null;

  // ---------- UI assembly ----------
  const launcherCtl = createLauncher({ state });
  const window_ = createWindow({ state, launcher: launcherCtl.node });
  const header = createHeader({ state });
  const stream = createStream();
  const quickReplies = createQuickReplies({
    onSelect: (chip) => {
      sendMessage(chip.label, { intent: chip.intent });
      quickReplies.clear();
    },
  });
  const composer = createComposer({
    onSubmit: (value) => sendMessage(value),
    onAttach: () => console.log('[swa] attach clicked — image upload lands in Plan 4'),
  });
  const footer = buildFooter(config.shopName);

  window_.headerSlot.appendChild(header);
  window_.streamSlot.appendChild(stream.node);
  window_.dockSlot.appendChild(quickReplies.node);
  window_.composerSlot.appendChild(composer.node);
  window_.footerSlot.appendChild(footer);

  root.appendChild(launcherCtl.node);
  root.appendChild(launcherCtl.previewBubble);
  root.appendChild(window_.node);

  stream.bindConversation(conversation);

  // ---------- Open lifecycle ----------
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

  // ---------- Welcome ----------
  async function showWelcomePanel() {
    const pageType = detectPageType();
    const pageContext = detectPageContext();
    let resolved;
    try {
      resolved = await fetchWelcome({ pageType, pageContext, hasPriorConvo: false });
    } catch (err) {
      console.warn('[swa] welcome fetch failed, falling back to defaults', err);
      resolved = {
        greeting: 'Hi — what brings you in?',
        context_line: null,
        primary_action: null,
        chips: [],
      };
    }
    const panel = createWelcomePanel({
      resolved,
      onPrimaryAction: (flowId, label) => {
        sendMessage(label, { flow: flowId });
        stream.setWelcome(null);
      },
      onChip: (intent, label) => {
        sendMessage(label, { intent });
        stream.setWelcome(null);
      },
    });
    stream.setWelcome(panel);
  }

  // ---------- Send message ----------
  function sendMessage(text, meta = {}) {
    stream.setWelcome(null);
    conversation.appendUserMessage(text);

    const assistantTurn = conversation.appendAssistantTurn();
    currentAssistantTurnId = assistantTurn.id;

    if (activeStream) activeStream.cancel();

    activeStream = streamChat(
      {
        message: text,
        conversation_id: conversationId,
        prompt_type: config.promptType,
        page_context: { page_type: detectPageType(), ...detectPageContext(), ...meta },
      },
      {
        onEvent: handleEvent,
        onError: (err) => {
          conversation.appendBlock(currentAssistantTurnId, {
            type: 'text',
            content: `_Connection error — please try again._`,
          });
          console.error('[swa] stream error', err);
        },
        onClose: () => {
          activeStream = null;
        },
      }
    );
  }

  function handleEvent(ev) {
    if (!currentAssistantTurnId) return;
    if (ev.type === 'id') {
      conversationId = ev.conversation_id;
      return;
    }
    if (ev.type === 'chunk' && typeof ev.chunk === 'string') {
      conversation.appendTextChunk(currentAssistantTurnId, ev.chunk);
      return;
    }
    if (ev.type === 'tool_use') {
      // Parse "Calling tool: NAME with arguments: {...}" into label + params
      const m = /Calling tool:\s+(\w+)\s+with arguments:\s+(.+)/.exec(ev.tool_use_message || '');
      const label = m ? `Calling ${m[1]}` : 'Searching';
      const params = m ? truncate(m[2], 80) : '';
      conversation.appendBlock(currentAssistantTurnId, { type: 'tool_use', label, params });
      return;
    }
    if (ev.type === 'message_complete') {
      // No-op for now — Plan 4 wires quick-replies refresh here.
      return;
    }
    if (ev.type === 'error' && ev.error) {
      conversation.appendBlock(currentAssistantTurnId, {
        type: 'text',
        content: `_Error: ${ev.error}_`,
      });
    }
  }

  function truncate(str, n) {
    return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
  }
}

function truncate(str, n) {
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 2: Run tests to confirm nothing regressed**

```bash
npm test
```

Expected: all tests still pass (≥41 across 7 files).

- [ ] **Step 3: Commit**

```bash
git add extensions/chat-bubble/assets/chat.js
git commit -m "feat(widget): wire composer → api → conversation → stream"
```

---

### Task 12: Update test-surfaces.html with conversation surfaces

**Files:**
- Modify: `extensions/chat-bubble/assets/test-surfaces.html`

Add new sections for: a sample conversation (turn list), tool-use pill in isolation, quick-reply dock, and welcome panel.

- [ ] **Step 1: Overwrite test-surfaces.html**

Replace `extensions/chat-bubble/assets/test-surfaces.html`:

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
  <h1>Shop AI Widget — Surface Tests (Plan 1 + Plan 2)</h1>

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

  <h2>Welcome panel — with primary action</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="welcome-with-hero" style="width:420px;"></div>
  </div>

  <h2>Welcome panel — fallback (no primary action)</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="welcome-fallback" style="width:420px;"></div>
  </div>

  <h2>Sample conversation (text + tool-use + assistant markdown)</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="conv-stage" style="width:420px;"></div>
  </div>

  <h2>Quick-reply dock</h2>
  <div class="stage shop-ai-chat-container" style="position:relative;bottom:auto;right:auto;">
    <div id="chips-stage" style="width:420px;"></div>
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
    import { createConversation } from './modules/conversation.js';
    import { createTurnNode } from './modules/ui-turn.js';
    import { createWelcomePanel } from './modules/ui-welcome.js';
    import { createQuickReplies } from './modules/ui-quick-replies.js';

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
    const restCtl = createLauncher({ state: restState });
    const pillCtl = createLauncher({ state: pillState });
    const lstage = document.getElementById('launcher-stage');
    lstage.append(restCtl.node, document.createTextNode('   '), pillCtl.node, pillCtl.previewBubble);

    // Header
    const headerState = createState({ ...INITIAL_STATE, shopName: 'Shop LC' });
    document.getElementById('header-stage').appendChild(createHeader({ state: headerState }));

    // Welcome — with hero
    document.getElementById('welcome-with-hero').appendChild(createWelcomePanel({
      resolved: {
        greeting: 'Hi — what brings you in?',
        context_line: 'Looking at the Halo Solitaire',
        primary_action: {
          flow_id: 'sizing',
          label: 'Help with sizing',
          subtitle: 'Walk through ring sizing in under a minute.',
          button_text: 'Start the size guide →',
        },
        chips: [
          { intent: 'compare', label: 'Compare similar' },
          { intent: 'gift', label: "It's a gift" },
          { intent: 'best', label: 'Show bestsellers' },
        ],
      },
      onPrimaryAction: (flow) => alert(`primary: ${flow}`),
      onChip: (intent) => alert(`chip: ${intent}`),
    }));

    // Welcome — fallback
    document.getElementById('welcome-fallback').appendChild(createWelcomePanel({
      resolved: {
        greeting: 'Hi — what brings you in?',
        context_line: null,
        primary_action: null,
        chips: [
          { intent: 'gift', label: "It's a gift", isPrimary: true },
          { intent: 'best', label: 'Show bestsellers' },
          { intent: 'returns', label: 'Returns policy' },
        ],
      },
      onPrimaryAction: () => {},
      onChip: (intent) => alert(`chip: ${intent}`),
    }));

    // Sample conversation
    const conv = createConversation();
    const convStage = document.getElementById('conv-stage');
    function refresh() {
      convStage.innerHTML = '';
      for (const t of conv.getTurns()) {
        const ctl = createTurnNode(t);
        convStage.appendChild(ctl.node);
      }
    }
    conv.subscribe(refresh);
    conv.appendUserMessage('Help me with ring sizing');
    const aTurn = conv.appendAssistantTurn();
    conv.appendTextChunk(aTurn.id, 'Happy to. A few quick questions — should only take a minute.');
    conv.appendBlock(aTurn.id, { type: 'tool_use', label: 'Searching', params: 'size 7 · 4–5mm bands' });
    const a2 = conv.appendAssistantTurn();
    conv.appendTextChunk(a2.id, '**Three rings** in your size, in stock. The halo settings tend to feel half a size smaller — flagging the closest matches first.');
    refresh();

    // Quick-reply dock
    const chipsStage = document.getElementById('chips-stage');
    const qr = createQuickReplies({ onSelect: (c) => alert(`chip: ${c.label}`) });
    chipsStage.appendChild(qr.node);
    qr.setChips([
      { label: 'Compare in detail', intent: 'compare', isPrimary: true },
      { label: 'Show more', intent: 'more' },
      { label: 'Find smaller budget', intent: 'budget' },
    ]);

    // Composer
    document.getElementById('composer-stage').appendChild(
      createComposer({ onSubmit: (v) => alert(`Sent: ${v}`) }).node
    );
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add extensions/chat-bubble/assets/test-surfaces.html
git commit -m "build(widget): add conversation surfaces to test-surfaces page"
```

---

### Task 13: Verify, cleanup, finalize Plan 2

- [ ] **Step 1: Run full test suite**

```bash
cd /Applications/pe/shop-chat-agent && npm test
```

Expected: all tests pass — orb (5), state (6), composer (7), smoke (1), markdown (8), conversation (8), welcome-resolver (6) = 41 tests across 7 files.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: only the 4 pre-existing errors in `app/routes/*` from Plan 1. No new errors from Plan 2 modules.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. (If `app/routes/welcome.jsx` reports unused imports, remove them.)

- [ ] **Step 4: Manual smoke**

This requires a running dev environment:

```bash
npm run dev
```

Open a storefront URL with the chat extension. Confirm:
- Widget opens; welcome panel renders (greeting + chips at minimum; primary CTA when on a PDP).
- Type "Hello" and press Enter → user bubble appears, assistant turn starts, streamed tokens fill in.
- Tool-use indicator appears as a shimmer pill during tool calls.
- Markdown in assistant responses renders (bold, lists, links).
- No console errors.

For environments without a storefront, open `extensions/chat-bubble/assets/test-surfaces.html` directly and verify all surfaces render including the sample conversation, welcome panels, and quick-reply dock.

- [ ] **Step 5: Commit any final fixes**

If lint/typecheck surface issues introduced by Plan 2, fix them, then:

```bash
git add -A
git commit -m "chore(widget): finalize plan 2 conversation core"
```

If no changes needed, skip this step.

---

## Self-Review

**1. Spec coverage (sections §8 and §9 of the design spec):**

- §8.1 Welcome panel layout (context-led hybrid focused) — Task 9 ✓
- §8.2 Welcome resolver service — Tasks 8 + 11 ✓
- §8.3 Returning user variant — partial: greeting flips to "Welcome back." (Task 8); the full resume card with faded prior turns lands in **Plan 4** (where edge states + history are tackled)
- §9.1 Message turns (user + assistant bubbles, avatar rules, corner-squaring) — Tasks 5 + chat.css ✓
- §9.2 Block inventory — `text` ✓ (Task 5), `tool_use` ✓ (Task 6), `quick_replies` ✓ (Task 7). Other block types deferred to Plan 3/4 as their domains arrive.
- §9.3 Tool-use shimmer — Task 6 ✓
- §9.4 Quick-reply dock — Task 7 ✓
- §9.5 Sizing widget — **Plan 4** (advanced interactive blocks)
- §9.6 Comparison — **Plan 4**
- §9.7 Composer — already shipped in Plan 1; no changes needed
- §9.8 Auto-scroll behavior — basic auto-scroll-to-bottom in Task 10; the **scroll-pause + "new messages" pill** lands in **Plan 4**

**2. Placeholder scan:** none — every code step contains exact code.

**3. Type consistency:**

- `streamChat(payload, handlers)` returns `{cancel()}` — consumed in chat.js Task 11 ✓
- `fetchWelcome(args)` returns Promise → ResolvedWelcome — schema matches `resolveWelcome` server output ✓
- `createConversation()` API: `getTurns`, `appendUserMessage`, `appendAssistantTurn`, `appendBlock`, `appendTextChunk`, `subscribe`, `reset` — consumed consistently ✓
- `createTurnNode(turn)` returns `{node, update}` — used by ui-stream.js ✓
- `createStream()` returns `{node, setWelcome, bindConversation}` — used by chat.js ✓
- `createWelcomePanel({resolved, onPrimaryAction, onChip})` returns DOM node — consumed in chat.js + test-surfaces ✓
- `createQuickReplies({onSelect})` returns `{node, setChips, clear}` — consumed in chat.js + test-surfaces ✓
- Welcome bundle schema (`greeting`, `context_line`, `primary_action`, `chips`) matches between server (Task 8) and client (Task 9) ✓
- Conversation block shape: `{type: 'text', content}`, `{type: 'tool_use', label, params}` — consistent across modules ✓

No issues found.

---

## What's NOT in this plan

| Item | Goes to |
|---|---|
| Product card + carousel + ATC state machine | Plan 3 |
| Cart summary, checkout, express checkout, orders, save-cart, auth | Plan 3 |
| Sizing widget, comparison sheet | Plan 4 |
| Proactive trigger engine (F4 backend signals) | Plan 4 |
| Returning-user **resume card** (faded prior turns + Continue/Start fresh) | Plan 4 |
| Auto-scroll pause + "↓ New messages" pill | Plan 4 |
| Error mid-stream banner + auto-retry | Plan 4 |
| Offline state + read-only mode | Plan 4 |
| Rate-limited state with countdown | Plan 4 |
| Image upload composer + image_preview + vision_result blocks | Plan 4 |
| Full pack-flex theming + per-pack orb palettes | Plan 4 |
