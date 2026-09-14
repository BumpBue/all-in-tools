export const REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;
export type RegexFlag = (typeof REGEX_FLAGS)[number];

export const DEFAULT_FLAGS = 'g';

/** Enough to see the shape of the matches without rendering a table forever. */
export const MATCH_LIMIT = 500;

/**
 * A backtracking engine cannot be interrupted, so the only defence against a
 * catastrophic pattern is to run it in a worker and terminate the worker.
 */
export const WORKER_TIMEOUT_MS = 1000;

const NAMED_GROUP = /^\(\?<([A-Za-z_$][\w$]*)>/;

export type RegexErrorCode =
  | 'empty-pattern'
  | 'invalid-pattern'
  | 'invalid-flag'
  | 'timeout'
  | 'worker-failed';

export interface RegexFailure {
  ok: false;
  code: RegexErrorCode;
  /** The engine's own wording, kept for the details line. */
  detail: string;
  /** Index in the pattern the reader should look at, when one can be found. */
  at: number | null;
}

export interface CaptureGroup {
  index: number;
  name: string | null;
  value: string | null;
}

export interface RegexMatch {
  index: number;
  end: number;
  value: string;
  groups: CaptureGroup[];
}

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  /** null in match mode: the worker then skips the replace pass entirely. */
  replacement: string | null;
}

export interface RegexSuccess {
  ok: true;
  matches: RegexMatch[];
  truncated: boolean;
  replaced: string | null;
}

export type RegexResponse = RegexSuccess | RegexFailure;

// The worker is kept between requests, so an answer has to say which request it
// belongs to: without the id a slow answer would be read as the answer to
// whatever was typed since.
export interface RegexJob {
  id: number;
  request: RegexRequest;
}

export interface RegexAnswer {
  id: number;
  response: RegexResponse;
}

export function isRegexFlag(value: string): value is RegexFlag {
  return (REGEX_FLAGS as readonly string[]).includes(value);
}

export function normalizeFlags(raw: string): string {
  const wanted = new Set([...raw].filter(isRegexFlag));
  return REGEX_FLAGS.filter((flag) => wanted.has(flag)).join('');
}

export function invalidFlags(raw: string): string[] {
  return [...new Set([...raw].filter((flag) => !isRegexFlag(flag)))];
}

/**
 * V8 says what is wrong with a pattern but not where, so the brackets are
 * scanned here to point at one. Returns the index of the bracket left open, or
 * of the stray closing one.
 */
export function unbalancedAt(pattern: string): number | null {
  const open: number[] = [];
  let classStart: number | null = null;
  let escaped = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (classStart !== null) {
      if (char === ']') classStart = null;
      continue;
    }
    if (char === '[') classStart = index;
    else if (char === '(') open.push(index);
    else if (char === ')') {
      if (open.length === 0) return index;
      open.pop();
    }
  }

  if (escaped) return pattern.length - 1;
  if (classStart !== null) return classStart;
  return open.length > 0 ? (open[open.length - 1] ?? null) : null;
}

/**
 * The name of every capturing group, in order, so a numbered group in the
 * result table can be shown with the name it was given. exec() alone cannot
 * say which numbered group a name belongs to.
 */
export function captureNames(pattern: string): Array<string | null> {
  const names: Array<string | null> = [];
  let inClass = false;
  let escaped = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      continue;
    }
    if (char !== '(') continue;

    if (pattern[index + 1] !== '?') {
      names.push(null);
      continue;
    }

    const named = NAMED_GROUP.exec(pattern.slice(index));
    if (named?.[1] !== undefined) names.push(named[1]);
  }

  return names;
}

function engineDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const colon = message.lastIndexOf(': ');
  return colon === -1 ? message : message.slice(colon + 2);
}

export type CompileResult = { ok: true; regex: RegExp } | RegexFailure;

export function compile(pattern: string, flags: string): CompileResult {
  if (pattern.length === 0) {
    return { ok: false, code: 'empty-pattern', detail: '', at: null };
  }

  const bad = invalidFlags(flags);
  if (bad.length > 0) {
    return { ok: false, code: 'invalid-flag', detail: bad.join(''), at: null };
  }

  try {
    return { ok: true, regex: new RegExp(pattern, normalizeFlags(flags)) };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid-pattern',
      detail: engineDetail(error),
      at: unbalancedAt(pattern),
    };
  }
}

function toMatch(found: RegExpExecArray, names: Array<string | null>): RegexMatch {
  return {
    index: found.index,
    end: found.index + found[0].length,
    value: found[0],
    groups: found.slice(1).map((value, position) => ({
      index: position + 1,
      name: names[position] ?? null,
      value: value ?? null,
    })),
  };
}

export function collectMatches(
  regex: RegExp,
  text: string,
  names: Array<string | null>,
): { matches: RegexMatch[]; truncated: boolean } {
  if (!regex.global && !regex.sticky) {
    const found = regex.exec(text);
    return { matches: found === null ? [] : [toMatch(found, names)], truncated: false };
  }

  const matches: RegexMatch[] = [];
  regex.lastIndex = 0;

  let found = regex.exec(text);
  while (found !== null) {
    matches.push(toMatch(found, names));
    // A pattern that can match nothing would otherwise never move forward.
    if (found[0].length === 0) regex.lastIndex += 1;
    if (matches.length >= MATCH_LIMIT) {
      return { matches, truncated: regex.exec(text) !== null };
    }
    found = regex.exec(text);
  }

  return { matches, truncated: false };
}

export function runRequest(request: RegexRequest): RegexResponse {
  const compiled = compile(request.pattern, request.flags);
  if (!compiled.ok) return compiled;

  try {
    const names = captureNames(request.pattern);
    const { matches, truncated } = collectMatches(compiled.regex, request.text, names);

    compiled.regex.lastIndex = 0;
    const replaced =
      request.replacement === null
        ? null
        : request.text.replace(compiled.regex, request.replacement);

    return { ok: true, matches, truncated, replaced };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid-pattern',
      detail: engineDetail(error),
      at: null,
    };
  }
}

export interface Segment {
  text: string;
  /** Which match this run belongs to, so neighbours can alternate colour. */
  match: number | null;
}

export function buildSegments(text: string, matches: RegexMatch[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  matches.forEach((match, ordinal) => {
    if (match.end <= match.index || match.index < cursor) return;
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), match: null });
    }
    segments.push({ text: text.slice(match.index, match.end), match: ordinal });
    cursor = match.end;
  });

  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: null });
  return segments;
}
