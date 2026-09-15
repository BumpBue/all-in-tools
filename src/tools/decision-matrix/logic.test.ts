import { describe, expect, it } from 'vitest';

import {
  EMPTY_DATA,
  FULL_WEIGHT,
  MATRIX_SCHEMA,
  MAX_SCORE,
  clampScore,
  clampWeight,
  countStoredItems,
  decodeDecision,
  emptyDecision,
  encodeDecision,
  migrate,
  normalizeWeights,
  ranking,
  reduceDecision,
  scoreOf,
  totalWeight,
  weightWarning,
  withFreshIds,
  type Decision,
} from '@/tools/decision-matrix/logic';

function decision(): Decision {
  return {
    id: 'd1',
    name: 'เลือกโน้ตบุ๊ก',
    criteria: [
      { id: 'c1', name: 'ราคา', weight: 50 },
      { id: 'c2', name: 'น้ำหนัก', weight: 30 },
      { id: 'c3', name: 'จอ', weight: 20 },
    ],
    options: [
      { id: 'o1', name: 'รุ่น A', scores: { c1: 8, c2: 6, c3: 9 } },
      { id: 'o2', name: 'รุ่น B', scores: { c1: 5, c2: 9, c3: 7 } },
    ],
  };
}

describe('scoring', () => {
  it('weights each criterion', () => {
    // 8×50 + 6×30 + 9×20 = 760 over 100.
    expect(scoreOf(decision().options[0]!, decision())).toBe(7.6);
  });

  it('treats a missing score as nothing', () => {
    const current = decision();
    const bare = { id: 'o3', name: 'รุ่น C', scores: {} };

    expect(scoreOf(bare, current)).toBe(0);
  });

  it('scores nothing when no criterion carries weight', () => {
    const current = decision();
    const flat = {
      ...current,
      criteria: current.criteria.map((criterion) => ({ ...criterion, weight: 0 })),
    };

    expect(scoreOf(current.options[0]!, flat)).toBe(0);
  });

  it('holds a score inside the scale', () => {
    expect(clampScore(99)).toBe(MAX_SCORE);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(7.46)).toBe(7.5);
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it('holds a weight inside the scale', () => {
    expect(clampWeight(500)).toBe(FULL_WEIGHT);
    expect(clampWeight(-1)).toBe(0);
  });
});

describe('ranking', () => {
  it('puts the best first', () => {
    const ranked = ranking(decision());

    expect(ranked[0]?.option.name).toBe('รุ่น A');
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });

  it('gives a tie the same rank and skips the next', () => {
    const current = decision();
    const tied: Decision = {
      ...current,
      options: [
        { id: 'o1', name: 'a', scores: { c1: 5, c2: 5, c3: 5 } },
        { id: 'o2', name: 'b', scores: { c1: 5, c2: 5, c3: 5 } },
        { id: 'o3', name: 'c', scores: { c1: 1, c2: 1, c3: 1 } },
      ],
    };

    const ranked = ranking(tied);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it('has nothing to rank when there are no options', () => {
    expect(ranking(emptyDecision('d1', 'x'))).toEqual([]);
  });
});

describe('weights', () => {
  it('says nothing when they already add to a hundred', () => {
    expect(weightWarning(decision())).toBeNull();
  });

  it('notices weights that fall short or overshoot', () => {
    const current = decision();
    const short = {
      ...current,
      criteria: current.criteria.map((criterion) => ({ ...criterion, weight: 10 })),
    };

    expect(weightWarning(short)).toBe('under');
    expect(
      weightWarning({
        ...current,
        criteria: current.criteria.map((criterion) => ({ ...criterion, weight: 50 })),
      }),
    ).toBe('over');
  });

  it('says nothing about a decision with no criteria yet', () => {
    expect(weightWarning(emptyDecision('d1', 'x'))).toBeNull();
  });

  it('rescales to exactly a hundred, keeping the proportions', () => {
    const current = decision();
    const doubled = {
      ...current,
      criteria: current.criteria.map((criterion) => ({
        ...criterion,
        weight: criterion.weight * 2,
      })),
    };

    const normalized = normalizeWeights(doubled);

    expect(totalWeight(normalized)).toBe(FULL_WEIGHT);
    expect(normalized.criteria.map((criterion) => criterion.weight)).toEqual([50, 30, 20]);
  });

  it('lands on exactly a hundred even when the split does not divide', () => {
    const thirds: Decision = {
      ...emptyDecision('d1', 'x'),
      criteria: [
        { id: 'c1', name: 'a', weight: 1 },
        { id: 'c2', name: 'b', weight: 1 },
        { id: 'c3', name: 'c', weight: 1 },
      ],
    };

    expect(totalWeight(normalizeWeights(thirds))).toBe(FULL_WEIGHT);
  });

  it('leaves weights that add to nothing alone rather than dividing by zero', () => {
    const zeroed: Decision = {
      ...emptyDecision('d1', 'x'),
      criteria: [{ id: 'c1', name: 'a', weight: 0 }],
    };

    expect(normalizeWeights(zeroed)).toEqual(zeroed);
  });

  it('does not change the ranking, only the numbers', () => {
    const current = decision();
    const doubled = {
      ...current,
      criteria: current.criteria.map((criterion) => ({
        ...criterion,
        weight: criterion.weight * 3,
      })),
    };

    expect(ranking(normalizeWeights(doubled)).map((entry) => entry.option.id)).toEqual(
      ranking(doubled).map((entry) => entry.option.id),
    );
  });
});

describe('actions', () => {
  it('adds an option and a criterion with ids of their own', () => {
    const withOption = reduceDecision(emptyDecision('d1', 'x'), {
      type: 'add-option',
      name: 'รุ่น A',
    }, 5);
    const withBoth = reduceDecision(withOption.decision, {
      type: 'add-criterion',
      name: 'ราคา',
    }, 6);

    expect(withOption.used).toBe(true);
    expect(withBoth.decision.options[0]?.id).not.toBe(withBoth.decision.criteria[0]?.id);
  });

  it('ignores a nameless option or criterion', () => {
    const current = emptyDecision('d1', 'x');

    expect(reduceDecision(current, { type: 'add-option', name: ' ' }, 1).used).toBe(false);
    expect(reduceDecision(current, { type: 'add-criterion', name: '' }, 1).used).toBe(
      false,
    );
  });

  it('takes the scores for a criterion away with it', () => {
    const after = reduceDecision(decision(), { type: 'remove-criterion', id: 'c1' }, 9);

    expect(after.decision.criteria).toHaveLength(2);
    expect(after.decision.options[0]?.scores.c1).toBeUndefined();
  });

  it('records a score', () => {
    const after = reduceDecision(
      decision(),
      { type: 'score', optionId: 'o1', criterionId: 'c1', score: 3 },
      9,
    );

    expect(after.decision.options[0]?.scores.c1).toBe(3);
  });
});

describe('a decision in a link', () => {
  it('survives the round trip', () => {
    const back = decodeDecision(encodeDecision(decision()), 'shared');

    expect(back?.name).toBe('เลือกโน้ตบุ๊ก');
    expect(back?.criteria.map((criterion) => criterion.weight)).toEqual([50, 30, 20]);
    expect(scoreOf(back?.options[0] as never, back as never)).toBe(7.6);
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeDecision('not json', 'd1')).toBeNull();
    expect(decodeDecision('[1,2]', 'd1')).toBeNull();
    expect(decodeDecision('["",[],[]]', 'd1')).toBeNull();
    expect(decodeDecision(undefined, 'd1')).toBeNull();
  });

  it('drops a score for a criterion the link does not carry', () => {
    const tampered = JSON.stringify([
      'x',
      [['c1', 'ราคา', 100]],
      [['o1', 'a', [['c1', 5], ['ghost', 9]]]],
    ]);

    expect(Object.keys(decodeDecision(tampered, 'd1')?.options[0]?.scores ?? {})).toEqual([
      'c1',
    ]);
  });
});

// Opening a link and saving it must not disturb anything already saved.
describe('opening from a link and saving it', () => {
  it('renames every id so nothing collides with what is stored', () => {
    const { decision: fresh, nextId } = withFreshIds(decision(), 40);

    expect(fresh.id).toBe('d40');
    expect(fresh.criteria.map((criterion) => criterion.id)).toEqual(['c41', 'c42', 'c43']);
    expect(fresh.options.map((option) => option.id)).toEqual(['o44', 'o45']);
    expect(nextId).toBe(46);
  });

  it('keeps every score pointing at the same criterion under its new id', () => {
    const { decision: fresh } = withFreshIds(decision(), 40);

    expect(scoreOf(fresh.options[0]!, fresh)).toBe(7.6);
    expect(ranking(fresh)[0]?.option.name).toBe('รุ่น A');
  });

  it('gives two saves of the same link two separate decisions', () => {
    const first = withFreshIds(decision(), 1);
    const second = withFreshIds(decision(), first.nextId);

    const ids = [
      first.decision.id,
      second.decision.id,
      ...first.decision.criteria.map((criterion) => criterion.id),
      ...second.decision.criteria.map((criterion) => criterion.id),
      ...first.decision.options.map((option) => option.id),
      ...second.decision.options.map((option) => option.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves the one already saved untouched when the second is scored', () => {
    const first = withFreshIds(decision(), 1);
    const second = withFreshIds(decision(), first.nextId);

    const criterionId = second.decision.criteria[0]?.id ?? '';
    const optionId = second.decision.options[0]?.id ?? '';

    const scored = reduceDecision(
      second.decision,
      { type: 'score', optionId, criterionId, score: 0 },
      99,
    );

    expect(scoreOf(scored.decision.options[0]!, scored.decision)).not.toBe(7.6);
    // The first one still reads exactly as it did.
    expect(scoreOf(first.decision.options[0]!, first.decision)).toBe(7.6);
  });

  it('survives the whole round trip a reader takes: link, decode, save, store', () => {
    const shared = decodeDecision(encodeDecision(decision()), 'shared');
    const saved = withFreshIds(shared as Decision, 10);

    const stored = migrate({
      schema: MATRIX_SCHEMA,
      decisions: [saved.decision],
      nextId: saved.nextId,
    });

    expect(stored.decisions).toHaveLength(1);
    expect(scoreOf(stored.decisions[0]?.options[0] as never, stored.decisions[0] as never))
      .toBe(7.6);
    // The stored counter is still above every id in the file.
    expect(stored.nextId).toBeGreaterThanOrEqual(saved.nextId);
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = { ...EMPTY_DATA, decisions: [decision()], nextId: 4 };
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ decisions: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: MATRIX_SCHEMA + 1, decisions: [] })).toEqual(EMPTY_DATA);
  });

  it('never hands out an id something stored already has', () => {
    const repaired = migrate({
      schema: MATRIX_SCHEMA,
      decisions: [
        {
          id: 'd3',
          name: 'x',
          criteria: [{ id: 'c20', name: 'a', weight: 100 }],
          options: [],
        },
      ],
      nextId: 1,
    });

    expect(repaired.nextId).toBeGreaterThan(20);
  });
});

describe('countStoredItems', () => {
  it('counts the saved decisions', () => {
    expect(countStoredItems({ decisions: [1, 2] })).toBe(2);
    expect(countStoredItems(null)).toBe(0);
  });
});
