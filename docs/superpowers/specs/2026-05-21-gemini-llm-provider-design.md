# Design — Pluggable LLM Provider (Claude + Gemini)

**Status:** Approved 2026-05-21
**Author:** akumar + Claude (paired)
**Audience:** Engineer implementing the change
**Repo:** `shop-chat-agent`

---

## 1. Problem

The chat agent currently calls the Anthropic API via `@anthropic-ai/sdk`. The merchant ran out of Claude credits mid-dev, blocking testing. Switching to Google Gemini (which has a generous free tier — 15 RPM / 1,500 requests/day on `gemini-2.5-flash`) keeps dev moving and gives the merchant a credible production fallback.

## 2. Goals

1. Toggle LLM provider via a single env var (`LLM_PROVIDER=gemini` or `claude`).
2. Default to `gemini` after this change ships (free-tier friendly).
3. **Zero changes** to `chat.jsx`, `tool.server.js`, the DB schema, and all Path B tool services (`orderOps`, `profile`, `returns`). They continue to think in Claude-shaped messages.
4. Preserve every existing capability: streaming text, tool calling (multi-turn loop), system prompt selection (`standardAssistant` / `enthusiasticAssistant`).
5. Keep the Claude code path working so it's a regression-safe rollback if Gemini misbehaves.

## 3. Non-goals

- Translating *existing* conversation history (DB rows) between provider formats. Switching providers is a manual operation that requires wiping `Conversation` + `Message` rows.
- Provider-agnostic abstractions like the Vercel `ai` SDK. Direct SDK usage is enough.
- Streaming token-by-token for tool arguments (Gemini emits them in a single chunk; cosmetic difference acceptable).
- Multiple Gemini models via env var. `gemini-2.5-flash` is hardcoded; add a config later if needed.

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ app/routes/chat.jsx                                     │
│   import { createLlmService } from "../services/llm…";  │
│   const llm = createLlmService();                       │
│   await llm.streamConversation({ messages, promptType,  │
│                                  tools }, callbacks);   │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ app/services/llm.server.js  (NEW — thin dispatcher)     │
│   if (LLM_PROVIDER === 'claude') return claudeService   │
│   else                          return geminiService    │
└─────┬───────────────────────────────┬───────────────────┘
      │                               │
      ▼                               ▼
 claude.server.js              gemini.server.js  (NEW)
   (unchanged)                   - same exported API
                                 - translates Claude shape
                                   ↔ Gemini native on the
                                   message + tool boundaries
```

Both provider services expose the exact same contract:

```js
service.streamConversation(
  { messages, promptType, tools },
  { onText, onMessage, onToolUse, onContentBlock }
) => Promise<finalMessage>
```

`finalMessage.stop_reason` is `'end_turn'` or `'tool_use'` (matching Claude's shape). This is what `chat.jsx` loops on.

## 5. Files

### 5.1 NEW — `app/services/llm.server.js`

Single function. ~20 lines.

```js
import { createClaudeService } from "./claude.server";
import { createGeminiService } from "./gemini.server";

const PROVIDER = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

export function createLlmService() {
  if (PROVIDER === "claude") {
    return createClaudeService();
  }
  if (PROVIDER === "gemini") {
    return createGeminiService();
  }
  throw new Error(
    `Unknown LLM_PROVIDER='${process.env.LLM_PROVIDER}'. Use 'gemini' or 'claude'.`
  );
}
```

### 5.2 NEW — `app/services/gemini.server.js`

Wraps `@google/generative-ai`. Provides translation layer.

**Exports:** `createGeminiService()` returning `{ streamConversation, getSystemPrompt }` matching `claude.server.js`'s shape.

**Internal helpers:**
- `toGeminiContents(messages)` — Claude `messages` array → Gemini `contents` array
- `toGeminiTools(tools)` — Claude `{name, description, input_schema}[]` → Gemini `[{functionDeclarations: [...]}]`
- `fromGeminiResponse(streamResult)` — translates Gemini's streaming response into the four callbacks + a finalMessage

**Translation rules** (in `toGeminiContents`):

| Claude message | Gemini equivalent |
|---|---|
| `{role:'user', content:'hi'}` (string) | `{role:'user', parts:[{text:'hi'}]}` |
| `{role:'user', content:[{type:'tool_result', tool_use_id, content}]}` | `{role:'user', parts:[{functionResponse:{name:<lookup>, response:{content}}}]}` |
| `{role:'assistant', content:[{type:'text',text}, {type:'tool_use',id,name,input}]}` | `{role:'model', parts:[{text}, {functionCall:{name, args:input}}]}` |

The `<lookup>` for `functionResponse.name` is done by walking back through messages to find the assistant turn that emitted the matching `tool_use.id` and reading its `name`. This is necessary because Gemini's `functionResponse` is keyed by tool name, not by call id.

**Stream handling** — Gemini SDK exposes `model.generateContentStream(...)` which returns an async iterator. We:
1. Iterate chunks; accumulate text into a buffer, emit `onText(delta)` per chunk that has text
2. When a chunk has `functionCall`, synthesise a Claude-shaped `{type:'tool_use', id: nanoid(), name, input: args}` block and add it to the in-progress assistant message; emit `onToolUse(content)` once at end of stream
3. After the stream completes, emit `onMessage({role:'assistant', content:[...blocks]})`
4. Compute `stop_reason`: if any tool_use blocks were emitted → `'tool_use'`, else → `'end_turn'`
5. Resolve the promise with `{role:'assistant', content, stop_reason}`

`onContentBlock` fires once per accumulated text block at stream end (parity with Claude).

### 5.3 EDIT — `app/services/config.server.js`

Add Gemini model id:

```js
api: {
  defaultModel: 'claude-sonnet-4-20250514',
  geminiModel: 'gemini-2.5-flash',
  maxTokens: 2000,
  defaultPromptType: 'standardAssistant',
}
```

### 5.4 EDIT — `app/routes/chat.jsx`

One-line import swap:

```diff
- import { createClaudeService } from "../services/claude.server";
+ import { createLlmService } from "../services/llm.server";
…
- const claudeService = createClaudeService();
+ const llmService = createLlmService();
…
- finalMessage = await claudeService.streamConversation(
+ finalMessage = await llmService.streamConversation(
```

The variable rename is cosmetic; the contract is identical so behaviour is unchanged.

### 5.5 EDIT — `package.json`

Add dependency:

```json
"@google/generative-ai": "^0.21.0"
```

### 5.6 EDIT — `.env`

Add lines:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your_key>
```

Existing `CLAUDE_API_KEY` stays so the user can switch back without re-entering.

### 5.7 EDIT — `README.md`

Add section "Switching LLM providers" documenting:
- Two supported values for `LLM_PROVIDER`
- Where to get a Gemini API key (https://aistudio.google.com/app/apikey)
- Manual step required when switching: wipe `Conversation` and `Message` rows in `prisma/dev.sqlite`

## 6. Translation contract — detail

`gemini.server.js` is the only place that knows about Gemini's message shape. Everything else in the app stays Claude-shaped.

### 6.1 Tool definitions

Input (from `mcpClient.tools`):

```js
{
  name: "list_my_orders",
  description: "List the customer's recent orders...",
  input_schema: {
    type: "object",
    properties: { next: { type: "boolean" } }
  }
}
```

Output for Gemini:

```js
{
  functionDeclarations: [
    {
      name: "list_my_orders",
      description: "List the customer's recent orders...",
      parameters: {
        type: "object",
        properties: { next: { type: "boolean" } }
      }
    },
    // ... all other tools
  ]
}
```

Note Gemini wraps all declarations in **one** entry under `tools: [{functionDeclarations: [...]}]`.

### 6.2 Messages — out (DB → Gemini)

The DB stores messages as Claude saw them. On each call, we rebuild the Gemini `contents` array:

```js
function toGeminiContents(messages) {
  const out = [];
  // Build an id→name lookup for tool_use blocks we've seen, so we can name
  // the matching functionResponse correctly.
  const idToName = new Map();

  for (const m of messages) {
    if (m.role === 'user') {
      const parts = [];
      const content = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }];
      for (const block of content) {
        if (block.type === 'text') {
          parts.push({ text: block.text || block });
        } else if (block.type === 'tool_result') {
          const name = idToName.get(block.tool_use_id) || 'unknown';
          parts.push({ functionResponse: { name, response: { content: block.content } } });
        }
      }
      out.push({ role: 'user', parts });
    } else if (m.role === 'assistant') {
      const parts = [];
      for (const block of m.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          idToName.set(block.id, block.name);
          parts.push({ functionCall: { name: block.name, args: block.input } });
        }
      }
      out.push({ role: 'model', parts });
    }
  }
  return out;
}
```

### 6.3 Messages — in (Gemini stream → Claude shape for storage)

```js
async function streamFromGemini(geminiStream, callbacks) {
  const content = [];                       // Claude-shaped assistant content
  let currentText = '';
  const toolCalls = [];

  for await (const chunk of geminiStream.stream) {
    // text deltas
    const text = chunk.text();
    if (text) {
      currentText += text;
      callbacks.onText?.(text);
    }
    // function calls (Gemini sometimes splits these across chunks; collect them)
    const fns = chunk.functionCalls() || [];
    for (const fn of fns) {
      toolCalls.push(fn);
    }
  }

  if (currentText) {
    const block = { type: 'text', text: currentText };
    content.push(block);
    callbacks.onContentBlock?.(block);
  }
  for (const fn of toolCalls) {
    const block = {
      type: 'tool_use',
      id: `g_${crypto.randomUUID()}`,   // built-in Node 20+; no new dep
      name: fn.name,
      input: fn.args,
    };
    content.push(block);
    await callbacks.onToolUse?.(block);
  }

  const assistantMessage = { role: 'assistant', content };
  callbacks.onMessage?.(assistantMessage);

  return {
    ...assistantMessage,
    stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
  };
}
```

**`crypto.randomUUID()`** (built into Node 20+, which `package.json` requires via `"engines": {"node": ">=20.10"}`) is used to synthesise a tool_use id because Gemini doesn't provide a stable id for each functionCall. The synthesised id is only used to thread tool_result → tool_use within a single in-memory turn; it doesn't need to be persistent across requests. No new dependency required.

## 7. Data flow — worked example

User asks *"show me my latest order"*:

1. `chat.jsx` loads conversation history (Claude-shaped) from DB.
2. `createLlmService()` returns `geminiService` (because `LLM_PROVIDER=gemini`).
3. `streamConversation({messages: [...], tools: mcpClient.tools, promptType: 'standardAssistant'}, callbacks)` called.
4. `gemini.server.js` translates: messages → Gemini contents, tools → functionDeclarations.
5. `model.generateContentStream({contents, tools, systemInstruction})` called.
6. Gemini streams: text "I'll check your latest order…" → `onText('I'll check…')`
7. Gemini emits functionCall: `{name:'list_my_orders', args:{}}` → `gemini.server.js` synthesises Claude block `{type:'tool_use', id:'_g_abc123', name:'list_my_orders', input:{}}` → `onToolUse(block)`.
8. `chat.jsx` calls `mcpClient.callTool('list_my_orders', {})` → returns Claude-shaped `{content: [{type:'text', text: '{"orders":[...]}'}]}`.
9. `tool.server.js` appends tool_result to history (Claude shape, unchanged code).
10. Loop iteration 2 — translation runs again, this time the assistant message has `functionCall` and the new user message has `functionResponse`.
11. Gemini sees the result, streams the final reply.
12. `stop_reason='end_turn'`, loop exits. Orders render in the widget.

## 8. Error handling

| Failure mode | Where | Behaviour |
|---|---|---|
| `GEMINI_API_KEY` missing | gemini.server.js constructor | Throw `"Set GEMINI_API_KEY in .env or set LLM_PROVIDER=claude."` at first `createGeminiService()` call. |
| Gemini quota exceeded / 429 | inside `generateContentStream` | Bubble up through existing SSE error handler — same UX as the current Claude billing error. |
| Translation hit unknown content block | `toGeminiContents` | `console.warn('[gemini] skipping unknown block', block.type)` and continue — don't crash on stale Claude history. |
| Schema mismatch in tool definitions | `toGeminiTools` | Gemini's `parameters` accepts JSON Schema; identical to Claude's `input_schema`. No translation hazard expected. |
| `LLM_PROVIDER` set to anything else | `llm.server.js` | Throw with clear message listing valid values. |

## 9. Manual test plan

After implementation:

1. **Regression — Claude still works.** Set `LLM_PROVIDER=claude`. Restart dev. Ask "search for snowboards" → catalog tool fires → products render. Verify the existing flow is intact.
2. **Gemini text path.** Set `LLM_PROVIDER=gemini`. Wipe `Conversation` + `Message` DB rows. Restart dev. Ask "hi" → Gemini responds with text.
3. **Gemini tool path — catalog.** Ask "search for snowboards" → `[chat] sending N unique tools` log shows tools present → tool call fires → products render.
4. **Gemini tool path — orders (Path B end-to-end).** Sign in via OAuth, ask "show me my recent orders" → `list_my_orders` tool fires → log shows `[local-tool] list_my_orders → ok: 3 order(s)` → orders render.
5. **Gemini multi-turn.** Ask follow-up "show me more" → cursor advances → next 3 orders render.
6. **Gemini error surfacing.** Temporarily set `GEMINI_API_KEY=invalid` → restart dev → ask anything → SSE error event with a meaningful message reaches the widget (not a silent failure).

## 10. Implementation order

1. Add `@google/generative-ai` dep, `GEMINI_API_KEY` and `LLM_PROVIDER` env vars.
2. Build `gemini.server.js` with `streamConversation` stub that returns a hardcoded text response (no tool support yet). Wire `llm.server.js`. Verify regression test 2 passes.
3. Add the `toGeminiContents` translation. Verify multi-turn text-only conversation works.
4. Add the `toGeminiTools` translation + functionCall handling. Verify tool path (test 3) passes.
5. Verify Path B end-to-end (test 4) and pagination (test 5).
6. Verify error surface (test 6).
7. Update README.

## 11. Open questions / known limitations

- **Mid-conversation provider switching breaks the conversation.** Documented in README. v2 could add `Conversation.provider` to avoid this.
- **Gemini's free tier may rate-limit during burst testing.** 15 RPM is generous but possible to hit. Document upgrade path.
- **Gemini doesn't return token usage in the same shape as Anthropic.** Out of scope; we don't surface token counts to the user today.
- **Tool argument schemas with `enum` / `format`** — Gemini supports JSON Schema but with subtle differences (e.g. it may reject `additionalProperties: false`). If a tool schema breaks, the workaround is to simplify the schema in the tool definition. None of the current Path B tool schemas are unusual.
