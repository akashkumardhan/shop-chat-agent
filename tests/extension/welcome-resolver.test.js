import { describe, it, expect } from 'vitest';
import { resolveWelcome } from '../../app/services/welcome.server.js';

describe('resolveWelcome', () => {
  it('returns a hero primary_action for PDP on size-sensitive pack', () => {
    const w = resolveWelcome({
      pageType: 'pdp',
      packId: 'jewelry',
      pageContext: { productType: 'ring', productTitle: 'Halo Solitaire' },
    });
    expect(w.primary_action).not.toBeNull();
    expect(w.primary_action.flow_id).toBe('sizing');
    expect(w.context_line).toContain('Halo Solitaire');
    expect(w.chips.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to conversational on unknown page type', () => {
    const w = resolveWelcome({ pageType: 'unknown', packId: 'jewelry' });
    expect(w.primary_action).toBeNull();
    expect(w.greeting).toBeTruthy();
    expect(w.chips.length).toBeGreaterThanOrEqual(2);
  });

  it('uses welcome-back greeting when hasPriorConvo is true', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'jewelry', hasPriorConvo: true });
    expect(w.greeting.toLowerCase()).toContain('welcome back');
  });

  it('returns sensible defaults for unknown pack', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'pack-that-does-not-exist' });
    expect(w.greeting).toBeTruthy();
    expect(Array.isArray(w.chips)).toBe(true);
  });

  it('omits the context_line when page_context lacks a product title', () => {
    const w = resolveWelcome({ pageType: 'pdp', packId: 'jewelry' });
    expect(w.context_line).toBeNull();
  });

  it('chips are <=24 chars per label', () => {
    const w = resolveWelcome({ pageType: 'home', packId: 'jewelry' });
    for (const c of w.chips) expect(c.label.length).toBeLessThanOrEqual(24);
  });
});
