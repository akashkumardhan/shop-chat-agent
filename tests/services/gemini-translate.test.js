import { describe, it, expect, vi } from 'vitest';
import { toGeminiTools, toGeminiContents } from '../../app/services/gemini.server.js';

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
