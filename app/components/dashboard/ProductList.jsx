/**
 * Compact ranked product list. Rows use <s-clickable> for hover affordance
 * and a chevron, with thin top borders providing row separation. Empty
 * state is a subdued message.
 *
 * Used twice on the dashboard:
 *   • Trending searched products (metric: "N searches")
 *   • Recent purchased products (metric: "$P · time-ago")
 */
export function ProductList({ title, items, metric }) {
  return (
    <s-section heading={title} padding="none">
      {!items || items.length === 0 ? (
        <s-stack padding="base">
          <s-text color="subdued">No data yet</s-text>
        </s-stack>
      ) : (
        <s-stack>
          {items.map((item, idx) => (
            <s-clickable
              key={`${title}-${item.rank}`}
              borderStyle={idx === 0 ? 'none' : 'solid none none none'}
              border="base"
              paddingInline="base"
              paddingBlock="small"
            >
              <s-grid
                gridTemplateColumns="auto 1fr auto auto"
                gap="small"
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
