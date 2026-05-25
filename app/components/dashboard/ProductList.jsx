/**
 * Compact, text-only ranked product list. Used twice on the dashboard:
 * once for "Trending searched products" and once for "Recent purchased
 * products". The metric prop is a function so each instance picks its
 * own right-aligned text.
 */
export function ProductList({ title, items, metric }) {
  return (
    <s-section heading={title}>
      {!items || items.length === 0 ? (
        <s-text color="subdued">No data yet</s-text>
      ) : (
        <s-stack gap="tight">
          {items.map((item) => (
            <s-stack
              key={`${title}-${item.rank}`}
              direction="inline"
              distribution="equalSpacing"
              alignment="center"
            >
              <s-stack direction="inline" gap="tight">
                <s-text color="subdued">{item.rank}</s-text>
                <s-text>{item.name}</s-text>
              </s-stack>
              <s-text variant="bodySm" color="subdued">{metric(item)}</s-text>
            </s-stack>
          ))}
        </s-stack>
      )}
    </s-section>
  );
}
