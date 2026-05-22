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
 * Each `input_schema` is sanitised first because Gemini's `parameters` is
 * the OpenAPI 3.0 Schema *subset* — not full JSON Schema. Common keywords
 * like `additionalProperties` (which Shopify's MCP returns on update_cart
 * and others) trigger a 400 from generativelanguage.googleapis.com.
 *
 * @param {Array<{name:string, description:string, input_schema:object}>} tools
 * @returns {Array|null} A Gemini tools array, or null if no tools.
 */
export function toGeminiTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: sanitizeSchemaForGemini(
          t.input_schema || { type: 'object', properties: {} }
        ),
      })),
    },
  ];
}

/**
 * JSON-Schema keywords Gemini's API rejects. These must be stripped from
 * any schema passed as `parameters` in a function declaration. The set
 * mirrors the OpenAPI 3.0 Schema subset Google supports. See
 *   https://ai.google.dev/api/caching#Schema
 * If Gemini complains about another keyword in the future, add it here.
 */
const GEMINI_INCOMPATIBLE_KEYWORDS = new Set([
  'additionalProperties',
  'patternProperties',
  'unevaluatedProperties',
  'dependentSchemas',
  'dependentRequired',
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'if',
  'then',
  'else',
  'not',
  'allOf',
  'oneOf',
  // intentionally NOT stripping: anyOf, enum, format, type, description,
  // properties, items, required, nullable, minimum, maximum, minLength,
  // maxLength — these are all valid in Gemini.
]);

/**
 * Recursively clone a JSON Schema, dropping keywords Gemini doesn't accept,
 * and fixing up `required` arrays that violate Gemini's stricter rules.
 *
 * Three transformations:
 *   1. Drop blanket-incompatible keywords (GEMINI_INCOMPATIBLE_KEYWORDS)
 *   2. Drop `required` from any schema where `type !== 'object'`
 *      (Gemini: "required: only allowed for OBJECT type")
 *   3. For object schemas, prune any name in `required` that isn't in
 *      `properties` (Gemini: "required[N]: property is not defined")
 *      If pruning empties the list, drop `required` entirely.
 *
 * Never mutates the input; safe to call on the live tool registry's schemas.
 *
 * @param {*} schema
 * @returns {*}
 */
export function sanitizeSchemaForGemini(schema) {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);

  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (GEMINI_INCOMPATIBLE_KEYWORDS.has(k)) continue;
    if (k === 'required') {
      // Defer — handle below after we've seen `type` and `properties`.
      continue;
    }
    out[k] = sanitizeSchemaForGemini(v);
  }

  const pruned = pruneRequiredForGemini(schema);
  if (pruned !== undefined) {
    out.required = pruned;
  }

  return out;
}

/**
 * Decide what to emit for `required` based on the source schema's type
 * and properties. Returns the filtered array, or undefined to omit the
 * field entirely.
 *
 * Gemini's rules:
 *   - `required` is only valid on object schemas
 *   - Every name in `required` must also be a key in `properties`
 *
 * @param {Object} schema  The *source* schema (not the sanitized output)
 * @returns {Array<string>|undefined}
 */
function pruneRequiredForGemini(schema) {
  if (!Array.isArray(schema.required)) return undefined;
  if (schema.type !== 'object') return undefined;
  const propertyNames = Object.keys(schema.properties || {});
  const filtered = schema.required.filter((name) => propertyNames.includes(name));
  return filtered.length > 0 ? filtered : undefined;
}

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

  // Build the full assistant content (text + all tool_use blocks) BEFORE
  // firing any callback. We need the complete message in hand so onMessage
  // can store it in conversation history with the tool_use blocks already
  // present — matching Claude SDK's contract where the message event
  // fires with the full assistant content before tool execution begins.
  const content = [];
  if (textBuffer) {
    const block = { type: 'text', text: textBuffer };
    content.push(block);
    onContentBlock?.(block);
  }
  for (const fn of toolCalls) {
    content.push({
      type: 'tool_use',
      id: `g_${cryptoRandomUUID()}`,
      name: fn.name,
      input: fn.args || {},
    });
  }

  const finalMessage = { role: 'assistant', content };

  // CALL ORDER IS CRITICAL — see the regression test in gemini-translate.test.js.
  //
  // 1. onMessage first → chat.jsx appends the assistant message (with tool_use
  //    blocks) to conversationHistory.
  // 2. onToolUse next, per tool block → chat.jsx runs each tool and appends
  //    the resulting tool_result to conversationHistory.
  //
  // Reverse this order and the history becomes [user, tool_result, assistant],
  // which breaks toGeminiContents on the *next* turn: when translating the
  // tool_result the idToName lookup misses (because we haven't walked the
  // assistant tool_use yet) and Gemini receives a functionResponse with
  // name='unknown'. The model errors or returns garbage and the product/cart
  // SSE event never fires.
  onMessage?.(finalMessage);

  for (const block of content) {
    if (block.type === 'tool_use') {
      await onToolUse?.(block);
    }
  }

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

  const getSystemPrompt = (promptType) =>
    systemPrompts.systemPrompts[promptType]?.content ||
    systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

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

    console.log(
      `[gemini] request: contents=${contents.length} msg(s), tools=${geminiTools ? geminiTools[0].functionDeclarations.length : 0}, model=${AppConfig.api.geminiModel}, sys-prompt=${systemInstruction.length} chars`
    );

    let stream;
    try {
      stream = await model.generateContentStream(request);
    } catch (e) {
      console.error("[gemini] generateContentStream threw:", e?.message || e);
      throw e;
    }

    const finalMessage = await consumeGeminiStream(stream, callbacks);

    // Pull the *full* response object for metadata that the streaming
    // chunks don't carry (finish reason, safety ratings, token usage,
    // prompt-level block reasons). If Gemini returned nothing visible
    // (no text, no functionCall) this is the place to see why.
    try {
      const full = await stream.response;
      const cand = full?.candidates?.[0];
      const finishReason = cand?.finishReason;
      const blockReason = full?.promptFeedback?.blockReason;
      const safetyRatings = cand?.safetyRatings || full?.promptFeedback?.safetyRatings;
      const usage = full?.usageMetadata;
      const partCount = cand?.content?.parts?.length || 0;

      const summary = [
        `finishReason=${finishReason || 'n/a'}`,
        `partCount=${partCount}`,
        blockReason ? `blockReason=${blockReason}` : null,
        safetyRatings && safetyRatings.length ? `safety=${JSON.stringify(safetyRatings.filter(r => r.blocked || r.probability && r.probability !== 'NEGLIGIBLE'))}` : null,
        usage ? `tokens(in=${usage.promptTokenCount},out=${usage.candidatesTokenCount},total=${usage.totalTokenCount})` : null,
      ].filter(Boolean).join(' ');

      console.log(`[gemini] response: ${summary}`);

      // If the response is empty (no text, no tools) AND the finishReason
      // explains why, surface that to the chat as an actionable error.
      if (finalMessage.content.length === 0 && finishReason && finishReason !== 'STOP') {
        const reason = blockReason || finishReason;
        const block = {
          type: 'text',
          text: `[Gemini returned an empty response: ${reason}. Try rephrasing your question, or check the server log for safety/policy details.]`,
        };
        finalMessage.content.push(block);
        callbacks.onContentBlock?.(block);
        callbacks.onText?.(block.text);
      }
    } catch (e) {
      console.error("[gemini] failed to read response metadata:", e?.message || e);
    }

    return finalMessage;
  };

  return { streamConversation, getSystemPrompt };
}

export default { createGeminiService };
