/**
 * A single metric tile rendered inside a metrics-card composition. Designed
 * to be placed inside a parent <s-section> + <s-grid>, separated from
 * sibling tiles by <s-divider direction="block">.
 *
 * Visual hierarchy:
 *   [icon] subdued label
 *   BIG VALUE   [tone badge with arrow icon]
 *   subdued hint
 */
export function StatCard({ icon, label, value, hint, delta }) {
  const hasDelta = typeof delta === 'number';
  const tone = !hasDelta
    ? null
    : delta > 0
    ? 'success'
    : delta < 0
    ? 'critical'
    : 'info';
  const deltaIcon = !hasDelta
    ? null
    : delta > 0
    ? 'arrow-up'
    : delta < 0
    ? 'arrow-down'
    : null;

  return (
    <s-clickable
      borderRadius="base"
      paddingBlock="small-300"
      paddingInline="small-200"
    >
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {icon ? <s-icon type={icon} color="subdued" /> : null}
          <s-text color="subdued">{label}</s-text>
        </s-stack>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>{value}</s-heading>
          {hasDelta ? (
            <s-badge tone={tone} icon={deltaIcon || undefined}>
              {`${Math.abs(delta).toFixed(1)}%`}
            </s-badge>
          ) : null}
        </s-stack>
        {hint ? <s-text color="subdued">{hint}</s-text> : null}
      </s-stack>
    </s-clickable>
  );
}
