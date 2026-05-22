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
