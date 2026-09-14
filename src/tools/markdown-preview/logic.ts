import { Marked } from 'marked';

import {
  resolveLanguage,
  tokenize,
  type Token,
  type TokenKind,
} from '@/tools/markdown-preview/highlight';

export const MAX_INPUT_CHARS = 200_000;
export const AUTOSAVE_DEBOUNCE_MS = 800;

export const TOKEN_CLASSES: Readonly<Record<TokenKind, string>> = {
  plain: '',
  comment: 'text-muted italic',
  string: 'text-success',
  number: 'text-accent',
  keyword: 'text-accent font-medium',
  tag: 'text-accent',
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function renderTokens(tokens: Token[]): string {
  return tokens
    .map((token) => {
      const escaped = escapeHtml(token.value);
      const className = TOKEN_CLASSES[token.kind];
      return className.length === 0
        ? escaped
        : `<span class="${className}">${escaped}</span>`;
    })
    .join('');
}

export function highlightCode(source: string, lang: string | undefined): string {
  const language = lang === undefined ? null : resolveLanguage(lang);
  if (language === null) return escapeHtml(source);

  return renderTokens(tokenize(source, language));
}

// An instance of its own rather than the global marked, so the renderer
// override cannot leak into anything else that imports the library.
const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const language = lang === undefined ? null : resolveLanguage(lang);
      const className = language === null ? '' : ` class="language-${language}"`;

      return `<pre><code${className}>${highlightCode(text, lang)}</code></pre>\n`;
    },
  },
});

/**
 * Markdown to HTML, with nothing trusted yet. Every caller has to put the
 * result through the sanitizer before it reaches a page: Markdown allows raw
 * HTML by design, so a pasted document can carry a script tag.
 */
export function toHtml(markdown: string): string {
  return parser.parse(markdown, { async: false });
}

export interface MarkdownStats {
  words: number;
  characters: number;
  lines: number;
}

export function countLines(markdown: string): number {
  return markdown.length === 0 ? 0 : markdown.split('\n').length;
}

export type TaskState = 'none' | 'open' | 'done';

/** How many task list items a document has, and how many are ticked. */
export function countTasks(markdown: string): { total: number; done: number } {
  const matches = markdown.match(/^[ \t]*[-*+] \[[ xX]\]/gm) ?? [];
  const done = matches.filter((line) => /\[[xX]\]$/.test(line)).length;

  return { total: matches.length, done };
}

export function isTooLong(markdown: string): boolean {
  return markdown.length > MAX_INPUT_CHARS;
}

/** A full document, ready to save, rather than the fragment the preview shows. */
export function toDocument(bodyHtml: string, title: string): string {
  return [
    '<!doctype html>',
    '<html lang="th">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '</head>',
    '<body>',
    bodyHtml,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
