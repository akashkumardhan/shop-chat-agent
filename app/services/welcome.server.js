/**
 * Welcome resolver.
 *
 * Maps (page_type, pack_id, page_context, has_prior_convo) → a welcome bundle
 * the client uses to render the welcome panel.
 */

const DEFAULT_GREETING = 'Hi — what brings you in?';
const RETURNING_GREETING = 'Welcome back.';

const PACK_TABLES = {
  jewelry: {
    pdp: () => ({
      primary_action: {
        flow_id: 'sizing',
        label: 'Help with sizing',
        subtitle: 'Walk through ring sizing in under a minute.',
        button_text: 'Start the size guide →',
      },
      chips: [
        { intent: 'compare', label: 'Compare similar', isPrimary: false },
        { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
        { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
      ],
      context_template: (c) => c && c.productTitle ? `Looking at the ${c.productTitle}` : null,
    }),
    cart: () => ({
      primary_action: {
        flow_id: 'walk_cart',
        label: 'Walk through your cart',
        subtitle: 'Anything making you hesitate? I can help.',
        button_text: 'Talk it through →',
      },
      chips: [
        { intent: 'returns_policy', label: 'Returns policy', isPrimary: false },
        { intent: 'save_for_later', label: 'Save for later', isPrimary: false },
      ],
    }),
    collection: () => ({
      primary_action: null,
      chips: [
        { intent: 'narrow_by_price', label: 'Narrow by price', isPrimary: true },
        { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
        { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
      ],
    }),
  },
};

const DEFAULT_CHIPS = [
  { intent: 'gift_mode', label: "It's a gift", isPrimary: false },
  { intent: 'bestsellers', label: 'Show bestsellers', isPrimary: false },
  { intent: 'returns_policy', label: 'Returns policy', isPrimary: false },
];

export function resolveWelcome({ pageType, packId, pageContext = {}, hasPriorConvo = false } = {}) {
  const greeting = hasPriorConvo ? RETURNING_GREETING : DEFAULT_GREETING;

  const packTable = PACK_TABLES[packId] || {};
  const entry = packTable[pageType];

  if (!entry) {
    return {
      greeting,
      context_line: null,
      primary_action: null,
      chips: DEFAULT_CHIPS.slice(0, 3),
    };
  }

  const built = entry(pageContext);
  const context_line = typeof built.context_template === 'function'
    ? built.context_template(pageContext)
    : null;

  return {
    greeting,
    context_line,
    primary_action: built.primary_action,
    chips: (built.chips || DEFAULT_CHIPS).slice(0, 4),
  };
}
