import { describe, it, expect } from 'vitest';
import { createState } from '../../extensions/chat-bubble/assets/modules/state.js';

describe('createState', () => {
  it('exposes initial values', () => {
    const s = createState({ isOpen: false, unreadCount: 0 });
    expect(s.get('isOpen')).toBe(false);
    expect(s.get('unreadCount')).toBe(0);
  });

  it('updates a value via set', () => {
    const s = createState({ isOpen: false });
    s.set('isOpen', true);
    expect(s.get('isOpen')).toBe(true);
  });

  it('notifies subscribers when a value changes', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    let lastValue;
    s.subscribe('isOpen', (v) => { calls++; lastValue = v; });
    s.set('isOpen', true);
    expect(calls).toBe(1);
    expect(lastValue).toBe(true);
  });

  it('does not notify when the value is unchanged', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    s.subscribe('isOpen', () => calls++);
    s.set('isOpen', false);
    expect(calls).toBe(0);
  });

  it('supports unsubscribing', () => {
    const s = createState({ isOpen: false });
    let calls = 0;
    const unsubscribe = s.subscribe('isOpen', () => calls++);
    s.set('isOpen', true);
    unsubscribe();
    s.set('isOpen', false);
    expect(calls).toBe(1);
  });

  it('throws when get/set/subscribe is called with an unknown key', () => {
    const s = createState({ isOpen: false });
    expect(() => s.get('bogus')).toThrow();
    expect(() => s.set('bogus', 1)).toThrow();
    expect(() => s.subscribe('bogus', () => {})).toThrow();
  });
});
