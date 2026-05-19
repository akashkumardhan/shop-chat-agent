import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function renderMarkdown(src) {
  if (src == null) return '';
  const str = typeof src === 'string' ? src : String(src);

  // Downgrade markdown headers to bold paragraphs.
  const noHeaders = str.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  // Strip markdown image syntax.
  const noImages = noHeaders.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  const rawHtml = marked.parse(noImages, { async: false });

  const safe = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['style', 'script', 'iframe', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  });

  return safe.replace(/<a\b([^>]*)>/g, (m, attrs) => {
    const hasTarget = /target\s*=/.test(attrs);
    const hasRel = /rel\s*=/.test(attrs);
    const extra = (hasTarget ? '' : ' target="_blank"') + (hasRel ? '' : ' rel="noopener nofollow"');
    return `<a${attrs}${extra}>`;
  });
}
