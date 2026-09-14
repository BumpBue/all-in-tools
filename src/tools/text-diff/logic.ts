import { hasSegmenter, segmentGraphemes } from '@/lib/text';

export type Granularity = 'line' | 'word' | 'character';
export const GRANULARITIES: readonly Granularity[] = ['line', 'word', 'character'];

export type DiffView = 'split' | 'unified';
export const DIFF_VIEWS: readonly DiffView[] = ['split', 'unified'];

/** Per side. Past this the page would stall before the diff even started. */
export const MAX_INPUT_CHARS = 200_000;

/** Per side, after splitting. Character mode reaches this long before lines do. */
export const MAX_TOKENS = 20_000;

/**
 * The number of single-token edits Myers is allowed to find. Its trace costs
 * roughly the square of this, so two texts with nothing in common have to be
 * turned away rather than allowed to exhaust memory.
 */
export const MAX_DIFFERENCES = 1_200;

const WHITESPACE = /\s+/g;
const NEWLINES = /\r\n?/g;

export interface DiffOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  ignoreBlankLines: boolean;
}

export const DEFAULT_OPTIONS: DiffOptions = {
  ignoreCase: false,
  ignoreWhitespace: false,
  ignoreBlankLines: false,
};

export type DiffType = 'equal' | 'insert' | 'delete';

export interface DiffOp {
  type: DiffType;
  value: string;
}

export type DiffErrorCode = 'too-long' | 'too-many-tokens' | 'too-different';

export type DiffOutcome = { ok: true; ops: DiffOp[] } | { ok: false; code: DiffErrorCode };

export function normalizeNewlines(text: string): string {
  return text.replace(NEWLINES, '\n');
}

export function splitLines(text: string): string[] {
  return normalizeNewlines(text).split('\n');
}

/**
 * Thai writes no spaces between words, so splitting on whitespace would treat a
 * whole sentence as one token and report it as entirely rewritten.
 *
 * Not segmentWords from lib: this one keeps the separators as tokens of their
 * own, because a diff has to put the text back together exactly as it came in.
 */
export function splitWords(text: string): string[] {
  if (text.length === 0) return [];

  if (hasSegmenter()) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    return [...segmenter.segment(text)].map((piece) => piece.segment);
  }

  return text.split(/(\s+)/).filter((piece) => piece.length > 0);
}

export function splitCharacters(text: string): string[] {
  return segmentGraphemes(text);
}

export function tokenize(text: string, granularity: Granularity): string[] {
  if (granularity === 'line') return splitLines(text);
  if (granularity === 'word') return splitWords(text);
  return splitCharacters(text);
}

export function comparisonKey(token: string, options: DiffOptions): string {
  let key = token;
  if (options.ignoreWhitespace) key = key.replace(WHITESPACE, '');
  if (options.ignoreCase) key = key.toLowerCase();
  return key;
}

export function dropBlankLines(tokens: string[], granularity: Granularity): string[] {
  if (granularity !== 'line') return tokens;
  return tokens.filter((token) => token.trim().length > 0);
}

/**
 * Myers' diff, greedy forward pass with a stored trace.
 *
 * Only the band of diagonals reachable at each step is kept, so the trace costs
 * about d² numbers rather than d × (n + m).
 */
function myersTrace(
  left: string[],
  right: string[],
  limit: number,
): Int32Array[] | null {
  const n = left.length;
  const m = right.length;
  const max = n + m;
  const offset = max;

  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= Math.min(max, limit); d += 1) {
    trace.push(v.slice(offset - d, offset + d + 1));

    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;

      while (x < n && y < m && left[x] === right[y]) {
        x += 1;
        y += 1;
      }

      v[offset + k] = x;

      if (x >= n && y >= m) return trace;
    }
  }

  return null;
}

function backtrack(
  trace: Int32Array[],
  leftTokens: string[],
  rightTokens: string[],
): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = leftTokens.length;
  let y = rightTokens.length;

  // trace[d] is the state before step d, which is what says where step d came
  // from. The walk runs backwards from the step that reached the end.
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d -= 1) {
    const band = trace[d];
    if (band === undefined) break;

    const k = x - y;
    const at = (diagonal: number): number | undefined => band[diagonal + d];

    const previousK =
      k === -d || (k !== d && (at(k - 1) ?? -1) < (at(k + 1) ?? -1)) ? k + 1 : k - 1;

    const previousX = at(previousK) ?? 0;
    const previousY = previousX - previousK;

    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      ops.push({ type: 'equal', value: leftTokens[x] ?? '' });
    }

    if (d === 0) break;

    if (x === previousX) {
      y -= 1;
      ops.push({ type: 'insert', value: rightTokens[y] ?? '' });
    } else {
      x -= 1;
      ops.push({ type: 'delete', value: leftTokens[x] ?? '' });
    }
  }

  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'equal', value: leftTokens[x] ?? '' });
  }
  while (x > 0) {
    x -= 1;
    ops.push({ type: 'delete', value: leftTokens[x] ?? '' });
  }
  while (y > 0) {
    y -= 1;
    ops.push({ type: 'insert', value: rightTokens[y] ?? '' });
  }

  return ops.reverse();
}

export function diffTexts(
  leftText: string,
  rightText: string,
  granularity: Granularity,
  options: DiffOptions,
): DiffOutcome {
  if (leftText.length > MAX_INPUT_CHARS || rightText.length > MAX_INPUT_CHARS) {
    return { ok: false, code: 'too-long' };
  }

  const left = options.ignoreBlankLines
    ? dropBlankLines(tokenize(leftText, granularity), granularity)
    : tokenize(leftText, granularity);
  const right = options.ignoreBlankLines
    ? dropBlankLines(tokenize(rightText, granularity), granularity)
    : tokenize(rightText, granularity);

  if (left.length > MAX_TOKENS || right.length > MAX_TOKENS) {
    return { ok: false, code: 'too-many-tokens' };
  }

  const leftKeys = left.map((token) => comparisonKey(token, options));
  const rightKeys = right.map((token) => comparisonKey(token, options));

  // Most edits sit in the middle of two otherwise identical texts, and Myers
  // costs far less once the shared ends are taken off.
  let head = 0;
  while (head < left.length && head < right.length && leftKeys[head] === rightKeys[head]) {
    head += 1;
  }

  let tail = 0;
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    leftKeys[left.length - 1 - tail] === rightKeys[right.length - 1 - tail]
  ) {
    tail += 1;
  }

  const middleLeftKeys = leftKeys.slice(head, left.length - tail);
  const middleRightKeys = rightKeys.slice(head, right.length - tail);

  const trace = myersTrace(middleLeftKeys, middleRightKeys, MAX_DIFFERENCES);
  if (trace === null) return { ok: false, code: 'too-different' };

  const middle = backtrack(
    trace,
    left.slice(head, left.length - tail),
    right.slice(head, right.length - tail),
  );

  return {
    ok: true,
    ops: [
      ...left.slice(0, head).map((value): DiffOp => ({ type: 'equal', value })),
      ...middle,
      ...left.slice(left.length - tail).map((value): DiffOp => ({ type: 'equal', value })),
    ],
  };
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

/**
 * A delete followed by an insert is one line rewritten, not one gone and one
 * new, which is how a reader counts it.
 */
export function summarize(ops: DiffOp[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, changed: 0, unchanged: 0 };

  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op === undefined) break;

    if (op.type === 'equal') {
      stats.unchanged += 1;
      index += 1;
      continue;
    }

    let deletes = 0;
    let inserts = 0;
    while (index < ops.length && ops[index]?.type !== 'equal') {
      if (ops[index]?.type === 'delete') deletes += 1;
      else inserts += 1;
      index += 1;
    }

    const changed = Math.min(deletes, inserts);
    stats.changed += changed;
    stats.removed += deletes - changed;
    stats.added += inserts - changed;
  }

  return stats;
}

export type RowType = 'equal' | 'insert' | 'delete' | 'change';

export interface DiffRow {
  type: RowType;
  left: string | null;
  right: string | null;
  leftNumber: number | null;
  rightNumber: number | null;
}

/** Pairs each removal with the addition that replaced it, for two columns. */
export function buildRows(ops: DiffOp[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let leftNumber = 0;
  let rightNumber = 0;
  let index = 0;

  while (index < ops.length) {
    const op = ops[index];
    if (op === undefined) break;

    if (op.type === 'equal') {
      leftNumber += 1;
      rightNumber += 1;
      rows.push({
        type: 'equal',
        left: op.value,
        right: op.value,
        leftNumber,
        rightNumber,
      });
      index += 1;
      continue;
    }

    const deletes: string[] = [];
    const inserts: string[] = [];
    while (index < ops.length && ops[index]?.type !== 'equal') {
      const current = ops[index];
      if (current?.type === 'delete') deletes.push(current.value);
      else if (current !== undefined) inserts.push(current.value);
      index += 1;
    }

    const pairs = Math.max(deletes.length, inserts.length);
    for (let position = 0; position < pairs; position += 1) {
      const left = deletes[position] ?? null;
      const right = inserts[position] ?? null;
      if (left !== null) leftNumber += 1;
      if (right !== null) rightNumber += 1;

      rows.push({
        type: left !== null && right !== null ? 'change' : left !== null ? 'delete' : 'insert',
        left,
        right,
        leftNumber: left === null ? null : leftNumber,
        rightNumber: right === null ? null : rightNumber,
      });
    }
  }

  return rows;
}

/** Joins neighbouring ops of the same kind so inline text renders as runs. */
export function mergeOps(ops: DiffOp[]): DiffOp[] {
  const merged: DiffOp[] = [];

  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.type === op.type) last.value += op.value;
    else merged.push({ ...op });
  }

  return merged;
}
