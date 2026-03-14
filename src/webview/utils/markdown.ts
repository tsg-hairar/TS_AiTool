// ===================================================
// Markdown Renderer — עיבוד Markdown עם הדגשת syntax
// ===================================================
// משתמש ב-marked, highlight.js ו-DOMPurify
// ===================================================

import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

// -------------------------------------------------
// Configure highlight.js
// -------------------------------------------------

/** Highlight code with language detection */
function highlightCode(code: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      // fall through to auto-detect
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------------------------------------
// Direction detection helper
// -------------------------------------------------

/**
 * Detect text direction based on the first strong-direction character.
 * Returns 'rtl' if the first strong character is RTL (Hebrew, Arabic, etc.),
 * otherwise returns 'ltr'.
 */
function detectTextDirection(text: string): 'ltr' | 'rtl' {
  // Match the first character with a strong directional property
  // RTL: Hebrew (\u0590-\u05FF), Arabic (\u0600-\u06FF, \u0750-\u077F),
  //      and other RTL scripts
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const ltrRegex = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

  for (const ch of text) {
    if (rtlRegex.test(ch)) return 'rtl';
    if (ltrRegex.test(ch)) return 'ltr';
  }
  return 'ltr';
}

// -------------------------------------------------
// Custom marked renderer (RTL-aware)
// -------------------------------------------------
// marked v12 uses positional arguments, not token objects.

const renderer = new Renderer();

// Code blocks — with copy button and language badge
renderer.code = function (code: string, infostring: string | undefined): string {
  const lang = (infostring || '').match(/^\S*/)?.[0] || '';
  const highlighted = highlightCode(code, lang);
  const langLabel = lang || 'code';
  // Encode raw code as base64 to safely embed in data attribute
  const rawEncoded = btoa(unescape(encodeURIComponent(code)));

  return `<div class="code-block-wrapper">
  <div class="code-block-header">
    <span class="code-block-lang">${escapeHtml(langLabel)}</span>
    <button class="code-block-copy" data-code="${rawEncoded}" title="Copy" aria-label="Copy code">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span class="code-copy-label">Copy</span>
    </button>
  </div>
  <pre class="hljs"><code class="language-${escapeHtml(lang)}">${highlighted}</code></pre>
</div>`;
};

// Inline code
renderer.codespan = function (text: string): string {
  return `<code class="inline-code">${text}</code>`;
};

// Links — open externally via VS Code
renderer.link = function (href: string, title: string | null | undefined, text: string): string {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(href || '')}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// Tables — auto-detect direction based on content
renderer.table = function (header: string, body: string): string {
  // Strip HTML tags to get plain text for direction detection
  const plainText = (header + body).replace(/<[^>]*>/g, '').trim();
  const dir = detectTextDirection(plainText);
  return `<div class="table-wrapper" dir="${dir}"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

// Blockquotes — RTL right border
renderer.blockquote = function (quote: string): string {
  return `<blockquote class="md-blockquote">${quote}</blockquote>`;
};

// Lists — RTL padding class
renderer.list = function (body: string, ordered: boolean, start: number): string {
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
  return `<${tag} class="md-list"${startAttr}>${body}</${tag}>`;
};

// -------------------------------------------------
// Configure marked options
// -------------------------------------------------

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

// -------------------------------------------------
// DOMPurify configuration
// -------------------------------------------------

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote',
    'pre', 'code',
    'a',
    'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
    'img',
    'input',
    'svg', 'path', 'rect', 'circle', 'line',
    'button',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'alt', 'src',
    'class', 'id', 'dir', 'style',
    'data-code',
    'aria-label',
    'type', 'checked', 'disabled',
    // SVG attributes
    'viewBox', 'width', 'height', 'fill', 'stroke',
    'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'd', 'x', 'y', 'rx', 'ry',
    'start',
  ],
  ALLOW_DATA_ATTR: true,
};

// -------------------------------------------------
// Public API
// -------------------------------------------------

/**
 * Parse Markdown content to sanitized HTML with syntax highlighting.
 *
 * @param content - Raw Markdown string
 * @returns Sanitized HTML string
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  // Parse markdown to HTML
  const rawHtml = marked.parse(content, { async: false }) as string;

  // Sanitize to prevent XSS
  const clean = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);

  return clean;
}

/**
 * Attach copy-button click handlers to all code blocks in a container.
 * Call this after inserting rendered markdown into the DOM.
 *
 * @param container - The DOM element containing rendered markdown
 */
export function attachCopyHandlers(container: HTMLElement): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.code-block-copy');
  buttons.forEach((btn) => {
    // Prevent duplicate listeners
    if (btn.dataset.listenerAttached) return;
    btn.dataset.listenerAttached = 'true';

    btn.addEventListener('click', () => {
      const encoded = btn.dataset.code;
      if (!encoded) return;

      try {
        const code = decodeURIComponent(escape(atob(encoded)));
        void navigator.clipboard.writeText(code).then(() => {
          // Visual feedback
          const label = btn.querySelector('.code-copy-label');
          if (label) {
            const original = label.textContent;
            label.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
              label.textContent = original;
              btn.classList.remove('copied');
            }, 2000);
          }
        }).catch(() => {
          // Clipboard API may fail in some environments
        });
      } catch {
        // Clipboard API may fail in some environments
      }
    });
  });
}
