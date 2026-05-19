import { describe, it, expect, beforeEach } from 'vitest';
import { createOrb } from '../../extensions/chat-bubble/assets/modules/orb.js';

describe('createOrb', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a div with the swa-orb class', () => {
    const orb = createOrb({ size: 32 });
    expect(orb.tagName).toBe('DIV');
    expect(orb.classList.contains('swa-orb')).toBe(true);
  });

  it('applies the size as width and height inline style', () => {
    const orb = createOrb({ size: 60 });
    expect(orb.style.width).toBe('60px');
    expect(orb.style.height).toBe('60px');
  });

  it('renders a sparkle for sizes >= 22px', () => {
    const orb22 = createOrb({ size: 22 });
    const orb16 = createOrb({ size: 16 });
    expect(orb22.querySelector('.swa-orb-sparkle')).not.toBeNull();
    expect(orb16.querySelector('.swa-orb-sparkle')).toBeNull();
  });

  it('pauses animation when paused: true', () => {
    const orb = createOrb({ size: 60, paused: true });
    expect(orb.classList.contains('swa-orb-paused')).toBe(true);
  });

  it('throws for non-positive size', () => {
    expect(() => createOrb({ size: 0 })).toThrow();
    expect(() => createOrb({ size: -1 })).toThrow();
  });
});
