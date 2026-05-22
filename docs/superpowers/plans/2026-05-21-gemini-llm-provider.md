# Pluggable LLM Provider (Claude + Gemini) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the chat agent to route LLM requests to Google Gemini (`gemini-2.5-flash`) by setting `LLM_PROVIDER=gemini` in `.env`, with the existing Claude path preserved as a rollback. Default to Gemini after this change.

**Architecture:** Coexist via dispatcher. `app/services/llm.server.js` reads `LLM_PROVIDER` and returns either the existing `createClaudeService()` or the new `createGeminiService()`. Both expose an identical interface (`streamConversation` + `getSystemPrompt`) so `chat.jsx`, `tool.server.js`, and DB storage continue to think in Claude-shaped messages. The translation between Claude's `tool_use/tool_result` blocks and Gemini's `functionCall/functionResponse` parts lives entirely inside `gemini.server.js`.

**Tech Stack:** `@google/generative-ai` (Gemini SDK), `@anthropic-ai/sdk` (unchanged), vitest for tests, React Router app server.

**Spec:** [`docs/superpowers/specs/2026-05-21-gemini-llm-provider-design.md`](../specs/2026-05-21-gemini-llm-provider-design.md)

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `app/services/llm.server.js` | NEW | Provider dispatcher — reads `LLM_PROVIDER`, returns the right service |
| `app/services/gemini.server.js` | NEW | Gemini wrapper + translation between Claude shape ↔ Gemini native |
| `app/services/claude.server.js` | unchanged | Existing Claude wrapper (now invoked through dispatcher) |
| `app/services/config.server.js` | EDIT | Add `geminiModel: 'gemini-2.5-flash'` |
| `app/routes/chat.jsx` | EDIT | One import + one variable rename |
| `tests/services/gemini-translate.test.js` | NEW | Unit tests for pure translation helpers |
| `tests/services/llm-dispatcher.test.js` | NEW | Unit tests for the dispatcher |
| `package.json` | EDIT | Add `@google/generative-ai` dep |
| `.env` | EDIT | Add `LLM_PROVIDER` and `GEMINI_API_KEY` |
| `README.md` | EDIT | Add "Switching LLM providers" section |

---

## Task 1: Add Gemini SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the Gemini SDK**

```bash
npm install @google/generative-ai@^0.21.0
```

Expected: a dependency line appears in `package.json` under `dependencies`, and `package-lock.json` updates.

- [ ] **Step 2: Sanity-check the import resolves**

```bash
node -e "import('@google/generative-ai').then(m => console.log('ok:', Object.keys(m).join(',')))"
```

Expected output: `ok: GoogleGenerativeAI,HarmCategory,HarmBlockThreshold,...` (some named exports listed).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @google/generative-ai dependency"
```

---

## Task 2: Add env-var scaffolding

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add LLM_PROVIDER and GEMINI_API_KEY to `.env`**

Open `.env` and add these two lines (preserve existing keys):

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=
```

`GEMINI_API_KEY` is intentionally empty — the developer will fill it in after this change lands.

- [ ] **Step 2: Sanity-check `.env` is gitignored**

```bash
git check-ignore -v .env
```

Expected: a line confirming `.env` is matched by a `.gitignore` rule. If it returns nothing, ADD `.env` to `.gitignore` and commit that before continuing.

- [ ] **Step 3: No commit needed**

`.env` should not be in version control. Move to next task.

---

## Task 3: Write tests for the LLM dispatcher

**Files:**
- Create: `tests/services/llm-dispatcher.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/services/llm-dispatcher.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the two provider modules so the dispatcher can be tested in isolation.
vi.mock('../../app/services/claude.server.js', () => ({
  createClaudeService: () => ({ __provider: 'claude' }),
}));
vi.mock('../../app/services/gemini.server.js', () => ({
  createGeminiService: () => ({ __provider: 'gemini' }),
}));

describe('createLlmService', () => {
  const ORIGINAL_ENV = process.env.LLM_PROVIDER;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = ORIGINAL_ENV;
    }
  });

  it('returns the Gemini service when LLM_PROVIDER=gemini', async () => {
    process.env.LLM_PROVIDER = 'gemini';
    const { createLlmService } = await import('../../app/services/llm.server.js');
    expect(createLlmService().__provider).toBe('gemini');
  });

  it('returns the Claude service when LLM_PROVIDER=claude', async () => {
    process.env.LLM_PROVIDER = 'claude';
    const { createLlmService } = await import('../../app/services/llm.server.js');
    expect(createLlmService().__provider).toBe('claude');
  });

  it('defaults to Gemini when LLM_PROVIDER is unset', async () => {
    delete process.env.LLM_PROVIDER;
    const { createLlmService } = await import('../../app/services/llm.server.js');
    expect(createLlmService().__provider).toBe('gemini');
  });

  it('is case-insensitive for the provider name', async () => {
    process.env.LLM_PROVIDER = 'CLAUDE';
    const { createLlmService } = await import('../../app/services/llm.server.js');
    expect(createLlmService().__provider).toBe('claude');
  });

  it('throws a helpful error for an unknown provider', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const { createLlmService } = await import('../../app/services/llm.server.js');
    expect(() => createLlmService()).toThrow(/openai/);
    expect(() => createLlmService()).toThrow(/gemini|claude/);
  });
});
```

- [ ] **Step 2: Update vitest config to include `tests/services/`**

Check current `vitest.config.js`:

```bash
cat vitest.config.js
```

If the `include` pattern is `tests/**/*.test.js`, no change needed. If it's narrower (e.g. `tests/extension/**`), broaden it:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run tests/services/llm-dispatcher.test.js
```

Expected: FAIL with "Cannot find module" or similar — because `app/services/llm.server.js` doesn't exist yet, AND `app/services/gemini.server.js` doesn't exist yet (the mock won't even resolve).

---

## Task 4: Implement the LLM dispatcher

**Files:**
- Create: `app/services/llm.server.js`
- Create: `app/services/gemini.server.js` (empty stub for now so the mock resolves)

- [ ] **Step 1: Create an empty `gemini.server.js` stub so imports resolve**

```js
// app/services/gemini.server.js
/**
 * Gemini Service — wraps @google/generative-ai and translates between
 * Claude-shaped messages/tools (the app's canonical format) and Gemini
 * native (functionCall/functionResponse + contents/parts).
 *
 * Filled out in subsequent tasks. Stub exists so the dispatcher can import it.
 */
export function createGeminiService() {
  throw new Error("createGeminiService not yet implemented");
}
```

- [ ] **Step 2: Implement the dispatcher**

```js
// app/services/llm.server.js
/**
 * LLM Provider Dispatcher
 *
 * Reads `LLM_PROVIDER` from the environment and returns the matching
 * provider service. Both providers expose an identical interface:
 *   { streamConversation, getSystemPrompt }
 *
 * Default: gemini (free-tier friendly). Set LLM_PROVIDER=claude to use
 * the existing Anthropic path. Set anything else and we throw clearly.
 */
import { createClaudeService } from "./claude.server";
import { createGeminiService } from "./gemini.server";

export function createLlmService() {
  const raw = process.env.LLM_PROVIDER || "gemini";
  const provider = raw.toLowerCase();

  if (provider === "claude") return createClaudeService();
  if (provider === "gemini") return createGeminiService();

  throw new Error(
    `Unknown LLM_PROVIDER='${raw}'. Valid values: 'gemini', 'claude'.`
  );
}

export default { createLlmService };
```

- [ ] **Step 3: Run the dispatcher tests to verify they pass**

```bash
npx vitest run tests/services/llm-dispatcher.test.js
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/services/llm.server.js app/services/gemini.server.js tests/services/llm-dispatcher.test.js
git commit -m "feat(llm): add LLM_PROVIDER dispatcher with claude/gemini routing"
```

---

## Task 5: Write tests for `toGeminiTools` translation

**Files:**
- Create: `tests/services/gemini-translate.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/services/gemini-translate.test.js
import { describe, it, expect } from 'vitest';
import { toGeminiTools } from '../../app/services/gemini.server.js';

describe('toGeminiTools', () => {
  it('returns null when given empty tools (Gemini accepts no `tools` key, not [])', () => {
    expect(toGeminiTools([])).toBeNull();
    expect(toGeminiTools(undefined)).toBeNull();
    expect(toGeminiTools(null)).toBeNull();
  });

  it('wraps all declarations in a single functionDeclarations entry', () => {
    const claudeTools = [
      {
        name: 'list_my_orders',
        description: 'List the customer recent orders.',
        input_schema: {
          type: 'object',
          properties: { next: { type: 'boolean' } },
        },
      },
      {
        name: 'search_catalog',
        description: 'Search the store catalog.',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const result = toGeminiTools(claudeTools);

    expect(result).toEqual([
      {
        functionDeclarations: [
          {
            name: 'list_my_orders',
            description: 'List the customer recent orders.',
            parameters: {
              type: 'object',
              properties: { next: { type: 'boolean' } },
            },
          },
          {
            name: 'search_catalog',
            description: 'Search the store catalog.',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
      },
    ]);
  });

  it('handles tools with no input_schema (no-arg tools)', () => {
    const result = toGeminiTools([
      { name: 'get_my_profile', description: 'Get profile', input_schema: { type: 'object', properties: {} } },
    ]);
    expect(result[0].functionDeclarations[0].parameters).toEqual({ type: 'object', properties: {} });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/services/gemini-translate.test.js -t toGeminiTools
```

Expected: FAIL — `toGeminiTools` is not exported from the stub.

---

## Task 6: Implement `toGeminiTools`

**Files:**
- Modify: `app/services/gemini.server.js`

- [ ] **Step 1: Add the helper at the top of the file**

Replace the contents of `app/services/gemini.server.js` with:

```js
// app/services/gemini.server.js
/**
 * Gemini Service — wraps @google/generative-ai and translates between
 * Claude-shaped messages/tools (the app's canonical format) and Gemini
 * native (functionCall/functionResponse + contents/parts).
 */

/**
 * Translate Claude-shaped tool definitions into Gemini's `tools` array.
 *
 * Claude:  [{ name, description, input_schema }, ...]
 * Gemini:  [{ functionDeclarations: [{ name, description, parameters }, ...] }]
 *
 * The JSON Schema in `input_schema` is structurally compatible with
 * Gemini's `parameters` so no schema re-walking is needed.
 *
 * @param {Array<{name:string, description:string, input_schema:object}>} tools
 * @returns {Array|null} A Gemini tools array, or null if no tools (Gemini rejects an empty array on some endpoints).
 */
export function toGeminiTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema || { type: 'object', properties: {} },
      })),
    },
  ];
}

export function createGeminiService() {
  throw new Error("createGeminiService not yet implemented");
}
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
npx vitest run tests/services/gemini-translate.test.js -t toGeminiTools
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/services/gemini.server.js tests/services/gemini-translate.test.js
git commit -m "feat(gemini): add toGeminiTools translation helper"
```

---

## Task 7: Write tests for `toGeminiContents` (message translation)

**Files:**
- Modify: `tests/services/gemini-translate.test.js`

- [ ] **Step 1: Append the tests for `toGeminiContents`**

Add to the bottom of `tests/services/gemini-translate.test.js`:

```js
import { toGeminiContents } from '../../app/services/gemini.server.js';

describe('toGeminiContents', () => {
  it('converts a plain-string user message', () => {
    const result = toGeminiContents([{ role: 'user', content: 'hi' }]);
    expect(result).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  it('converts an assistant message with a single text block', () => {
    const result = toGeminiContents([
      { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
    ]);
    expect(result).toEqual([
      { role: 'model', parts: [{ text: 'Hello!' }] },
    ]);
  });

  it('converts an assistant tool_use into a functionCall', () => {
    const result = toGeminiContents([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: "I'll check that." },
          { type: 'tool_use', id: 'toolu_1', name: 'list_my_orders', input: { next: true } },
        ],
      },
    ]);
    expect(result).toEqual([
      {
        role: 'model',
        parts: [
          { text: "I'll check that." },
          { functionCall: { name: 'list_my_orders', args: { next: true } } },
        ],
      },
    ]);
  });

  it('converts a tool_result into a functionResponse, looking up name by tool_use_id', () => {
    const result = toGeminiContents([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'list_my_orders', input: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"orders":[]}' }],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'model',
        parts: [{ functionCall: { name: 'list_my_orders', args: {} } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'list_my_orders',
              response: { content: '{"orders":[]}' },
            },
          },
        ],
      },
    ]);
  });

  it('falls back to name="unknown" for tool_result with unknown tool_use_id (defensive)', () => {
    const result = toGeminiContents([
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'orphan', content: 'x' }],
      },
    ]);
    expect(result[0].parts[0].functionResponse.name).toBe('unknown');
  });

  it('skips unknown content block types with a warning rather than crashing', () => {
    const result = toGeminiContents([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'ok' },
          { type: 'mystery_block', whatever: true },
        ],
      },
    ]);
    expect(result).toEqual([
      { role: 'model', parts: [{ text: 'ok' }] },
    ]);
  });

  it('handles a multi-turn conversation correctly', () => {
    const messages = [
      { role: 'user', content: 'show me orders' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 't1', name: 'list_my_orders', input: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"orders":[{"name":"#1001"}]}' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Your latest order is #1001.' }],
      },
    ];
    const result = toGeminiContents(messages);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('model');
    expect(result[2].role).toBe('user');
    expect(result[2].parts[0].functionResponse.name).toBe('list_my_orders');
    expect(result[3].role).toBe('model');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/services/gemini-translate.test.js -t toGeminiContents
```

Expected: FAIL — `toGeminiContents` not exported.

---

## Task 8: Implement `toGeminiContents`

**Files:**
- Modify: `app/services/gemini.server.js`

- [ ] **Step 1: Add the helper above `createGeminiService`**

Open `app/services/gemini.server.js`. Add this function above `createGeminiService`:

```js
/**
 * Translate the app's canonical (Claude-shaped) message history into
 * Gemini's `contents` array.
 *
 * Claude format:
 *   { role: 'user', content: 'hi' }
 *   { role: 'user', content: [{ type: 'tool_result', tool_use_id, content }] }
 *   { role: 'assistant', content: [{ type: 'text', text }, { type: 'tool_use', id, name, input }] }
 *
 * Gemini format:
 *   { role: 'user',  parts: [{ text }] }
 *   { role: 'user',  parts: [{ functionResponse: { name, response: { content } } }] }
 *   { role: 'model', parts: [{ text }, { functionCall: { name, args } }] }
 *
 * Because Gemini keys functionResponse by tool *name* (not by call id),
 * we maintain an id→name lookup across the history as we walk forward.
 *
 * Unknown content block types are logged and skipped so old/foreign
 * messages in the DB don't crash the translation.
 *
 * @param {Array} messages
 * @returns {Array}
 */
export function toGeminiContents(messages) {
  const out = [];
  const idToName = new Map();

  for (const m of messages || []) {
    if (m.role === 'user') {
      const parts = [];
      const blocks = Array.isArray(m.content)
        ? m.content
        : [{ type: 'text', text: m.content }];

      for (const block of blocks) {
        if (block.type === 'text') {
          parts.push({ text: block.text ?? '' });
        } else if (block.type === 'tool_result') {
          const name = idToName.get(block.tool_use_id) || 'unknown';
          parts.push({
            functionResponse: {
              name,
              response: { content: block.content },
            },
          });
        } else {
          console.warn(`[gemini] skipping unknown user block type='${block.type}'`);
        }
      }
      out.push({ role: 'user', parts });
    } else if (m.role === 'assistant') {
      const parts = [];
      for (const block of m.content || []) {
        if (block.type === 'text') {
          parts.push({ text: block.text ?? '' });
        } else if (block.type === 'tool_use') {
          idToName.set(block.id, block.name);
          parts.push({ functionCall: { name: block.name, args: block.input || {} } });
        } else {
          console.warn(`[gemini] skipping unknown assistant block type='${block.type}'`);
        }
      }
      out.push({ role: 'model', parts });
    } else {
      console.warn(`[gemini] skipping message with unknown role='${m.role}'`);
    }
  }

  return out;
}
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npx vitest run tests/services/gemini-translate.test.js -t toGeminiContents
```

Expected: 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/services/gemini.server.js tests/services/gemini-translate.test.js
git commit -m "feat(gemini): translate Claude messages to Gemini contents"
```

---

## Task 9: Write the test for streaming + finalMessage assembly

**Files:**
- Modify: `tests/services/gemini-translate.test.js`

- [ ] **Step 1: Append the test**

Add to the bottom of `tests/services/gemini-translate.test.js`:

```js
import { consumeGeminiStream } from '../../app/services/gemini.server.js';

describe('consumeGeminiStream', () => {
  /**
   * Helper: build a fake Gemini stream that yields the given chunks.
   * Each chunk shape: { textValue: string|null, functionCalls: Array }
   */
  function fakeStream(chunks) {
    return {
      stream: (async function* () {
        for (const c of chunks) {
          yield {
            text: () => c.textValue || '',
            functionCalls: () => c.functionCalls || [],
          };
        }
      })(),
    };
  }

  it('accumulates text chunks and emits onText per chunk', async () => {
    const onText = vi.fn();
    const onMessage = vi.fn();
    const onContentBlock = vi.fn();

    const stream = fakeStream([
      { textValue: 'Hello, ' },
      { textValue: 'world!' },
    ]);

    const final = await consumeGeminiStream(stream, { onText, onMessage, onContentBlock });

    expect(onText).toHaveBeenNthCalledWith(1, 'Hello, ');
    expect(onText).toHaveBeenNthCalledWith(2, 'world!');
    expect(final.role).toBe('assistant');
    expect(final.content).toEqual([{ type: 'text', text: 'Hello, world!' }]);
    expect(final.stop_reason).toBe('end_turn');
    expect(onMessage).toHaveBeenCalledWith({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello, world!' }],
    });
    expect(onContentBlock).toHaveBeenCalledWith({ type: 'text', text: 'Hello, world!' });
  });

  it('emits onToolUse and sets stop_reason="tool_use" when functionCalls arrive', async () => {
    const onText = vi.fn();
    const onToolUse = vi.fn();
    const onMessage = vi.fn();

    const stream = fakeStream([
      { textValue: "I'll check that." },
      { functionCalls: [{ name: 'list_my_orders', args: { next: true } }] },
    ]);

    const final = await consumeGeminiStream(stream, { onText, onToolUse, onMessage });

    expect(onText).toHaveBeenCalledWith("I'll check that.");
    expect(onToolUse).toHaveBeenCalledTimes(1);
    const toolBlock = onToolUse.mock.calls[0][0];
    expect(toolBlock.type).toBe('tool_use');
    expect(toolBlock.name).toBe('list_my_orders');
    expect(toolBlock.input).toEqual({ next: true });
    expect(toolBlock.id).toMatch(/^g_/); // synthesised id prefix

    expect(final.stop_reason).toBe('tool_use');
    expect(final.content).toEqual([
      { type: 'text', text: "I'll check that." },
      toolBlock,
    ]);
  });

  it('handles a stream with no text and just a function call', async () => {
    const onToolUse = vi.fn();
    const stream = fakeStream([
      { functionCalls: [{ name: 'get_my_profile', args: {} }] },
    ]);

    const final = await consumeGeminiStream(stream, { onToolUse });
    expect(final.stop_reason).toBe('tool_use');
    expect(final.content).toEqual([
      expect.objectContaining({ type: 'tool_use', name: 'get_my_profile' }),
    ]);
  });

  it('handles multiple function calls in a single chunk', async () => {
    const onToolUse = vi.fn();
    const stream = fakeStream([
      {
        functionCalls: [
          { name: 'list_my_orders', args: {} },
          { name: 'get_my_profile', args: {} },
        ],
      },
    ]);

    await consumeGeminiStream(stream, { onToolUse });
    expect(onToolUse).toHaveBeenCalledTimes(2);
  });

  it('survives a stream that emits no events at all (defensive)', async () => {
    const stream = fakeStream([]);
    const final = await consumeGeminiStream(stream, {});
    expect(final.role).toBe('assistant');
    expect(final.content).toEqual([]);
    expect(final.stop_reason).toBe('end_turn');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/services/gemini-translate.test.js -t consumeGeminiStream
```

Expected: FAIL — `consumeGeminiStream` is not exported.

---

## Task 10: Implement `consumeGeminiStream`

**Files:**
- Modify: `app/services/gemini.server.js`

- [ ] **Step 1: Add the helper above `createGeminiService`**

Add this function to `app/services/gemini.server.js`, above `createGeminiService`:

```js
/**
 * Consume a Gemini streaming response and emit Claude-shaped events through
 * the provided callbacks. Returns a `finalMessage` shaped like Claude's
 * (`role`, `content[]`, `stop_reason`) so the chat.jsx while-loop continues
 * to work unmodified.
 *
 * @param {{ stream: AsyncIterable<any> }} geminiStream  The object returned by
 *   model.generateContentStream(...). Its `.stream` property is an async
 *   iterator of chunks. Each chunk has `.text()` and `.functionCalls()` getters.
 * @param {Object} callbacks
 * @param {Function} [callbacks.onText]         Called per text delta.
 * @param {Function} [callbacks.onMessage]      Called once with the assembled assistant message.
 * @param {Function} [callbacks.onToolUse]      Called once per synthesised tool_use block.
 * @param {Function} [callbacks.onContentBlock] Called once per content block at end of stream.
 * @returns {Promise<{ role: 'assistant', content: Array, stop_reason: 'end_turn'|'tool_use' }>}
 */
export async function consumeGeminiStream(geminiStream, callbacks = {}) {
  const { onText, onMessage, onToolUse, onContentBlock } = callbacks;
  let textBuffer = '';
  const toolCalls = [];

  for await (const chunk of geminiStream.stream) {
    const text = typeof chunk.text === 'function' ? chunk.text() : '';
    if (text) {
      textBuffer += text;
      onText?.(text);
    }
    const fns = typeof chunk.functionCalls === 'function' ? chunk.functionCalls() : [];
    for (const fn of fns || []) {
      toolCalls.push(fn);
    }
  }

  const content = [];
  if (textBuffer) {
    const block = { type: 'text', text: textBuffer };
    content.push(block);
    onContentBlock?.(block);
  }
  for (const fn of toolCalls) {
    const block = {
      type: 'tool_use',
      id: `g_${cryptoRandomUUID()}`,
      name: fn.name,
      input: fn.args || {},
    };
    content.push(block);
    await onToolUse?.(block);
  }

  const finalMessage = { role: 'assistant', content };
  onMessage?.(finalMessage);

  return {
    ...finalMessage,
    stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
  };
}

// Local UUID helper. Wraps the global so we can stub it in tests if needed.
function cryptoRandomUUID() {
  // Node 20+: crypto.randomUUID exists on the global crypto object.
  return globalThis.crypto.randomUUID();
}
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npx vitest run tests/services/gemini-translate.test.js -t consumeGeminiStream
```

Expected: 5 tests pass.

- [ ] **Step 3: Run ALL tests in the file to confirm nothing regressed**

```bash
npx vitest run tests/services/gemini-translate.test.js
```

Expected: 15 tests pass (3 + 7 + 5).

- [ ] **Step 4: Commit**

```bash
git add app/services/gemini.server.js tests/services/gemini-translate.test.js
git commit -m "feat(gemini): consume streaming response with Claude-shaped callbacks"
```

---

## Task 11: Wire `createGeminiService` end-to-end

**Files:**
- Modify: `app/services/gemini.server.js`
- Modify: `app/services/config.server.js`

- [ ] **Step 1: Add `geminiModel` to `config.server.js`**

Open `app/services/config.server.js`. Find the `api:` block (around lines 7-12) and add the `geminiModel` line:

```js
  api: {
    defaultModel: 'claude-sonnet-4-20250514',
    geminiModel: 'gemini-2.5-flash',
    maxTokens: 2000,
    defaultPromptType: 'standardAssistant',
  },
```

- [ ] **Step 2: Replace the stub `createGeminiService` with the real implementation**

In `app/services/gemini.server.js`, REPLACE the existing stub `createGeminiService` at the bottom with:

```js
import { GoogleGenerativeAI } from "@google/generative-ai";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

/**
 * Create a Gemini service exposing the same interface as createClaudeService:
 *   - streamConversation({ messages, promptType, tools }, callbacks) => finalMessage
 *   - getSystemPrompt(promptType) => string
 *
 * The signature matches Claude's so app/services/llm.server.js can swap the
 * two transparently and chat.jsx + tool.server.js don't change.
 */
export function createGeminiService(apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Either set it in .env or set LLM_PROVIDER=claude."
    );
  }

  const client = new GoogleGenerativeAI(apiKey);

  const streamConversation = async (
    { messages, promptType = AppConfig.api.defaultPromptType, tools },
    callbacks = {}
  ) => {
    const systemInstruction = getSystemPrompt(promptType);
    const model = client.getGenerativeModel({
      model: AppConfig.api.geminiModel,
      systemInstruction,
    });

    const contents = toGeminiContents(messages);
    const geminiTools = toGeminiTools(tools);

    const request = {
      contents,
      generationConfig: { maxOutputTokens: AppConfig.api.maxTokens },
    };
    if (geminiTools) {
      request.tools = geminiTools;
    }

    const stream = await model.generateContentStream(request);
    return consumeGeminiStream(stream, callbacks);
  };

  const getSystemPrompt = (promptType) =>
    systemPrompts.systemPrompts[promptType]?.content ||
    systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

  return { streamConversation, getSystemPrompt };
}

export default { createGeminiService };
```

**IMPORTANT:** keep the existing `toGeminiTools`, `toGeminiContents`, and `consumeGeminiStream` named exports at the top of the file — they're tested and shouldn't be removed.

- [ ] **Step 3: Run all gemini tests to ensure helpers still pass**

```bash
npx vitest run tests/services/gemini-translate.test.js
```

Expected: 15 tests still pass.

- [ ] **Step 4: Smoke test the service constructor**

```bash
GEMINI_API_KEY="" node -e "import('./app/services/gemini.server.js').then(m => { try { m.createGeminiService(); console.log('no throw — BUG'); } catch (e) { console.log('OK:', e.message); } })"
```

Expected output: `OK: GEMINI_API_KEY is not set. Either set it in .env or set LLM_PROVIDER=claude.`

- [ ] **Step 5: Commit**

```bash
git add app/services/gemini.server.js app/services/config.server.js
git commit -m "feat(gemini): wire createGeminiService with streamConversation"
```

---

## Task 12: Switch `chat.jsx` to the dispatcher

**Files:**
- Modify: `app/routes/chat.jsx`

- [ ] **Step 1: Update the import (around line 9)**

In `app/routes/chat.jsx`, find:

```js
import { createClaudeService } from "../services/claude.server";
```

Replace with:

```js
import { createLlmService } from "../services/llm.server";
```

- [ ] **Step 2: Rename the local variable (around line 124)**

Find:

```js
const claudeService = createClaudeService();
```

Replace with:

```js
const llmService = createLlmService();
```

- [ ] **Step 3: Update the call site (around line 210)**

Find:

```js
      finalMessage = await claudeService.streamConversation(
```

Replace with:

```js
      finalMessage = await llmService.streamConversation(
```

- [ ] **Step 4: Verify nothing else in chat.jsx references `claudeService`**

```bash
grep -n "claudeService\|createClaudeService" app/routes/chat.jsx
```

Expected: no output (all references replaced).

- [ ] **Step 5: Syntax-check via esbuild**

```bash
npx esbuild --log-level=warning app/routes/chat.jsx > /dev/null
```

Expected: silent success (no errors printed).

- [ ] **Step 6: Run the dispatcher tests one more time**

```bash
npx vitest run tests/services/
```

Expected: all 20 tests pass (5 dispatcher + 15 gemini).

- [ ] **Step 7: Commit**

```bash
git add app/routes/chat.jsx
git commit -m "feat(chat): route LLM calls through createLlmService dispatcher"
```

---

## Task 13: README — document provider switching

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find a good insertion point**

Open `README.md`. Find the "Customizations" section (or similar near the top describing how to swap LLMs). If there's no such section, add the new one before "Deployment".

- [ ] **Step 2: Insert the new section**

Add this content:

```markdown
## Switching LLM providers

The chat agent supports two LLM providers, selected via the `LLM_PROVIDER` environment variable.

| Value | Provider | Default model | API key env var |
|---|---|---|---|
| `gemini` (default) | Google Gemini | `gemini-2.5-flash` | `GEMINI_API_KEY` |
| `claude` | Anthropic Claude | `claude-sonnet-4-20250514` | `CLAUDE_API_KEY` |

### Getting API keys

- **Gemini:** https://aistudio.google.com/app/apikey (free tier: 15 RPM, 1500 req/day on `gemini-2.5-flash`)
- **Claude:** https://console.anthropic.com (requires paid credits)

### Configuration

Set the relevant key in `.env`:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your_key>
```

Restart `npm run dev` for changes to take effect (env vars are only read at server boot).

### Switching providers manually

Provider switching is supported, but **conversation history is provider-specific** — Claude stores `tool_use`/`tool_result` blocks while Gemini's translation layer expects them to come from Claude's shape. To avoid mid-conversation format mismatches, **wipe existing conversations when switching providers**:

```bash
sqlite3 prisma/dev.sqlite "DELETE FROM Message; DELETE FROM Conversation;"
```

Then restart `npm run dev` and start a fresh chat.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: explain LLM provider switching and API key setup"
```

---

## Task 14: Manual end-to-end verification

**Files:** none (manual testing)

- [ ] **Step 1: Set up Gemini API key**

In `.env`, fill in `GEMINI_API_KEY` with a real key obtained from https://aistudio.google.com/app/apikey. Save the file.

- [ ] **Step 2: Wipe old conversation history**

```bash
sqlite3 prisma/dev.sqlite "DELETE FROM Message; DELETE FROM Conversation;"
```

This avoids any format collision with Claude-era messages.

- [ ] **Step 3: Start the dev server**

```bash
npm run dev
```

Wait for it to print the tunnel URL.

- [ ] **Step 4: Regression check — Claude still works**

Temporarily set `LLM_PROVIDER=claude` in `.env`, restart dev. In a fresh storefront chat, ask "hi". Verify Claude responds (assuming credits available — if not, skip this test and document it). Set `LLM_PROVIDER=gemini` again, restart.

- [ ] **Step 5: Gemini text path**

In the chat widget, ask "hi". Watch the dev server log for:

```
[chat] sending N unique tools to Claude: ...
```

(Note: the log message still says "Claude" — it's a historical name, harmless.) The chat should return a Gemini-generated reply.

- [ ] **Step 6: Gemini tool path — catalog**

Ask "search for snowboards". Expected:
- Log: `Calling storefront tool search_catalog ...`
- Product cards render in the widget.

- [ ] **Step 7: Gemini tool path — orders (Path B)**

If not signed in: click "click here to authorize" in chat. Complete OAuth. Then ask "show me my recent orders". Expected:
- Log: `[local-tool] list_my_orders → ok: N order(s), hasMore=...`
- Orders render in chat.

- [ ] **Step 8: Gemini multi-turn**

Ask "show me more". Expected: next page of orders renders (or "no more orders" if the customer has fewer than 4 total).

- [ ] **Step 9: Error surface**

Stop the dev server. In `.env`, set `GEMINI_API_KEY=invalid`. Restart dev. Ask any question in chat. Expected: a clear error event reaches the widget (not a silent hang). Restore the real key and restart.

- [ ] **Step 10: No commit**

This task is verification-only.

---

## Self-review notes

- **Spec coverage:** Every section of the spec maps to at least one task. Translation contract (spec §6) → Tasks 5-10. Architecture (spec §4) → Tasks 3-4 (dispatcher) + Tasks 5-11 (Gemini service). Error handling (spec §8) → Task 11 step 4 (constructor error) + Task 14 step 9 (runtime error).
- **No placeholders:** Every code step has full code. Every command shows expected output.
- **Type consistency:** `toGeminiTools`, `toGeminiContents`, `consumeGeminiStream` names match across tests and implementation. Tool block shape (`{type:'tool_use', id, name, input}`) consistent across `toGeminiContents` and `consumeGeminiStream`.
- **DRY/YAGNI:** No premature abstractions. Stop_reason is exactly 'end_turn'|'tool_use' (no extra states). Model id is hardcoded; not env-configurable.
- **TDD:** Every implementation task follows test-first. Tasks 3+5+7+9 write failing tests; Tasks 4+6+8+10 make them pass.
- **Commit cadence:** 6 commits across 14 tasks. Each commit is independently revertable.
