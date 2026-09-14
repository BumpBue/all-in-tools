/**
 * A small syntax highlighter for the languages a README actually uses.
 *
 * Deliberately not highlight.js or prism: those cost more gzipped than the
 * Markdown parser and the sanitizer put together, for a nicety. This is a
 * token-level approximation and says so on the page — it colours strings,
 * comments, numbers and keywords, and nothing cleverer.
 */
export const LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'html',
  'css',
  'bash',
  'python',
  'sql',
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  json: 'json',
  html: 'html',
  xml: 'html',
  svg: 'html',
  css: 'css',
  scss: 'css',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  python: 'python',
  sql: 'sql',
};

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'tag';

export interface Token {
  kind: TokenKind;
  value: string;
}

const KEYWORDS: Readonly<Record<Language, readonly string[]>> = {
  javascript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'class', 'new', 'import', 'export', 'from', 'default', 'async', 'await',
    'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'this', 'null',
    'undefined', 'true', 'false',
  ],
  typescript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'class', 'new', 'import', 'export', 'from', 'default', 'async', 'await',
    'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'this', 'null',
    'undefined', 'true', 'false', 'interface', 'type', 'enum', 'implements',
    'extends', 'readonly', 'public', 'private', 'protected', 'as', 'satisfies',
  ],
  json: ['true', 'false', 'null'],
  html: [],
  css: ['important', 'media', 'import', 'keyframes', 'supports'],
  bash: [
    'if', 'then', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'case',
    'esac', 'function', 'return', 'export', 'local', 'echo', 'cd', 'exit',
  ],
  python: [
    'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and',
    'or', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise',
    'with', 'lambda', 'None', 'True', 'False', 'self', 'pass', 'yield',
  ],
  sql: [
    'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set',
    'delete', 'create', 'table', 'drop', 'alter', 'join', 'left', 'right',
    'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'and',
    'or', 'not', 'null', 'as', 'distinct',
  ],
};

const LINE_COMMENTS: Readonly<Record<Language, string | null>> = {
  javascript: '//',
  typescript: '//',
  json: null,
  html: null,
  css: null,
  bash: '#',
  python: '#',
  sql: '--',
};

const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\d_.]*(?:e[-+]?\d+)?/iy;
const QUOTE = /['"`]/;
const WHITESPACE_OR_OTHER = /[^A-Za-z_$\d'"`]/y;

export function resolveLanguage(raw: string): Language | null {
  return LANGUAGE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function readString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === quote) return index + 1;
    index += 1;
  }

  return source.length;
}

export function tokenize(source: string, language: Language): Token[] {
  const tokens: Token[] = [];
  const keywords = new Set(KEYWORDS[language]);
  const lineComment = LINE_COMMENTS[language];

  let index = 0;
  let plain = '';

  const flush = () => {
    if (plain.length === 0) return;
    tokens.push({ kind: 'plain', value: plain });
    plain = '';
  };

  while (index < source.length) {
    const rest = source.slice(index);

    if (lineComment !== null && rest.startsWith(lineComment)) {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      flush();
      tokens.push({ kind: 'comment', value: source.slice(index, stop) });
      index = stop;
      continue;
    }

    if (rest.startsWith('/*')) {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      flush();
      tokens.push({ kind: 'comment', value: source.slice(index, stop) });
      index = stop;
      continue;
    }

    if (language === 'html' && rest.startsWith('<')) {
      const end = source.indexOf('>', index);
      const stop = end === -1 ? source.length : end + 1;
      flush();
      tokens.push({ kind: 'tag', value: source.slice(index, stop) });
      index = stop;
      continue;
    }

    const char = source[index] ?? '';

    if (QUOTE.test(char)) {
      const stop = readString(source, index);
      flush();
      tokens.push({ kind: 'string', value: source.slice(index, stop) });
      index = stop;
      continue;
    }

    NUMBER.lastIndex = index;
    const number = NUMBER.exec(source);
    if (number && number.index === index) {
      flush();
      tokens.push({ kind: 'number', value: number[0] });
      index += number[0].length;
      continue;
    }

    WORD.lastIndex = index;
    const word = WORD.exec(source);
    if (word && word.index === index) {
      const value = word[0];
      if (keywords.has(value) || keywords.has(value.toLowerCase())) {
        flush();
        tokens.push({ kind: 'keyword', value });
      } else {
        plain += value;
      }
      index += value.length;
      continue;
    }

    WHITESPACE_OR_OTHER.lastIndex = index;
    plain += char;
    index += 1;
  }

  flush();
  return tokens;
}
