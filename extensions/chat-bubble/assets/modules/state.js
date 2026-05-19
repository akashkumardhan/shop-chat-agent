/**
 * createState — subscribable state object with a fixed key schema.
 *
 * Usage:
 *   const state = createState({ isOpen: false, unreadCount: 0 });
 *   state.subscribe('isOpen', (v) => render(v));
 *   state.set('isOpen', true);   // triggers subscribers if value changed
 */
export function createState(initial) {
  const values = { ...initial };
  const subs = new Map();
  for (const k of Object.keys(initial)) subs.set(k, new Set());

  function assertKey(k) {
    if (!subs.has(k)) {
      throw new Error(`WidgetState: unknown key "${k}". Define it in createState's initial map.`);
    }
  }

  return {
    get(k) { assertKey(k); return values[k]; },
    set(k, v) {
      assertKey(k);
      if (values[k] === v) return;
      values[k] = v;
      for (const fn of subs.get(k)) fn(v);
    },
    subscribe(k, fn) {
      assertKey(k);
      subs.get(k).add(fn);
      return () => subs.get(k).delete(fn);
    },
  };
}

/** The default widget-state schema used by chat.js root. */
export const INITIAL_STATE = {
  isOpen: false,
  isMinimized: false,
  hasUnread: false,
  pendingMessagePreview: null,
  isOnline: true,
  rateLimitedUntil: 0,
  shopName: '',
  brandColor: '#5046E4',
};
