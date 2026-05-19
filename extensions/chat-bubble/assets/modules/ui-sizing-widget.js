import { el } from './dom.js';

export function createSizingWidget(block, { onComplete } = {}) {
  const steps = block.steps || [];
  const answers = {};
  let currentIdx = 0;

  const node = el('div', { class: 'swa-sizing', role: 'region', 'aria-label': block.title || 'Size guide' });

  const title = el('div', { class: 'swa-sizing-title' }, block.title || 'Size guide');
  const stepsRow = el('div', { class: 'swa-sizing-steps' });
  for (let i = 0; i < steps.length; i++) stepsRow.appendChild(el('div', { class: 'swa-sizing-step-dot' }));

  const summariesWrap = el('div');
  const activeWrap = el('div');
  const fallbackWrap = el('div');

  if (block.fallback) {
    fallbackWrap.className = 'swa-sizing-fallback';
    fallbackWrap.append(
      "Don't know yours? ",
      el('a', { href: block.fallback.url, target: '_blank', rel: 'noopener' }, block.fallback.label || 'Print a sizer →'),
    );
  }

  node.append(title, stepsRow, summariesWrap, activeWrap, fallbackWrap);

  function renderActive() {
    activeWrap.innerHTML = '';
    if (currentIdx >= steps.length) {
      activeWrap.appendChild(el('div', { class: 'swa-sizing-complete' }, '✓ All set — finding your match…'));
      onComplete && onComplete(answers);
      return;
    }
    const step = steps[currentIdx];
    activeWrap.appendChild(el('div', { class: 'swa-sizing-question' }, step.question));
    const chipsRow = el('div', { class: 'swa-sizing-chips' });
    for (const opt of step.options || []) {
      const chip = el('button', { class: 'swa-sizing-chip', type: 'button' }, opt.label);
      chip.addEventListener('click', () => {
        answers[step.id] = opt.value;
        const label = step.label || step.id.charAt(0).toUpperCase() + step.id.slice(1);
        const summary = el('div', { class: 'swa-sizing-summary' },
          el('strong', null, label), ': ', opt.label
        );
        summariesWrap.appendChild(summary);
        stepsRow.children[currentIdx].dataset.state = 'done';
        currentIdx += 1;
        if (currentIdx < steps.length) stepsRow.children[currentIdx].dataset.state = 'active';
        renderActive();
      });
      chipsRow.appendChild(chip);
    }
    activeWrap.appendChild(chipsRow);
  }

  if (steps.length > 0) stepsRow.children[0].dataset.state = 'active';
  renderActive();

  return { node };
}
