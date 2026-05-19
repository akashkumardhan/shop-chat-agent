import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../extensions/chat-bubble/assets/modules/markdown.js';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const html = renderMarkdown('**hi**');
    expect(html).toContain('<strong>hi</strong>');
  });

  it('renders unordered lists', () => {
    const html = renderMarkdown('- one\n- two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders links', () => {
    const html = renderMarkdown('[shop](https://example.com)');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
  });

  it('strips script tags', () => {
    const html = renderMarkdown('hi<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips h1/h2/h3 headings (downgrades to bold paragraph)', () => {
    const html = renderMarkdown('# big');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('<h2');
    expect(html).not.toContain('<h3');
  });

  it('strips markdown images', () => {
    const html = renderMarkdown('![alt](http://x.png)');
    expect(html).not.toContain('<img');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('').trim()).toBe('');
    expect(renderMarkdown(null).trim()).toBe('');
    expect(renderMarkdown(undefined).trim()).toBe('');
  });

  it('preserves inline code', () => {
    const html = renderMarkdown('Use `npm test`.');
    expect(html).toContain('<code>npm test</code>');
  });
});
