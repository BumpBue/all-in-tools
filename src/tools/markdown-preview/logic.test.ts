import { describe, expect, it } from 'vitest';

import {
  LANGUAGE_ALIASES,
  resolveLanguage,
  tokenize,
} from '@/tools/markdown-preview/highlight';
import {
  MAX_INPUT_CHARS,
  countLines,
  countTasks,
  escapeHtml,
  highlightCode,
  isTooLong,
  toDocument,
  toHtml,
} from '@/tools/markdown-preview/logic';

describe('toHtml', () => {
  it('turns headings and paragraphs into elements', () => {
    const html = toHtml('# Title\n\nSome text');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Some text</p>');
  });

  it('renders a GFM table', () => {
    const html = toHtml('| a | b |\n| - | - |\n| 1 | 2 |');

    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders a task list with its checkboxes', () => {
    const html = toHtml('- [x] done\n- [ ] not yet');

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('keeps Thai text intact', () => {
    expect(toHtml('สวัสดีครับ')).toContain('สวัสดีครับ');
  });

  it('leaves raw HTML in the output for the sanitizer to deal with', () => {
    // Markdown allows raw HTML by design; removing it is not the parser's job.
    expect(toHtml('<script>alert(1)</script>')).toContain('<script>');
  });

  it('renders a code block with the language on it', () => {
    const html = toHtml('```js\nconst a = 1;\n```');

    expect(html).toContain('<pre><code class="language-javascript">');
    expect(html).toContain('const');
  });

  it('renders a code block with no language at all', () => {
    const html = toHtml('```\nplain text\n```');

    expect(html).toContain('<pre><code>');
    expect(html).toContain('plain text');
  });

  it('escapes HTML inside a code block rather than running it', () => {
    const html = toHtml('```\n<script>alert(1)</script>\n```');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('highlightCode', () => {
  it('colours keywords, strings and comments', () => {
    const html = highlightCode('const a = "x"; // note', 'js');

    expect(html).toContain('<span');
    expect(html).toContain('const');
    expect(html).toContain('// note');
  });

  it('escapes the code it colours', () => {
    expect(highlightCode('const a = "<b>";', 'js')).toContain('&lt;b&gt;');
  });

  it('leaves an unknown language escaped but uncoloured', () => {
    const html = highlightCode('some <thing>', 'brainfuck');

    expect(html).toBe('some &lt;thing&gt;');
  });

  it('never loses a character of the original', () => {
    const source = 'const n = 42; /* c */ let s = \'hi\';';
    const stripped = highlightCode(source, 'js')
      .replace(/<span class="[^"]*">/g, '')
      .replace(/<\/span>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    expect(stripped).toBe(source);
  });
});

describe('tokenize', () => {
  it('reads a string to its closing quote, escapes and all', () => {
    const tokens = tokenize('"a\\"b" rest', 'javascript');
    expect(tokens[0]).toEqual({ kind: 'string', value: '"a\\"b"' });
  });

  it('does not run off the end of an unterminated string', () => {
    const tokens = tokenize('"never closed', 'javascript');
    expect(tokens[0]?.kind).toBe('string');
  });

  it('reads a block comment to its end', () => {
    const tokens = tokenize('/* a\nb */ x', 'css');
    expect(tokens[0]).toEqual({ kind: 'comment', value: '/* a\nb */' });
  });

  it('survives an unterminated block comment', () => {
    expect(() => tokenize('/* forever', 'javascript')).not.toThrow();
  });

  it('treats an HTML tag as one token', () => {
    const tokens = tokenize('<div class="a">text', 'html');
    expect(tokens[0]).toEqual({ kind: 'tag', value: '<div class="a">' });
  });

  it('knows a keyword from a word that merely contains one', () => {
    const kinds = tokenize('const constant = 1', 'javascript').map((t) => t.kind);
    expect(kinds.filter((kind) => kind === 'keyword')).toHaveLength(1);
  });

  it('reads SQL keywords whatever the case', () => {
    const tokens = tokenize('SELECT * FROM t', 'sql');
    expect(tokens.some((token) => token.kind === 'keyword')).toBe(true);
  });

  it('puts every character of the source into some token', () => {
    const source = 'def f(x):\n  # hi\n  return x + 1';
    const tokens = tokenize(source, 'python');

    expect(tokens.map((token) => token.value).join('')).toBe(source);
  });

  it('handles an empty source', () => {
    expect(tokenize('', 'javascript')).toEqual([]);
  });
});

describe('resolveLanguage', () => {
  it('accepts the usual short names', () => {
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('JS')).toBe('javascript');
    expect(resolveLanguage(' sh ')).toBe('bash');
  });

  it('says no to a language it does not know', () => {
    expect(resolveLanguage('cobol')).toBeNull();
  });

  it('maps every alias to a language it can tokenize', () => {
    for (const [alias, language] of Object.entries(LANGUAGE_ALIASES)) {
      expect(() => tokenize('x', language)).not.toThrow();
      expect(resolveLanguage(alias)).toBe(language);
    }
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('counting', () => {
  it('counts lines, with an empty document at zero', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
  });

  it('counts task list items and how many are ticked', () => {
    expect(countTasks('- [x] a\n- [ ] b\n- [X] c')).toEqual({ total: 3, done: 2 });
  });

  it('counts no tasks in a document without any', () => {
    expect(countTasks('# Just a heading')).toEqual({ total: 0, done: 0 });
  });

  it('does not mistake a link for a task', () => {
    expect(countTasks('- [text](url)').total).toBe(0);
  });

  it('knows when a document is past what it will render', () => {
    expect(isTooLong('a'.repeat(MAX_INPUT_CHARS + 1))).toBe(true);
    expect(isTooLong('short')).toBe(false);
  });
});

describe('toDocument', () => {
  it('wraps the body in a complete page', () => {
    const html = toDocument('<p>hi</p>', 'Notes');

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Notes</title>');
    expect(html).toContain('<p>hi</p>');
    expect(html).toContain('charset="utf-8"');
  });

  it('escapes the title, which came from the document', () => {
    expect(toDocument('<p>hi</p>', '<script>')).toContain('<title>&lt;script&gt;');
  });
});
