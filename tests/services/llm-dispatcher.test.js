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
