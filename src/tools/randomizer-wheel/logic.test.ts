import { describe, expect, it } from 'vitest';

import { createRandom } from '@/lib/random';
import {
  FULL_TURN,
  MAX_OPTIONS,
  SEGMENT_COLORS,
  activeOptions,
  angleForWinner,
  buildSegments,
  countStoredItems,
  decodeOptions,
  easeOut,
  emptyOption,
  encodeOptions,
  optionAtAngle,
  optionsFromText,
  optionsToText,
  pickWinner,
  totalWeight,
  type WheelOption,
} from '@/tools/randomizer-wheel/logic';

const SEED = 20260915;

function options(...labels: string[]): WheelOption[] {
  return labels.map((label, index) => emptyOption(`o${index}`, label));
}

function weighted(...pairs: Array<[string, number]>): WheelOption[] {
  return pairs.map(([label, weight], index) => ({
    id: `o${index}`,
    label,
    weight,
    removed: false,
  }));
}

describe('activeOptions', () => {
  it('leaves out blank labels', () => {
    expect(activeOptions(options('a', '  ', 'b'))).toHaveLength(2);
  });

  it('leaves out anything already drawn', () => {
    const list = options('a', 'b');
    list[0] = { ...(list[0] as WheelOption), removed: true };

    expect(activeOptions(list).map((option) => option.label)).toEqual(['b']);
  });
});

describe('pickWinner', () => {
  it('returns nothing when there is nothing to pick', () => {
    expect(pickWinner([])).toBeNull();
    expect(pickWinner(options('  '))).toBeNull();
  });

  it('returns the only option there is', () => {
    expect(pickWinner(options('only'))?.label).toBe('only');
  });

  it('never returns an option that was already drawn', () => {
    const list = options('a', 'b');
    list[0] = { ...(list[0] as WheelOption), removed: true };

    const random = createRandom(SEED);
    for (let round = 0; round < 100; round += 1) {
      expect(pickWinner(list, random)?.label).toBe('b');
    }
  });

  it('follows the weights over many draws', () => {
    const random = createRandom(SEED);
    const list = weighted(['common', 9], ['rare', 1]);
    const counts = { common: 0, rare: 0 };

    for (let round = 0; round < 4_000; round += 1) {
      const winner = pickWinner(list, random);
      if (winner?.label === 'common') counts.common += 1;
      else counts.rare += 1;
    }

    // Nine to one, allowing for the spread of four thousand draws.
    expect(counts.rare).toBeGreaterThan(250);
    expect(counts.rare).toBeLessThan(550);
  });

  it('treats every option equally when the weights add to nothing', () => {
    const random = createRandom(SEED);
    const list = weighted(['a', 0], ['b', 0]);
    const seen = new Set<string>();

    for (let round = 0; round < 50; round += 1) {
      const winner = pickWinner(list, random);
      if (winner) seen.add(winner.label);
    }

    expect(seen.size).toBe(2);
  });

  it('can reach every option, given enough draws', () => {
    const random = createRandom(SEED);
    const list = options('a', 'b', 'c', 'd', 'e');
    const seen = new Set(
      Array.from({ length: 300 }, () => pickWinner(list, random)?.label),
    );

    expect(seen.size).toBe(5);
  });
});

describe('buildSegments', () => {
  it('fills the whole circle', () => {
    const segments = buildSegments(options('a', 'b', 'c'));
    expect(segments[segments.length - 1]?.end).toBeCloseTo(FULL_TURN, 6);
    expect(segments[0]?.start).toBe(0);
  });

  it('gives equal options equal arcs', () => {
    const segments = buildSegments(options('a', 'b', 'c', 'd'));
    for (const segment of segments) {
      expect(segment.end - segment.start).toBeCloseTo(90, 6);
    }
  });

  it('gives a heavier option a wider arc', () => {
    const [first, second] = buildSegments(weighted(['heavy', 3], ['light', 1]));

    expect((first?.end ?? 0) - (first?.start ?? 0)).toBeCloseTo(270, 6);
    expect((second?.end ?? 0) - (second?.start ?? 0)).toBeCloseTo(90, 6);
  });

  it('leaves no gap between neighbours', () => {
    const segments = buildSegments(options('a', 'b', 'c'));
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.start).toBeCloseTo(segments[index - 1]?.end ?? 0, 6);
    }
  });

  it('gives neighbours different colours', () => {
    const segments = buildSegments(options('a', 'b', 'c', 'd'));
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.color).not.toBe(segments[index - 1]?.color);
    }
  });

  it('keeps going past the end of the colour list', () => {
    const many = options(
      ...Array.from({ length: SEGMENT_COLORS.length + 3 }, (_, index) => `o${index}`),
    );
    expect(buildSegments(many)).toHaveLength(SEGMENT_COLORS.length + 3);
  });

  it('has nothing to draw for an empty wheel', () => {
    expect(buildSegments([])).toEqual([]);
  });
});

describe('angleForWinner', () => {
  it('lands with the pointer inside the winning segment', () => {
    const list = options('a', 'b', 'c', 'd');
    const segments = buildSegments(list);
    const random = createRandom(SEED);

    for (const option of list) {
      const angle = angleForWinner(segments, option.id, 0, random);
      expect(optionAtAngle(segments, angle)?.id).toBe(option.id);
    }
  });

  it('lands on the winner from any starting angle', () => {
    const segments = buildSegments(options('a', 'b', 'c'));
    const random = createRandom(SEED);

    for (const start of [0, 37, 180, 359, 1234]) {
      const angle = angleForWinner(segments, 'o1', start, random);
      expect(optionAtAngle(segments, angle)?.id).toBe('o1');
      expect(angle).toBeGreaterThan(start);
    }
  });

  it('always turns forwards, never backwards', () => {
    const segments = buildSegments(options('a', 'b'));
    const angle = angleForWinner(segments, 'o0', 720, createRandom(SEED));

    expect(angle).toBeGreaterThanOrEqual(720);
  });

  it('turns several whole times, so it reads as a spin', () => {
    const segments = buildSegments(options('a', 'b'));
    const angle = angleForWinner(segments, 'o0', 0, createRandom(SEED));

    expect(angle).toBeGreaterThan(FULL_TURN * 4);
  });

  it('stays where it is when asked for an option that is not there', () => {
    const segments = buildSegments(options('a'));
    expect(angleForWinner(segments, 'missing', 42, createRandom(SEED))).toBe(42);
  });

  it('respects the weights when landing', () => {
    const segments = buildSegments(weighted(['heavy', 9], ['light', 1]));
    const random = createRandom(SEED);

    const angle = angleForWinner(segments, 'o1', 0, random);
    expect(optionAtAngle(segments, angle)?.label).toBe('light');
  });
});

describe('easeOut', () => {
  it('starts at nothing and ends at everything', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
  });

  it('slows down towards the end', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(0.9) - easeOut(0.8)).toBeLessThan(easeOut(0.2) - easeOut(0.1));
  });

  it('holds still outside the run', () => {
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });
});

describe('text and the link', () => {
  it('reads one option per line', () => {
    expect(optionsFromText('a\nb\n\nc').map((option) => option.label)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('reads a weight written as xN', () => {
    const [first, second] = optionsFromText('pizza x3\nsalad');

    expect(first).toMatchObject({ label: 'pizza', weight: 3 });
    expect(second).toMatchObject({ label: 'salad', weight: 1 });
  });

  it('writes the weight back only when it is not one', () => {
    expect(optionsToText(weighted(['a', 1], ['b', 2]))).toBe('a\nb x2');
  });

  it('round-trips through text', () => {
    const text = 'ก๋วยเตี๋ยว x2\nข้าวมันไก่\nส้มตำ x5';
    expect(optionsToText(optionsFromText(text))).toBe(text);
  });

  it('keeps a label that merely contains an x', () => {
    expect(optionsFromText('box')[0]).toMatchObject({ label: 'box', weight: 1 });
  });

  it('round-trips through the link', () => {
    const list = weighted(['a', 2], ['ข', 1]);
    const back = decodeOptions(encodeOptions(list));

    expect(back.map((option) => [option.label, option.weight])).toEqual([
      ['a', 2],
      ['ข', 1],
    ]);
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeOptions('not json')).toEqual([]);
    expect(decodeOptions('[["a"]]')).toEqual([]);
    expect(decodeOptions('[[1,2]]')).toEqual([]);
  });

  it('never takes more options than it will draw', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_OPTIONS + 10 }, (_, index) => [`o${index}`, 1]),
    );
    expect(decodeOptions(many)).toHaveLength(MAX_OPTIONS);
    expect(optionsFromText('a\n'.repeat(MAX_OPTIONS + 10))).toHaveLength(MAX_OPTIONS);
  });

  it('clamps a weight from a link rather than trusting it', () => {
    expect(decodeOptions('[["a",99999]]')[0]?.weight).toBeLessThanOrEqual(99);
    expect(decodeOptions('[["a",-5]]')[0]?.weight).toBe(1);
  });
});

describe('totalWeight', () => {
  it('adds up the live options only', () => {
    const list = weighted(['a', 2], ['b', 3]);
    list[0] = { ...(list[0] as WheelOption), removed: true };

    expect(totalWeight(list)).toBe(3);
  });

  it('treats a negative weight as nothing', () => {
    expect(totalWeight(weighted(['a', -5], ['b', 2]))).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts presets and history together', () => {
    expect(
      countStoredItems({
        presets: [{ id: 'a', name: 'x', options: [] }],
        history: [{ label: 'a' }, { label: 'b' }],
      }),
    ).toBe(3);
  });

  it('counts nothing for a shape it does not recognise', () => {
    expect(countStoredItems(null)).toBe(0);
    expect(countStoredItems('text')).toBe(0);
    expect(countStoredItems({})).toBe(0);
  });
});
