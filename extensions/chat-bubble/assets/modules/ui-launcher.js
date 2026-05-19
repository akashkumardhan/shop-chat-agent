import { el } from './dom.js';
import { createOrb } from './orb.js';

/**
 * Renders the launcher button. Click → state.set('isOpen', true).
 * Returns the DOM node.
 */
export function createLauncher({ state, sizeDesktop = 60, sizeMobile = 56 }) {
  const size = window.matchMedia('(max-width: 480px)').matches ? sizeMobile : sizeDesktop;
  const orb = createOrb({ size });

  const button = el('button', {
    class: 'swa-launcher',
    type: 'button',
    'aria-label': 'Open shopping assistant',
  }, orb);

  button.addEventListener('click', () => {
    state.set('isOpen', true);
  });

  // Re-size orb on viewport change.
  const mql = window.matchMedia('(max-width: 480px)');
  const handleViewportChange = () => {
    const newSize = mql.matches ? sizeMobile : sizeDesktop;
    orb.style.width = `${newSize}px`;
    orb.style.height = `${newSize}px`;
  };
  if (mql.addEventListener) mql.addEventListener('change', handleViewportChange);

  return button;
}
