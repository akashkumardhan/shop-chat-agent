import { useState } from 'react';

/**
 * Mock settings form using the canonical Shopify settings template:
 * each section is a two-column layout — left column has the heading and
 * description, right column has the form controls. Save/Cancel use
 * <s-button-group>. <s-text-field readOnly> is used for the API keys
 * since Reveal is a toggle (full dummy ↔ masked) rather than a true
 * password entry.
 *
 * The full dummy key strings are passed in via the `claudeApiKey.full`
 * and `geminiApiKey.full` fields of the loader data — we do not import
 * them from the *.server.js file because that would violate React
 * Router's server-only-module boundary and break client-side rendering.
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

  return (
    <>
      {/* Active provider */}
      <s-section>
        <s-grid
          gridTemplateColumns="@container (inline-size <= 720px) 1fr, 1fr 2fr"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-heading>Active provider</s-heading>
            <s-text color="subdued">
              Choose which LLM powers the chat agent. Changing the active
              provider here is a mock — production wiring still uses the
              LLM_PROVIDER environment variable.
            </s-text>
          </s-stack>
          <s-choice-list
            label="Active provider"
            labelAccessibilityVisibility="exclusive"
            name="provider"
            onChange={(e) => {
              const next = e.currentTarget?.values?.[0];
              if (next) setProvider(next);
            }}
          >
            <s-choice value="claude" selected={provider === 'claude'}>
              {provider === 'claude' ? 'Anthropic Claude (active)' : 'Anthropic Claude'}
            </s-choice>
            <s-choice value="gemini" selected={provider === 'gemini'}>
              {provider === 'gemini' ? 'Google Gemini (active)' : 'Google Gemini'}
            </s-choice>
          </s-choice-list>
        </s-grid>
      </s-section>

      {/* Anthropic Claude API key */}
      <s-section>
        <s-grid
          gridTemplateColumns="@container (inline-size <= 720px) 1fr, 1fr 2fr"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-heading>Anthropic Claude API key</s-heading>
            <s-text color="subdued">
              Get your key at{' '}
              <s-link href="https://console.anthropic.com/" target="_blank">
                console.anthropic.com
              </s-link>
              .
            </s-text>
          </s-stack>
          <s-stack gap="small">
            <s-stack direction="inline" gap="small" alignItems="end">
              <s-text-field
                label="Anthropic Claude API key"
                labelAccessibilityVisibility="exclusive"
                readOnly
                value={claudeRevealed ? claudeApiKey.full : claudeApiKey.masked}
              />
              <s-button
                onClick={() => setClaudeRevealed((v) => !v)}
                icon={claudeRevealed ? 'hide' : 'view'}
              >
                {claudeRevealed ? 'Hide' : 'Reveal'}
              </s-button>
            </s-stack>
          </s-stack>
        </s-grid>
      </s-section>

      {/* Google Gemini API key */}
      <s-section>
        <s-grid
          gridTemplateColumns="@container (inline-size <= 720px) 1fr, 1fr 2fr"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-heading>Google Gemini API key</s-heading>
            <s-text color="subdued">
              Get your key at{' '}
              <s-link href="https://aistudio.google.com/apikey" target="_blank">
                aistudio.google.com/apikey
              </s-link>
              .
            </s-text>
          </s-stack>
          <s-stack gap="small">
            <s-stack direction="inline" gap="small" alignItems="end">
              <s-text-field
                label="Google Gemini API key"
                labelAccessibilityVisibility="exclusive"
                readOnly
                value={geminiRevealed ? geminiApiKey.full : geminiApiKey.masked}
              />
              <s-button
                onClick={() => setGeminiRevealed((v) => !v)}
                icon={geminiRevealed ? 'hide' : 'view'}
              >
                {geminiRevealed ? 'Hide' : 'Reveal'}
              </s-button>
            </s-stack>
          </s-stack>
        </s-grid>
      </s-section>

      {/* Action row */}
      <s-stack direction="inline" justifyContent="end" gap="small">
        <s-button-group>
          <s-button onClick={handleCancel}>Cancel</s-button>
          <s-button variant="primary" onClick={handleSave} icon="save">
            Save settings
          </s-button>
        </s-button-group>
      </s-stack>
    </>
  );
}
