import { describe, it, expect, vi } from 'vitest';
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
