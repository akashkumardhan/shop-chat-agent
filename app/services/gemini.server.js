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

export function createGeminiService() {
  throw new Error("createGeminiService not yet implemented");
}
