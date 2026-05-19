import { el } from './dom.js';

export function createResumeCard({ summary, ageLabel, onContinue, onStartFresh }) {
  const node = el('div', { class: 'swa-resume' });
  node.appendChild(el('div', { class: 'swa-resume-title' }, 'Pick up where you left off?'));
  node.appendChild(el('div', { class: 'swa-resume-sub' }, summary || `Last chat ${ageLabel || 'recently'}.`));
  const cont = el('button', { class: 'primary', type: 'button' }, 'Continue');
  const fresh = el('button', { class: 'ghost', type: 'button' }, 'Start fresh');
  cont.addEventListener('click', () => onContinue && onContinue());
  fresh.addEventListener('click', () => onStartFresh && onStartFresh());
  node.appendChild(el('div', { class: 'swa-resume-actions' }, cont, fresh));
  return node;
}

export function createDayDivider(label) {
  return el('div', { class: 'swa-day-divider' }, `— ${label} —`);
}
