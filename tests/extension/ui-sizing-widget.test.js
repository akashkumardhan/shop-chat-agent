import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSizingWidget } from '../../extensions/chat-bubble/assets/modules/ui-sizing-widget.js';

const BLOCK = {
  type: 'sizing_widget',
  flow_id: 'ring',
  title: 'Ring Size Finder',
  steps: [
    { id: 'width', question: 'Width?', options: [{ value: 'slim', label: 'Slim' }, { value: 'std', label: 'Standard' }] },
    { id: 'size_in_brand', question: 'Size in another brand?', options: [{ value: '6', label: '6' }, { value: '7', label: '7' }] },
  ],
  fallback: { label: 'Print sizer', url: '/p.pdf' },
};

describe('sizing widget', () => {
  let onComplete;
  let widget;

  beforeEach(() => {
    document.body.innerHTML = '';
    onComplete = vi.fn();
    widget = createSizingWidget(BLOCK, { onComplete });
    document.body.appendChild(widget.node);
  });

  it('shows the first question initially', () => {
    expect(widget.node.textContent).toContain('Width?');
  });

  it('selecting an option in step 1 advances to step 2', () => {
    const slim = widget.node.querySelectorAll('.swa-sizing-chip')[0];
    slim.click();
    expect(widget.node.textContent).toContain('Size in another brand?');
  });

  it('completed steps show a one-line summary', () => {
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    expect(widget.node.querySelector('.swa-sizing-summary').textContent).toContain('Width');
  });

  it('calls onComplete with all answers after the last step', () => {
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    widget.node.querySelectorAll('.swa-sizing-chip')[0].click();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ width: 'slim', size_in_brand: '6' });
  });

  it('shows fallback link', () => {
    const link = widget.node.querySelector('.swa-sizing-fallback a');
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Print sizer');
  });
});
