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
 * Recursively clone a JSON Schema, dropping keywords Gemini doesn't accept.
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
    out[k] = sanitizeSchemaForGemini(v);
  }
  return out;
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

    const stream = await model.generateContentStream(request);
    return consumeGeminiStream(stream, callbacks);
  };

  return { streamConversation, getSystemPrompt };
}

export default { createGeminiService };
