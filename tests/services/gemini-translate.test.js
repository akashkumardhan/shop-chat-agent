import { describe, it, expect, vi } from 'vitest';
import { toGeminiTools, toGeminiContents, consumeGeminiStream } from '../../app/services/gemini.server.js';

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
