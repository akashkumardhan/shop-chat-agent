import { describe, it, expect, vi } from 'vitest';
import {
  toGeminiTools,
  toGeminiContents,
  consumeGeminiStream,
  createGeminiService,
} from '../../app/services/gemini.server.js';

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

  // Regression: Gemini's parameters schema is the OpenAPI 3.0 Schema subset,
  // not full JSON Schema. It rejects keywords like additionalProperties,
  // $schema, $id, $ref. Shopify's Storefront MCP returns schemas with these,
  // so we must strip them at translation time.
  it('strips additionalProperties from the top level of parameters', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: { a: { type: 'string' } },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.additionalProperties).toBeUndefined();
    expect(params.properties.a).toEqual({ type: 'string' });
  });

  it('strips additionalProperties from nested property schemas (the actual Shopify update_cart failure)', () => {
    const result = toGeminiTools([
      {
        name: 'update_cart',
        description: 'x',
        input_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: { variant_id: { type: 'string' } },
              },
            },
            metadata: {
              type: 'object',
              additionalProperties: { type: 'string' },
              properties: { source: { type: 'string' } },
            },
          },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.properties.items.items.additionalProperties).toBeUndefined();
    expect(params.properties.items.items.properties.variant_id).toEqual({ type: 'string' });
    expect(params.properties.metadata.additionalProperties).toBeUndefined();
    expect(params.properties.metadata.properties.source).toEqual({ type: 'string' });
  });

  it('strips other Gemini-incompatible keywords ($schema, $id, $ref, patternProperties)', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          $id: 'foo-input',
          type: 'object',
          patternProperties: { '^x_': { type: 'string' } },
          properties: { a: { type: 'string', $ref: '#/definitions/A' } },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.$schema).toBeUndefined();
    expect(params.$id).toBeUndefined();
    expect(params.patternProperties).toBeUndefined();
    expect(params.properties.a.$ref).toBeUndefined();
    expect(params.properties.a.type).toBe('string');
  });

  it('preserves valid keywords (type, description, enum, format, items, required, anyOf)', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          required: ['mode'],
          properties: {
            mode: { type: 'string', enum: ['fast', 'slow'], description: 'speed' },
            tags: { type: 'array', items: { type: 'string' } },
            either: { anyOf: [{ type: 'string' }, { type: 'number' }] },
            when: { type: 'string', format: 'date-time' },
          },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.required).toEqual(['mode']);
    expect(params.properties.mode.enum).toEqual(['fast', 'slow']);
    expect(params.properties.mode.description).toBe('speed');
    expect(params.properties.tags.items).toEqual({ type: 'string' });
    expect(params.properties.either.anyOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    expect(params.properties.when.format).toBe('date-time');
  });

  it('does not mutate the input schema (defensive — must not corrupt the tool registry)', () => {
    const original = {
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: 'string' } },
    };
    const snapshot = JSON.parse(JSON.stringify(original));

    toGeminiTools([{ name: 'foo', description: 'x', input_schema: original }]);

    expect(original).toEqual(snapshot); // unchanged
    expect(original.additionalProperties).toBe(false); // still there in source
  });

  // Regression: Gemini rejects `required` on non-object schemas with
  //   "required: only allowed for OBJECT type"
  // and rejects names in `required` that aren't in `properties` with
  //   "required[N]: property is not defined"
  // The real-world failure was Shopify's update_cart tool where
  //   { add_items: { type: 'array', required: ['items'], items: {...} } }
  // — `items` is a JSON Schema keyword for array contents, not a property.
  it('drops `required` from non-object schemas (Gemini error: only allowed for OBJECT type)', () => {
    const result = toGeminiTools([
      {
        name: 'update_cart',
        description: 'x',
        input_schema: {
          type: 'object',
          properties: {
            add_items: {
              type: 'array',
              required: ['items'],   // <- ill-formed; Gemini rejects
              items: { type: 'object', properties: { variant_id: { type: 'string' } } },
            },
          },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.properties.add_items.required).toBeUndefined();
    // But the array's `items` schema is preserved
    expect(params.properties.add_items.items.type).toBe('object');
  });

  it('prunes from `required` any names not in `properties` (Gemini error: property is not defined)', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          required: ['a', 'b', 'ghost'],
          properties: {
            a: { type: 'string' },
            b: { type: 'number' },
            // ghost is NOT defined here — must be pruned from required
          },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.required).toEqual(['a', 'b']);
  });

  it('drops `required` entirely if pruning empties it', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          required: ['ghost'],
          properties: { a: { type: 'string' } },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.required).toBeUndefined();
    expect(params.properties.a).toEqual({ type: 'string' });
  });

  it('keeps `required` intact on a well-formed object schema', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          required: ['a'],
          properties: { a: { type: 'string' }, b: { type: 'number' } },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.required).toEqual(['a']);
  });

  it('handles nested objects with their own required arrays correctly', () => {
    const result = toGeminiTools([
      {
        name: 'foo',
        description: 'x',
        input_schema: {
          type: 'object',
          required: ['inner'],
          properties: {
            inner: {
              type: 'object',
              required: ['x', 'phantom'],   // phantom should be pruned
              properties: { x: { type: 'string' } },
            },
          },
        },
      },
    ]);
    const params = result[0].functionDeclarations[0].parameters;
    expect(params.required).toEqual(['inner']);
    expect(params.properties.inner.required).toEqual(['x']);
  });
});

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

describe('createGeminiService', () => {
  it('throws a helpful error if no API key is provided', () => {
    expect(() => createGeminiService('')).toThrow(/GEMINI_API_KEY/);
    expect(() => createGeminiService(undefined)).toThrow(/GEMINI_API_KEY/);
  });

  it('returns an object exposing streamConversation + getSystemPrompt when key is provided', () => {
    // Use a fake key — we won't make any real API calls in this test.
    const svc = createGeminiService('fake-key-for-unit-test');
    expect(typeof svc.streamConversation).toBe('function');
    expect(typeof svc.getSystemPrompt).toBe('function');
  });

  it('getSystemPrompt returns the standard prompt content', () => {
    const svc = createGeminiService('fake-key-for-unit-test');
    const p = svc.getSystemPrompt('standardAssistant');
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(50);
  });
});
