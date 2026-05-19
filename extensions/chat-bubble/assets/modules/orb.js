/**
 * Orb — animated gradient nebula component.
 * Renders at 16 / 22 / 32 / 60+ px. Sparkle omitted at 16px (favicon size).
 */
export function createOrb({ size, paused = false } = {}) {
  if (typeof size !== 'number' || size <= 0) {
    throw new Error(`createOrb: size must be a positive number, got ${size}`);
  }

  const el = document.createElement('div');
  el.className = 'swa-orb';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  if (paused) el.classList.add('swa-orb-paused');

  if (size >= 22) {
    const sparkle = document.createElement('span');
    sparkle.className = 'swa-orb-sparkle';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.textContent = '✦';
    el.appendChild(sparkle);
  }

  return el;
}
