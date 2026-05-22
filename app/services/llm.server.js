/**
 * LLM Provider Dispatcher
 *
 * Reads `LLM_PROVIDER` from the environment and returns the matching
 * provider service. Both providers expose an identical interface:
 *   { streamConversation, getSystemPrompt }
 *
 * Default: gemini (free-tier friendly). Set LLM_PROVIDER=claude to use
 * the existing Anthropic path. Set anything else and we throw clearly.
 */
import { createClaudeService } from "./claude.server";
import { createGeminiService } from "./gemini.server";

export function createLlmService() {
  const raw = process.env.LLM_PROVIDER || "gemini";
  const provider = raw.toLowerCase();

  if (provider === "claude") return createClaudeService();
  if (provider === "gemini") return createGeminiService();

  throw new Error(
    `Unknown LLM_PROVIDER='${raw}'. Valid values: 'gemini', 'claude'.`
  );
}

export default { createLlmService };
