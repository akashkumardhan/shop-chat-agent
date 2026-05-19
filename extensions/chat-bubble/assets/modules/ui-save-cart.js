import { el } from './dom.js';

export function createSaveCartCard({ onSubmit }) {
  const node = el('div', { class: 'swa-save-cart' });
  node.appendChild(el('div', { class: 'swa-save-cart-title' }, 'Save your cart for later'));
  node.appendChild(el('div', { class: 'swa-save-cart-sub' }, "We'll email you a link — pick up where you left off."));

  const emailField = el('div', { class: 'swa-save-cart-field' });
  const emailInput = el('input', { type: 'email', placeholder: 'you@example.com', required: 'true', 'aria-label': 'Email' });
  emailField.appendChild(emailInput);

  const smsField = el('div', { class: 'swa-save-cart-field', style: 'display:none' });
  const smsInput = el('input', { type: 'tel', placeholder: '+1 555-1234', 'aria-label': 'Phone (optional)' });
  smsField.appendChild(smsInput);

  const smsToggle = el('button', { class: 'swa-save-cart-sms-toggle', type: 'button' }, 'Add SMS reminder ▾');
  smsToggle.addEventListener('click', () => {
    smsField.style.display = smsField.style.display === 'none' ? 'block' : 'none';
    smsToggle.textContent = smsField.style.display === 'none' ? 'Add SMS reminder ▾' : 'Hide SMS reminder ▴';
  });

  const consent = el('div', { class: 'swa-save-cart-consent' },
    'By saving, you agree to receive a cart reminder. No marketing.');

  const submit = el('button', { class: 'swa-save-cart-submit', type: 'submit' }, 'Send me the link');
  const success = el('div', { class: 'swa-save-cart-success', style: 'display:none' }, '✓ Sent — check your email.');

  const form = el('form', null, emailField, smsToggle, smsField, consent, submit, success);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      await onSubmit({ email, sms: smsInput.value.trim() || null });
      form.querySelectorAll('input, button').forEach(elN => { elN.disabled = true; });
      success.style.display = 'block';
      submit.textContent = 'Sent';
    } catch {
      submit.disabled = false;
      submit.textContent = 'Try again';
    }
  });

  node.appendChild(form);
  return node;
}
