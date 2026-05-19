import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComposer } from '../../extensions/chat-bubble/assets/modules/ui-composer.js';

describe('createComposer', () => {
  let onSubmit;
  let composer;

  beforeEach(() => {
    document.body.innerHTML = '';
    onSubmit = vi.fn();
    composer = createComposer({ onSubmit });
    document.body.appendChild(composer.node);
  });

  it('renders a textarea and a send button', () => {
    expect(composer.node.querySelector('textarea')).not.toBeNull();
    expect(composer.node.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('send button is disabled when input is empty', () => {
    const btn = composer.node.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(true);
  });

  it('send button is enabled when input has non-whitespace text', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const btn = composer.node.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(false);
  });

  it('Enter submits non-empty input', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    ta.dispatchEvent(e);
    expect(onSubmit).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('Shift+Enter does NOT submit', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    const e = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
    ta.dispatchEvent(e);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter with empty input does not submit', () => {
    const ta = composer.node.querySelector('textarea');
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    ta.dispatchEvent(e);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('input value is cleared after submit', () => {
    const ta = composer.node.querySelector('textarea');
    ta.value = 'hello';
    ta.dispatchEvent(new Event('input'));
    composer.submit();
    expect(ta.value).toBe('');
  });
});
