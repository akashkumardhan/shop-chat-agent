import { useState } from 'react';
import { FULL_DUMMY_CLAUDE, FULL_DUMMY_GEMINI } from '../../data/mock-dashboard.server';

/**
 * Mock settings form: provider toggle + two read-only masked API key
 * fields. No persistence — Save shows a toast, Cancel resets local
 * state. Refresh resets everything (matches the loader's env-derived
 * defaults).
 *
 * Implementation note: Polaris web component element names below
 * (s-choice-list, s-choice, s-text-field, s-button, s-link) follow
 * Shopify's documented naming convention. If a name turns out to
 * differ in the live catalog, substitute the correct element while
 * keeping the visual outcome.
 */
export function SettingsForm({ activeProvider, claudeApiKey, geminiApiKey }) {
  const [provider, setProvider] = useState(activeProvider);
  const [claudeRevealed, setClaudeRevealed] = useState(false);
  const [geminiRevealed, setGeminiRevealed] = useState(false);

  function handleSave() {
    if (typeof shopify !== 'undefined' && shopify?.toast?.show) {
      shopify.toast.show('Settings saved', { isError: false });
    } else {
      // eslint-disable-next-line no-console
      console.log('Settings saved (toast unavailable)');
    }
  }

  function handleCancel() {
    setProvider(activeProvider);
    setClaudeRevealed(false);
    setGeminiRevealed(false);
  }

  function providerLabel(key, label) {
    return provider === key ? `${label} (active)` : label;
  }

  return (
    <>
      <s-section heading="Active provider">
        <s-text variant="bodySm" color="subdued">
          Choose which LLM powers the chat agent.
        </s-text>
        <s-choice-list
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <s-choice value="claude">{providerLabel('claude', 'Anthropic Claude')}</s-choice>
          <s-choice value="gemini">{providerLabel('gemini', 'Google Gemini')}</s-choice>
        </s-choice-list>
      </s-section>

      <s-section heading="Anthropic Claude API key">
        <s-stack gap="tight">
          <s-stack direction="inline" gap="tight" alignment="center">
            <s-text-field
              label="Anthropic Claude API key"
              labelHidden
              readOnly
              type={claudeRevealed ? 'text' : 'password'}
              value={claudeRevealed ? FULL_DUMMY_CLAUDE : claudeApiKey.masked}
            />
            <s-button onClick={() => setClaudeRevealed((v) => !v)}>
              {claudeRevealed ? 'Hide' : 'Reveal'}
            </s-button>
          </s-stack>
          <s-text variant="bodySm" color="subdued">
            Get your key at{' '}
            <s-link href="https://console.anthropic.com/" target="_blank">
              console.anthropic.com
            </s-link>
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Google Gemini API key">
        <s-stack gap="tight">
          <s-stack direction="inline" gap="tight" alignment="center">
            <s-text-field
              label="Google Gemini API key"
              labelHidden
              readOnly
              type={geminiRevealed ? 'text' : 'password'}
              value={geminiRevealed ? FULL_DUMMY_GEMINI : geminiApiKey.masked}
            />
            <s-button onClick={() => setGeminiRevealed((v) => !v)}>
              {geminiRevealed ? 'Hide' : 'Reveal'}
            </s-button>
          </s-stack>
          <s-text variant="bodySm" color="subdued">
            Get your key at{' '}
            <s-link href="https://aistudio.google.com/apikey" target="_blank">
              aistudio.google.com/apikey
            </s-link>
          </s-text>
        </s-stack>
      </s-section>

      <s-stack direction="inline" gap="tight" distribution="trailing">
        <s-button onClick={handleCancel}>Cancel</s-button>
        <s-button variant="primary" onClick={handleSave}>
          Save settings
        </s-button>
      </s-stack>
    </>
  );
}
