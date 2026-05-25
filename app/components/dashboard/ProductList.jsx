/**
 * Compact ranked product list. Section uses default padding so the heading
 * and row content have proper breathing room from the card edges. Rows are
 * separated by thin top borders (skipped on the first row) and have a
 * trailing chevron-right for navigation affordance.
 *
 * Used twice on the dashboard:
 *   • Trending searched products (metric: "N searches")
 *   • Recent purchased products (metric: "$P · time-ago")
 */
export function ProductList({ title, items, metric }) {
  return (
    <s-section heading={title}>
      {!items || items.length === 0 ? (
        <s-text color="subdued">No data yet</s-text>
      ) : (
        <s-stack>
          {items.map((item, idx) => (
            <s-clickable
              key={`${title}-${item.rank}`}
              borderStyle={idx === 0 ? 'none' : 'solid none none none'}
              border="base"
              paddingBlock="small"
              borderRadius="none"
            >
              <s-grid
                gridTemplateColumns="auto 1fr auto auto"
                gap="base"
                alignItems="center"
              >
                <s-text color="subdued" fontVariantNumeric="tabular-nums">
                  {item.rank}
                </s-text>
                <s-text>{item.name}</s-text>
                <s-text
                  color="subdued"
                  fontVariantNumeric="tabular-nums"
                >
                  {metric(item)}
                </s-text>
                <s-icon type="chevron-right" color="subdued" />
              </s-grid>
            </s-clickable>
          ))}
        </s-stack>
      )}
    </s-section>
  );
}
