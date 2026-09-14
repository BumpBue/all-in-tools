import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CUTOFFS,
  FULL_WEIGHT,
  GRADES,
  cutoffsDescend,
  decodeCutoffs,
  decodeItems,
  emptyItem,
  encodeCutoffs,
  encodeItems,
  itemContribution,
  itemIssue,
  requirementFor,
  requirementsFor,
  roundScore,
  standingOf,
  toNumber,
  weightWarning,
  type RawItem,
} from '@/tools/target-grade/logic';

function item(
  score: string,
  max: string,
  weight: string,
  name = 'งาน',
  id = 'a',
): RawItem {
  return { id, name, score, max, weight };
}

describe('toNumber', () => {
  it('reads a blank field as zero rather than as a mistake', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber('   ')).toBe(0);
  });

  it('reads decimals', () => {
    expect(toNumber('7.5')).toBe(7.5);
    expect(toNumber('.5')).toBe(0.5);
  });

  it('refuses anything that is not a number', () => {
    expect(toNumber('ห้า')).toBeNull();
    expect(toNumber('8/10')).toBeNull();
    expect(toNumber('1e3')).toBeNull();
  });
});

describe('itemIssue', () => {
  it('accepts a normal row', () => {
    expect(itemIssue(item('8', '10', '20'))).toBeNull();
  });

  it('refuses a full score of zero, which has no ratio', () => {
    expect(itemIssue(item('8', '0', '20'))).toBe('max-not-positive');
    expect(itemIssue(item('8', '', '20'))).toBe('max-not-positive');
  });

  it('refuses a negative score', () => {
    expect(itemIssue(item('-1', '10', '20'))).toBe('score-negative');
  });

  it('refuses a score above the full score', () => {
    expect(itemIssue(item('11', '10', '20'))).toBe('score-above-max');
  });

  it('refuses a negative weight', () => {
    expect(itemIssue(item('8', '10', '-5'))).toBe('weight-negative');
  });

  it('accepts a full score', () => {
    expect(itemIssue(item('10', '10', '20'))).toBeNull();
  });
});

describe('itemContribution', () => {
  it('turns a raw score into percentage points of the course', () => {
    expect(itemContribution(item('8', '10', '20'))).toBe(16);
    expect(itemContribution(item('10', '10', '30'))).toBe(30);
    expect(itemContribution(item('0', '10', '30'))).toBe(0);
  });

  it('contributes nothing for a row that cannot be read', () => {
    expect(itemContribution(item('8', '0', '20'))).toBeNull();
  });
});

describe('standingOf', () => {
  it('adds up what is already earned and what it was worth', () => {
    const standing = standingOf([item('8', '10', '20'), item('15', '30', '30', 'สอบ', 'b')], '50');

    expect(standing.earned).toBe(31);
    expect(standing.completedWeight).toBe(50);
    expect(standing.finalWeight).toBe(50);
    expect(standing.totalWeight).toBe(100);
  });

  it('leaves unreadable rows out of both totals', () => {
    const standing = standingOf([item('8', '10', '20'), item('5', '0', '30', 'พัง', 'b')], '50');

    expect(standing.earned).toBe(16);
    expect(standing.completedWeight).toBe(20);
  });

  it('reports the best still reachable', () => {
    expect(standingOf([item('5', '10', '40')], '60').ceiling).toBe(80);
  });

  it('treats a missing or negative final weight as no final at all', () => {
    expect(standingOf([], '').finalWeight).toBe(0);
    expect(standingOf([], '-10').finalWeight).toBe(0);
  });

  it('starts at zero with no rows', () => {
    expect(standingOf([emptyItem('a')], '30')).toMatchObject({
      earned: 0,
      completedWeight: 0,
    });
  });
});

describe('requirementFor', () => {
  const standing = standingOf([item('40', '100', '60')], '40');

  it('works out the percent still needed on the final', () => {
    // 24 points earned, 40 left: a C at 60 needs 36 of those 40, or 90%.
    expect(requirementFor('C', 60, standing)).toMatchObject({
      state: 'possible',
      needed: 90,
    });
  });

  it('calls a grade secured when the points are already there', () => {
    expect(requirementFor('D', 20, standing)).toMatchObject({
      state: 'secured',
      needed: null,
    });
  });

  it('calls a grade impossible when even a perfect final falls short', () => {
    expect(requirementFor('A', 80, standing)).toMatchObject({ state: 'impossible' });
    expect(requirementFor('A', 80, standing).needed).toBeGreaterThan(FULL_WEIGHT);
  });

  it('treats exactly 100% as still possible, not as impossible', () => {
    const tight = standingOf([item('20', '100', '60')], '40');
    expect(requirementFor('C', 52, tight)).toMatchObject({
      state: 'possible',
      needed: 100,
    });
  });

  it('says there is no final to decide it when nothing is left', () => {
    const done = standingOf([item('50', '100', '100')], '0');
    expect(requirementFor('A', 80, done)).toMatchObject({
      state: 'no-final',
      needed: null,
    });
    expect(requirementFor('D', 50, done).state).toBe('secured');
  });

  it('is secured at exactly the cutoff, not one point above it', () => {
    const exact = standingOf([item('60', '100', '100')], '0');
    expect(requirementFor('C', 60, exact).state).toBe('secured');
  });
});

describe('requirementsFor', () => {
  it('answers for all seven grades in order', () => {
    const rows = requirementsFor(standingOf([item('30', '100', '60')], '40'), {
      ...DEFAULT_CUTOFFS,
    });

    expect(rows.map((row) => row.grade)).toEqual([...GRADES]);
  });

  it('needs less for a lower grade', () => {
    const rows = requirementsFor(standingOf([item('50', '100', '60')], '40'), {
      ...DEFAULT_CUTOFFS,
    });
    const needed = rows.map((row) => row.needed ?? 0).filter((value) => value > 0);

    expect([...needed].sort((a, b) => b - a)).toEqual(needed);
  });
});

describe('weightWarning', () => {
  it('says nothing when the weights add up', () => {
    expect(weightWarning(standingOf([item('8', '10', '60')], '40'))).toBeNull();
  });

  it('notices weights that fall short or overshoot', () => {
    expect(weightWarning(standingOf([item('8', '10', '50')], '40'))).toBe('under');
    expect(weightWarning(standingOf([item('8', '10', '70')], '40'))).toBe('over');
  });
});

describe('cutoffsDescend', () => {
  it('accepts the standard scale', () => {
    expect(cutoffsDescend(DEFAULT_CUTOFFS)).toBe(true);
  });

  it('rejects a scale where a lower grade needs more', () => {
    expect(cutoffsDescend({ ...DEFAULT_CUTOFFS, B: 90 })).toBe(false);
  });

  it('rejects two grades at the same cutoff', () => {
    expect(cutoffsDescend({ ...DEFAULT_CUTOFFS, B: 75 })).toBe(false);
  });
});

describe('items in the link', () => {
  it('survives a round trip', () => {
    const items = [item('8', '10', '20', 'ควิซ 1'), item('25', '30', '30', 'กลางภาค', 'b')];
    const back = decodeItems(encodeItems(items));

    expect(back.map(({ name, score, max, weight }) => ({ name, score, max, weight }))).toEqual(
      items.map(({ name, score, max, weight }) => ({ name, score, max, weight })),
    );
  });

  it('keeps a name containing a comma, which a separator would have split', () => {
    const items = [item('8', '10', '20', 'ควิซ 1, ตอน 2')];
    expect(decodeItems(encodeItems(items))[0]?.name).toBe('ควิซ 1, ตอน 2');
  });

  it('writes nothing for rows the reader has not filled in', () => {
    expect(encodeItems([emptyItem('a')])).toBe('');
  });

  it('gives every decoded row an id of its own', () => {
    const ids = decodeItems(encodeItems([item('1', '2', '3'), item('4', '5', '6', 'b', 'b')])).map(
      (row) => row.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeItems('not json')).toEqual([]);
    expect(decodeItems('{"a":1}')).toEqual([]);
    expect(decodeItems('[[1,2,3,4]]')).toEqual([]);
    expect(decodeItems('[["a","b"]]')).toEqual([]);
  });

  it('reads nothing as an empty list', () => {
    expect(decodeItems(undefined)).toEqual([]);
    expect(decodeItems('')).toEqual([]);
  });
});

describe('cutoffs in the link', () => {
  it('survives a round trip', () => {
    expect(decodeCutoffs(encodeCutoffs(DEFAULT_CUTOFFS))).toEqual(DEFAULT_CUTOFFS);
  });

  it('carries an edited scale', () => {
    const custom = { ...DEFAULT_CUTOFFS, A: 85 };
    expect(decodeCutoffs(encodeCutoffs(custom)).A).toBe(85);
  });

  it('falls back to the standard scale when the link is wrong', () => {
    expect(decodeCutoffs('80,75')).toEqual(DEFAULT_CUTOFFS);
    expect(decodeCutoffs('a,b,c,d,e,f,g')).toEqual(DEFAULT_CUTOFFS);
    expect(decodeCutoffs(undefined)).toEqual(DEFAULT_CUTOFFS);
  });
});

describe('roundScore', () => {
  it('keeps two places, which is what a score is printed to', () => {
    expect(roundScore(66.666666)).toBe(66.67);
    expect(roundScore(80)).toBe(80);
  });
});
