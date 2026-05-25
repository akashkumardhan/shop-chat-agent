import { useState } from 'react';

/**
 * Settings form (mock UI for demo purposes).
 *
 * Layout follows the canonical Shopify settings template:
 *  - Provider selection uses two clickable provider cards (more visual
 *    than a radio list — each card shows an avatar, name, description,
 *    and an "Active" badge on the selected option).
 *  - Each API key section is a two-column grid: left column has the
 *    heading + helper link; right column has the read-only masked
 *    field + Reveal/Hide button + last-4 hint.
 *  - Save/Cancel use <s-button-group> aligned to the trailing edge.
 *  - Bottom footer-help section points to documentation.
 *
 * Full dummy keys are passed in via loader data
 * (claudeApiKey.full, geminiApiKey.full) — we do NOT import them
 * from the server-only mock-dashboard.server.js module.
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
      {/* Provider selection */}
      <s-section heading="LLM provider">
        <s-stack gap="base">
          <s-text color="subdued">
            Choose which large language model powers the chat agent. The
            active provider is highlighted below.
          </s-text>
          <s-grid
            gridTemplateColumns="@container (inline-size <= 720px) 1fr, 1fr 1fr"
            gap="base"
          >
            <ProviderCard
              initials="C"
              name="Anthropic Claude"
              model="claude-sonnet-4"
              description="Strong reasoning, long-form responses, and rich tool use."
              active={provider === 'claude'}
              onSelect={() => setProvider('claude')}
            />
            <ProviderCard
              initials="G"
              name="Google Gemini"
              model="gemini-2.5-flash"
              description="Fast, generous free tier — ideal for development and demos."
              active={provider === 'gemini'}
              onSelect={() => setProvider('gemini')}
            />
          </s-grid>
        </s-stack>
      </s-section>

      {/* Anthropic Claude API key */}
      <ApiKeyCard
        provider="Anthropic Claude"
        helperLinkLabel="console.anthropic.com"
        helperLinkHref="https://console.anthropic.com/"
        keyMasked={claudeApiKey.masked}
        keyFull={claudeApiKey.full}
        keyLastFour={claudeApiKey.lastFour}
        revealed={claudeRevealed}
        onToggleReveal={() => setClaudeRevealed((v) => !v)}
      />

      {/* Google Gemini API key */}
      <ApiKeyCard
        provider="Google Gemini"
        helperLinkLabel="aistudio.google.com/apikey"
        helperLinkHref="https://aistudio.google.com/apikey"
        keyMasked={geminiApiKey.masked}
        keyFull={geminiApiKey.full}
        keyLastFour={geminiApiKey.lastFour}
        revealed={geminiRevealed}
        onToggleReveal={() => setGeminiRevealed((v) => !v)}
      />

      {/* Action row */}
      <s-stack direction="inline" justifyContent="end" gap="small">
        <s-button-group>
          <s-button onClick={handleCancel}>Cancel</s-button>
          <s-button variant="primary" onClick={handleSave} icon="save">
            Save settings
          </s-button>
        </s-button-group>
      </s-stack>

      {/* Footer help */}
      <s-section>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type="question-circle" color="subdued" />
          <s-text color="subdued">
            Need help configuring your chat agent? See the{' '}
            <s-link href="https://shopify.dev/docs/apps" target="_blank">
              Shopify app documentation
            </s-link>
            .
          </s-text>
        </s-stack>
      </s-section>
    </>
  );
}

/**
 * Visual card for a single LLM provider. Whole card is clickable.
 * Active card gets a subdued background and an "Active" success badge.
 */
function ProviderCard({ initials, name, model, description, active, onSelect }) {
  return (
    <s-clickable
      onClick={onSelect}
      border="base"
      borderRadius="base"
      padding="base"
      background={active ? 'subdued' : 'base'}
      accessibilityLabel={`Select ${name}`}
    >
      <s-stack gap="small">
        <s-stack
          direction="inline"
          gap="small"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-avatar initials={initials} size="base" alt={name} />
            <s-stack gap="none">
              <s-text type="strong">{name}</s-text>
              <s-text color="subdued">{model}</s-text>
            </s-stack>
          </s-stack>
          {active ? (
            <s-badge tone="success" icon="check-circle">Active</s-badge>
          ) : (
            <s-badge tone="info">Available</s-badge>
          )}
        </s-stack>
        <s-text color="subdued">{description}</s-text>
      </s-stack>
    </s-clickable>
  );
}

/**
 * A single API-key section: heading + Configured badge + helper text on
 * the left, masked field + Reveal/Hide button + last-4 hint on the right.
 */
function ApiKeyCard({
  provider,
  helperLinkLabel,
  helperLinkHref,
  keyMasked,
  keyFull,
  keyLastFour,
  revealed,
  onToggleReveal,
}) {
  return (
    <s-section>
      <s-grid
        gridTemplateColumns="@container (inline-size <= 720px) 1fr, 1fr 2fr"
        gap="base"
      >
        <s-stack gap="small-200">
          <s-heading>{provider} API key</s-heading>
          <s-text color="subdued">
            Get your key at{' '}
            <s-link href={helperLinkHref} target="_blank">
              {helperLinkLabel}
            </s-link>
            .
          </s-text>
        </s-stack>
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small" alignItems="end">
            <s-text-field
              label={`${provider} API key`}
              labelAccessibilityVisibility="exclusive"
              readOnly
              value={revealed ? keyFull : keyMasked}
            />
            <s-button
              onClick={onToggleReveal}
              icon={revealed ? 'hide' : 'view'}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </s-button>
          </s-stack>
          <s-text color="subdued">
            Last 4 characters:{' '}
            <s-text type="strong" fontVariantNumeric="tabular-nums">
              {keyLastFour}
            </s-text>
          </s-text>
        </s-stack>
      </s-grid>
    </s-section>
  );
}
