import { formatDeltaPercent } from './format.js';

/**
 * Single stat tile: label, large value, optional trend badge, optional hint.
 * Renders as an s-section so it gets card chrome consistent with the rest
 * of the admin.
 */
export function StatCard({ label, value, hint, delta }) {
  const hasDelta = typeof delta === 'number';
  const tone = !hasDelta ? null : delta > 0 ? 'success' : delta < 0 ? 'critical' : 'info';

  return (
    <s-section padding="base">
      <s-stack gap="extra-tight">
        <s-text variant="bodySm" color="subdued">{label}</s-text>
        <s-stack direction="inline" gap="tight" alignment="center">
          <s-heading>{value}</s-heading>
          {hasDelta ? (
            <s-badge tone={tone}>{formatDeltaPercent(delta)}</s-badge>
          ) : null}
        </s-stack>
        {hint ? (
          <s-text variant="bodySm" color="subdued">{hint}</s-text>
        ) : null}
      </s-stack>
    </s-section>
  );
}
