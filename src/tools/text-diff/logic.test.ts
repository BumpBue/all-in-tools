import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OPTIONS,
  GRANULARITIES,
  MAX_INPUT_CHARS,
  MAX_TOKENS,
  buildRows,
  comparisonKey,
  diffTexts,
  mergeOps,
  splitCharacters,
  splitLines,
  splitWords,
  summarize,
  tokenize,
  type DiffOp,
  type DiffOptions,
  type Granularity,
} from '@/tools/text-diff/logic';

function ops(
  left: string,
  right: string,
  granularity: Granularity = 'line',
  options: Partial<DiffOptions> = {},
): DiffOp[] {
  const result = diffTexts(left, right, granularity, { ...DEFAULT_OPTIONS, ...options });
  if (!result.ok) throw new Error(`expected a diff, got ${result.code}`);
  return result.ops;
}

function rebuild(list: DiffOp[], side: 'left' | 'right'): string[] {
  const skip = side === 'left' ? 'insert' : 'delete';
  return list.filter((op) => op.type !== skip).map((op) => op.value);
}

function shape(list: DiffOp[]): string {
  return list
    .map((op) => `${op.type === 'equal' ? '=' : op.type === 'insert' ? '+' : '-'}${op.value}`)
    .join(' ');
}

// A tiny reproducible generator, so a failing case can be re-run.
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('splitting', () => {
  it('offers the three levels the tool advertises', () => {
    expect(GRANULARITIES).toEqual(['line', 'word', 'character']);
  });

  it('treats every newline style as one line break', () => {
    expect(splitLines('a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps an empty trailing line, which is a real difference', () => {
    expect(splitLines('a\n')).toEqual(['a', '']);
  });

  it('splits Thai into words rather than into one blob', () => {
    const words = splitWords('ฉันกินข้าว');
    expect(words.length).toBeGreaterThan(1);
    expect(words.join('')).toBe('ฉันกินข้าว');
  });

  it('keeps the separators so the text can be put back together', () => {
    expect(splitWords('one two').join('')).toBe('one two');
  });

  it('keeps a Thai tone mark with the letter it sits on', () => {
    // ก + ่ is one grapheme; splitting it would highlight a floating mark.
    expect(splitCharacters('ก่ข')).toEqual(['ก่', 'ข']);
  });

  it('keeps an emoji whole', () => {
    expect(splitCharacters('a🙂')).toEqual(['a', '🙂']);
  });

  it('tokenizes by the level asked for', () => {
    expect(tokenize('ab\ncd', 'line')).toEqual(['ab', 'cd']);
    expect(tokenize('ab', 'character')).toEqual(['a', 'b']);
  });
});

describe('comparisonKey', () => {
  it('changes nothing by default', () => {
    expect(comparisonKey(' A b ', DEFAULT_OPTIONS)).toBe(' A b ');
  });

  it('folds case when asked', () => {
    expect(comparisonKey('AbC', { ...DEFAULT_OPTIONS, ignoreCase: true })).toBe('abc');
  });

  it('removes whitespace when asked', () => {
    expect(comparisonKey(' a b ', { ...DEFAULT_OPTIONS, ignoreWhitespace: true })).toBe(
      'ab',
    );
  });
});

describe('diffTexts', () => {
  it('reports two identical texts as all equal', () => {
    expect(shape(ops('a\nb', 'a\nb'))).toBe('=a =b');
  });

  it('finds a single added line', () => {
    expect(shape(ops('a\nc', 'a\nb\nc'))).toBe('=a +b =c');
  });

  it('finds a single removed line', () => {
    expect(shape(ops('a\nb\nc', 'a\nc'))).toBe('=a -b =c');
  });

  it('reads a replaced line as one out and one in', () => {
    expect(shape(ops('a\nb\nc', 'a\nx\nc'))).toBe('=a -b +x =c');
  });

  // An empty box is one empty line, so it is a replacement rather than nothing.
  it('handles an empty side', () => {
    expect(shape(ops('', 'a'))).toBe('- +a');
    expect(shape(ops('a', ''))).toBe('-a +');
  });

  it('handles both sides empty', () => {
    expect(shape(ops('', ''))).toBe('=');
  });

  it('never loses or invents text', () => {
    const left = 'the quick\nbrown fox\njumps over\nthe lazy dog';
    const right = 'the quick\nred fox\njumps over\nthe dog\nat dawn';

    expect(rebuild(ops(left, right), 'left')).toEqual(splitLines(left));
    expect(rebuild(ops(left, right), 'right')).toEqual(splitLines(right));
  });

  it('puts a Thai sentence back together at every level', () => {
    const left = 'ฉันกินข้าวเช้า';
    const right = 'ฉันกินข้าวเย็น';

    for (const granularity of GRANULARITIES) {
      const list = ops(left, right, granularity);
      expect(rebuild(list, 'left').join('')).toBe(left);
      expect(rebuild(list, 'right').join('')).toBe(right);
    }
  });

  it('marks only the word that changed in a Thai sentence', () => {
    const list = mergeOps(ops('ฉันกินข้าวเช้า', 'ฉันกินข้าวเย็น', 'word'));
    const equal = list.filter((op) => op.type === 'equal').map((op) => op.value);

    expect(equal.join('')).toContain('ฉัน');
    expect(list.some((op) => op.type === 'insert' && op.value.includes('เย็น'))).toBe(
      true,
    );
  });

  it('survives a thousand random edits without losing a token', () => {
    const random = seeded(7);
    const letters = 'abcde';

    for (let round = 0; round < 200; round += 1) {
      const size = 1 + Math.floor(random() * 12);
      const left = Array.from({ length: size }, () =>
        letters[Math.floor(random() * letters.length)],
      ).join('\n');
      const right = Array.from({ length: 1 + Math.floor(random() * 12) }, () =>
        letters[Math.floor(random() * letters.length)],
      ).join('\n');

      const list = ops(left, right);
      expect(rebuild(list, 'left')).toEqual(splitLines(left));
      expect(rebuild(list, 'right')).toEqual(splitLines(right));
    }
  });

  it('finds the shortest edit script, not merely a correct one', () => {
    // Replacing the middle line costs two edits; rewriting all three costs six.
    const list = ops('a\nb\nc', 'a\nx\nc');
    expect(list.filter((op) => op.type !== 'equal')).toHaveLength(2);
  });

  it('ignores case only when asked', () => {
    expect(shape(ops('Hello', 'hello'))).toBe('-Hello +hello');
    expect(shape(ops('Hello', 'hello', 'line', { ignoreCase: true }))).toBe('=Hello');
  });

  it('keeps the original text when a difference is ignored', () => {
    const list = ops('  a  ', 'a', 'line', { ignoreWhitespace: true });
    expect(list).toEqual([{ type: 'equal', value: '  a  ' }]);
  });

  it('drops blank lines from both sides when asked', () => {
    const list = ops('a\n\n\nb', 'a\nb', 'line', { ignoreBlankLines: true });
    expect(shape(list)).toBe('=a =b');
  });

  it('counts blank lines as differences by default', () => {
    expect(shape(ops('a\n\nb', 'a\nb'))).toContain('-');
  });

  it('turns away input longer than it will handle', () => {
    const huge = 'a'.repeat(MAX_INPUT_CHARS + 1);
    expect(diffTexts(huge, 'a', 'line', DEFAULT_OPTIONS)).toEqual({
      ok: false,
      code: 'too-long',
    });
  });

  it('turns away more tokens than it will handle', () => {
    const many = 'a\n'.repeat(MAX_TOKENS + 1);
    expect(diffTexts(many, 'b', 'line', DEFAULT_OPTIONS)).toEqual({
      ok: false,
      code: 'too-many-tokens',
    });
  });

  it('says so rather than stalling on two texts with nothing in common', () => {
    const left = Array.from({ length: 2000 }, (_, index) => `left ${index}`).join('\n');
    const right = Array.from({ length: 2000 }, (_, index) => `right ${index}`).join('\n');

    expect(diffTexts(left, right, 'line', DEFAULT_OPTIONS)).toEqual({
      ok: false,
      code: 'too-different',
    });
  });

  it('still compares two long texts that mostly agree', () => {
    const lines = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
    const left = lines.join('\n');
    const right = [...lines.slice(0, 2500), 'inserted', ...lines.slice(2500)].join('\n');

    const list = ops(left, right);
    expect(list.filter((op) => op.type !== 'equal')).toEqual([
      { type: 'insert', value: 'inserted' },
    ]);
  });
});

describe('summarize', () => {
  it('counts a replacement as one change, not one of each', () => {
    expect(summarize(ops('a\nb\nc', 'a\nx\nc'))).toEqual({
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 2,
    });
  });

  it('counts additions and removals apart', () => {
    expect(summarize(ops('a\nc', 'a\nb\nc'))).toMatchObject({ added: 1, changed: 0 });
    expect(summarize(ops('a\nb\nc', 'a\nc'))).toMatchObject({ removed: 1, changed: 0 });
  });

  it('splits an uneven block into changes and the rest', () => {
    expect(summarize(ops('a\nb\nc\nd', 'a\nx\ny\nz\nd'))).toMatchObject({
      changed: 2,
      added: 1,
      removed: 0,
    });
  });

  it('counts nothing for two identical texts', () => {
    expect(summarize(ops('a\nb', 'a\nb'))).toMatchObject({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 2,
    });
  });
});

describe('buildRows', () => {
  it('puts an unchanged line on both sides with both numbers', () => {
    expect(buildRows(ops('a', 'a'))).toEqual([
      { type: 'equal', left: 'a', right: 'a', leftNumber: 1, rightNumber: 1 },
    ]);
  });

  it('pairs a removal with the addition that replaced it', () => {
    const rows = buildRows(ops('a\nb\nc', 'a\nx\nc'));
    expect(rows[1]).toEqual({
      type: 'change',
      left: 'b',
      right: 'x',
      leftNumber: 2,
      rightNumber: 2,
    });
  });

  it('leaves the other column empty for a pure addition', () => {
    const rows = buildRows(ops('a\nc', 'a\nb\nc'));
    expect(rows[1]).toMatchObject({ type: 'insert', left: null, right: 'b' });
  });

  it('keeps the line numbers of each side counting separately', () => {
    const rows = buildRows(ops('a\nb\nc', 'a\nc'));
    const last = rows[rows.length - 1];

    expect(last).toMatchObject({ leftNumber: 3, rightNumber: 2 });
  });
});

describe('mergeOps', () => {
  it('joins neighbouring runs of the same kind', () => {
    expect(
      mergeOps([
        { type: 'equal', value: 'a' },
        { type: 'equal', value: 'b' },
        { type: 'insert', value: 'c' },
      ]),
    ).toEqual([
      { type: 'equal', value: 'ab' },
      { type: 'insert', value: 'c' },
    ]);
  });

  it('leaves the original list alone', () => {
    const original: DiffOp[] = [
      { type: 'equal', value: 'a' },
      { type: 'equal', value: 'b' },
    ];
    mergeOps(original);
    expect(original).toHaveLength(2);
  });
});
