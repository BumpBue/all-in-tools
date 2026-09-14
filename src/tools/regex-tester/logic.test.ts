import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FLAGS,
  MATCH_LIMIT,
  REGEX_FLAGS,
  buildSegments,
  captureNames,
  compile,
  invalidFlags,
  isRegexFlag,
  normalizeFlags,
  runRequest,
  unbalancedAt,
} from '@/tools/regex-tester/logic';

function run(pattern: string, flags: string, text: string, replacement: string | null = null) {
  return runRequest({ pattern, flags, text, replacement });
}

function matches(pattern: string, flags: string, text: string) {
  const result = run(pattern, flags, text);
  if (!result.ok) throw new Error(`expected /${pattern}/${flags} to compile`);
  return result.matches;
}

function failure(pattern: string, flags = '') {
  const result = run(pattern, flags, '');
  if (result.ok) throw new Error(`expected /${pattern}/ to fail`);
  return result;
}

describe('flags', () => {
  it('offers exactly the flags a RegExp accepts here', () => {
    expect(REGEX_FLAGS).toEqual(['g', 'i', 'm', 's', 'u', 'y']);
    expect(DEFAULT_FLAGS).toBe('g');
  });

  it('drops unknown letters and keeps a canonical order', () => {
    expect(normalizeFlags('ig')).toBe('gi');
    expect(normalizeFlags('gq!')).toBe('g');
    expect(normalizeFlags('')).toBe('');
  });

  it('never repeats a flag, which RegExp would reject', () => {
    expect(normalizeFlags('ggg')).toBe('g');
    expect(() => new RegExp('a', 'gg')).toThrow();
  });

  it('reports the letters it dropped, once each', () => {
    expect(invalidFlags('gqq')).toEqual(['q']);
    expect(invalidFlags('gim')).toEqual([]);
  });

  it('recognises each flag', () => {
    expect(isRegexFlag('y')).toBe(true);
    expect(isRegexFlag('x')).toBe(false);
  });
});

describe('compile', () => {
  it('reports an empty pattern without inventing a reason', () => {
    expect(failure('')).toMatchObject({ code: 'empty-pattern', at: null });
  });

  it('reports an unknown flag as a flag problem', () => {
    expect(compile('a', 'q')).toMatchObject({ code: 'invalid-flag', detail: 'q' });
  });

  it('keeps the engine wording for a broken pattern', () => {
    const result = failure('a(');
    expect(result.code).toBe('invalid-pattern');
    expect(result.detail.length).toBeGreaterThan(0);
  });

  it('points at the bracket that was left open', () => {
    expect(failure('ab(cd').at).toBe(2);
    expect(failure('a[b-').at).toBe(1);
  });

  it('points at a closing bracket that opened nothing', () => {
    expect(failure('ab)').at).toBe(2);
  });
});

describe('unbalancedAt', () => {
  it('finds nothing wrong with a balanced pattern', () => {
    expect(unbalancedAt('(a(b)c)[)]')).toBeNull();
  });

  it('ignores brackets that are escaped', () => {
    expect(unbalancedAt('\\(a\\)')).toBeNull();
    expect(unbalancedAt('\\((a)')).toBeNull();
  });

  it('ignores brackets inside a character class', () => {
    expect(unbalancedAt('[(]')).toBeNull();
  });

  it('catches a trailing backslash', () => {
    expect(unbalancedAt('ab\\')).toBe(2);
  });

  it('reports the innermost group still open', () => {
    expect(unbalancedAt('(a(b')).toBe(2);
  });
});

describe('captureNames', () => {
  it('numbers plain groups and leaves them unnamed', () => {
    expect(captureNames('(a)(b)')).toEqual([null, null]);
  });

  it('remembers which numbered group carries which name', () => {
    expect(captureNames('(\\d{4})-(?<month>\\d{2})')).toEqual([null, 'month']);
  });

  it('does not count non-capturing groups or lookarounds', () => {
    expect(captureNames('(?:a)(b)(?=c)(?<=d)(?!e)')).toEqual([null]);
  });

  it('ignores a parenthesis inside a class or escaped', () => {
    expect(captureNames('[(](a)\\(')).toEqual([null]);
  });
});

describe('matching', () => {
  it('finds every match with the g flag', () => {
    expect(matches('a', 'g', 'banana').map((match) => match.index)).toEqual([1, 3, 5]);
  });

  it('stops at the first match without the g flag', () => {
    expect(matches('a', '', 'banana')).toHaveLength(1);
  });

  it('reports where a match starts and ends', () => {
    const [first] = matches('na', 'g', 'banana');
    expect(first).toMatchObject({ index: 2, end: 4, value: 'na' });
  });

  it('ignores case only when asked', () => {
    expect(matches('A', 'g', 'aA')).toHaveLength(1);
    expect(matches('A', 'gi', 'aA')).toHaveLength(2);
  });

  it('matches Thai text by grapheme, not by byte', () => {
    const [first] = matches('สวัสดี', 'g', 'พูดว่า สวัสดี ครับ');
    expect(first?.value).toBe('สวัสดี');
    expect(first?.index).toBe(7);
  });

  it('carries both numbered and named groups', () => {
    const [first] = matches('(?<year>\\d{4})-(\\d{2})', 'g', '2026-09');

    expect(first?.groups).toEqual([
      { index: 1, name: 'year', value: '2026' },
      { index: 2, name: null, value: '09' },
    ]);
  });

  it('marks a group that took part in no match as having no value', () => {
    const [first] = matches('(a)|(b)', 'g', 'b');
    expect(first?.groups[0]).toEqual({ index: 1, name: null, value: null });
  });

  it('moves on after a match that consumed nothing', () => {
    const found = matches('b*', 'g', 'ab');
    expect(found.length).toBeLessThan(MATCH_LIMIT);
    expect(found.some((match) => match.value === 'b')).toBe(true);
  });

  it('caps the list and says it did', () => {
    const result = run('a', 'g', 'a'.repeat(MATCH_LIMIT + 10));
    expect(result).toMatchObject({ ok: true, truncated: true });
    if (result.ok) expect(result.matches).toHaveLength(MATCH_LIMIT);
  });

  it('does not claim truncation when the matches all fit', () => {
    expect(run('a', 'g', 'aaa')).toMatchObject({ truncated: false });
  });

  it('honours the sticky flag by stopping at the first gap', () => {
    expect(matches('a', 'y', 'aab').map((match) => match.index)).toEqual([0, 1]);
    expect(matches('a', 'y', 'ba')).toEqual([]);
  });

  it('returns an empty list rather than an error when nothing matches', () => {
    expect(run('zzz', 'g', 'abc')).toMatchObject({ ok: true, matches: [] });
  });
});

describe('replacing', () => {
  it('leaves the replace pass out when no replacement is asked for', () => {
    expect(run('a', 'g', 'aaa')).toMatchObject({ replaced: null });
  });

  it('substitutes a numbered group', () => {
    expect(run('(\\w+)@(\\w+)', 'g', 'me@here', '$2:$1')).toMatchObject({
      replaced: 'here:me',
    });
  });

  it('substitutes a named group', () => {
    expect(run('(?<who>\\w+)', 'g', 'bob', 'hello $<who>')).toMatchObject({
      replaced: 'hello bob',
    });
  });

  it('replaces only the first match without the g flag', () => {
    expect(run('a', '', 'aaa', 'b')).toMatchObject({ replaced: 'baa' });
  });

  it('replaces every match with the g flag', () => {
    expect(run('a', 'g', 'aaa', 'b')).toMatchObject({ replaced: 'bbb' });
  });

  it('counts matches and replaces from the same starting point', () => {
    const result = run('a', 'g', 'aaa', 'b');
    if (!result.ok) throw new Error('expected a result');
    expect(result.matches).toHaveLength(3);
    expect(result.replaced).toBe('bbb');
  });
});

describe('buildSegments', () => {
  it('splits the text into matched and unmatched runs', () => {
    expect(buildSegments('banana', matches('na', 'g', 'banana'))).toEqual([
      { text: 'ba', match: null },
      { text: 'na', match: 0 },
      { text: 'na', match: 1 },
    ]);
  });

  it('numbers neighbouring matches differently so they can alternate', () => {
    const segments = buildSegments('aa', matches('a', 'g', 'aa'));
    expect(segments.map((segment) => segment.match)).toEqual([0, 1]);
  });

  it('keeps the tail after the last match', () => {
    const segments = buildSegments('abc', matches('a', 'g', 'abc'));
    expect(segments[segments.length - 1]).toEqual({ text: 'bc', match: null });
  });

  it('leaves out matches that consumed nothing, which cannot be shown', () => {
    const segments = buildSegments('ab', matches('x*', 'g', 'ab'));
    expect(segments).toEqual([{ text: 'ab', match: null }]);
  });

  it('returns the whole text when there are no matches', () => {
    expect(buildSegments('abc', [])).toEqual([{ text: 'abc', match: null }]);
  });
});
