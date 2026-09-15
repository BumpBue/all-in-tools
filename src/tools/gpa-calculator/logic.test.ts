import { describe, expect, it } from 'vitest';

import {
  EMPTY_DATA,
  GPA_SCHEMA,
  GRADES,
  GRADE_POINTS,
  MAX_GPA,
  clampCredits,
  countStoredItems,
  cumulativeThrough,
  cumulativeTotals,
  isGrade,
  migrate,
  reduce,
  requiredNextTerm,
  roundGpa,
  termTotals,
  totalsOf,
  type Course,
  type GpaData,
  type Grade,
} from '@/tools/gpa-calculator/logic';

function course(credits: number, grade: Grade, id = 'c1'): Course {
  return { id, name: `วิชา ${id}`, credits, grade };
}

function dataWith(...terms: Array<[string, Course[]]>): GpaData {
  return {
    ...EMPTY_DATA,
    terms: terms.map(([name, courses], index) => ({
      id: `t${index + 1}`,
      name,
      courses,
    })),
  };
}

describe('the scale', () => {
  it('is the Thai four-point scale', () => {
    expect(GRADES).toEqual(['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']);
    expect(GRADE_POINTS.A).toBe(4);
    expect(GRADE_POINTS['B+']).toBe(3.5);
    expect(GRADE_POINTS.F).toBe(0);
  });

  it('falls by half a point a step down to D, then a full point to F', () => {
    // There is no D− on this scale, so the last step is twice the others.
    const steps = GRADES.slice(0, -1).map(
      (grade, index) => GRADE_POINTS[grade] - GRADE_POINTS[GRADES[index + 1]!],
    );

    expect(steps.slice(0, -1)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(steps[steps.length - 1]).toBe(1);
  });

  it('recognises a grade', () => {
    expect(isGrade('B+')).toBe(true);
    expect(isGrade('A+')).toBe(false);
  });
});

describe('totals', () => {
  it('weights each course by its credits', () => {
    // 3 credits at 4.0 and 1 credit at 2.0 is 14 points over 4 credits.
    const totals = totalsOf([course(3, 'A'), course(1, 'C', 'c2')]);

    expect(totals.credits).toBe(4);
    expect(totals.points).toBe(14);
    expect(totals.gpa).toBe(3.5);
  });

  it('is zero for no courses, rather than dividing by nothing', () => {
    expect(totalsOf([])).toEqual({ credits: 0, points: 0, gpa: 0 });
  });

  it('counts an F as credits attempted with no points', () => {
    const totals = totalsOf([course(3, 'A'), course(3, 'F', 'c2')]);

    expect(totals.credits).toBe(6);
    expect(totals.gpa).toBe(2);
  });

  it('rounds to two places, which is how a transcript prints it', () => {
    expect(totalsOf([course(3, 'A'), course(3, 'B', 'c2'), course(3, 'C', 'c3')]).gpa)
      .toBe(3);
    expect(roundGpa(3.666666)).toBe(3.67);
  });

  it('takes half credits, which some courses carry', () => {
    expect(clampCredits(1.5)).toBe(1.5);
    expect(clampCredits(1.4)).toBe(1.5);
    expect(clampCredits(-2)).toBe(0);
  });
});

describe('cumulative', () => {
  const data = dataWith(
    ['เทอม 1', [course(3, 'A'), course(3, 'B', 'c2')]],
    ['เทอม 2', [course(3, 'C', 'c3')]],
  );

  it('adds every term together', () => {
    const totals = cumulativeTotals(data);

    expect(totals.credits).toBe(9);
    expect(totals.gpa).toBe(3);
  });

  it('gives each term its own figure', () => {
    expect(termTotals(data.terms[0]!).gpa).toBe(3.5);
    expect(termTotals(data.terms[1]!).gpa).toBe(2);
  });

  it('reports the running total up to a term', () => {
    expect(cumulativeThrough(data, 't1').gpa).toBe(3.5);
    expect(cumulativeThrough(data, 't2').gpa).toBe(3);
  });

  // The thing that would break if a running total were stored rather than
  // computed: fixing a grade from two years ago has to move everything after.
  it('recomputes after an old grade is corrected', () => {
    const fixed = reduce(data, {
      type: 'edit-course',
      termId: 't1',
      courseId: 'c2',
      patch: { grade: 'A' },
    });

    expect(termTotals(fixed.terms[0]!).gpa).toBe(4);
    expect(cumulativeTotals(fixed).gpa).toBeCloseTo(3.33, 2);
  });
});

describe('requiredNextTerm', () => {
  const current = totalsOf([course(3, 'C'), course(3, 'C', 'c2')]); // 12 points / 6

  it('works out the average next term has to hit', () => {
    // To reach 2.5 over 12 credits: 30 points total, 18 more over 6 credits.
    expect(requiredNextTerm(current, 6, 2.5)).toEqual({ state: 'possible', needed: 3 });
  });

  it('says so when the target is already met', () => {
    expect(requiredNextTerm(current, 6, 2)).toMatchObject({ state: 'reached' });
    expect(requiredNextTerm(current, 6, 1.5)).toMatchObject({ state: 'reached' });
  });

  it('says so when even a perfect term falls short', () => {
    const result = requiredNextTerm(current, 3, 3.8);

    expect(result.state).toBe('impossible');
    expect(result.needed).toBeGreaterThan(MAX_GPA);
  });

  it('treats exactly 4.00 as possible, not impossible', () => {
    // 6 credits at 2.0, planning 6 more: a 4.0 term gives exactly 3.0.
    expect(requiredNextTerm(current, 6, 3)).toEqual({ state: 'possible', needed: 4 });
  });

  it('asks for credits before it can answer', () => {
    expect(requiredNextTerm(current, 0, 3.5)).toMatchObject({ state: 'no-credits' });
  });

  it('never asks for a negative average, whatever the numbers', () => {
    for (const grade of GRADES) {
      for (const target of [0, 1, 2, 2.5, 3, 3.5, 4]) {
        const result = requiredNextTerm(totalsOf([course(3, grade)]), 12, target);
        if (result.needed !== null) expect(result.needed).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('answers from nothing, for a first term', () => {
    expect(requiredNextTerm(totalsOf([]), 12, 3.5)).toEqual({
      state: 'possible',
      needed: 3.5,
    });
  });
});

describe('actions', () => {
  it('adds a term and a course in it', () => {
    const withTerm = reduce(EMPTY_DATA, { type: 'add-term', name: 'เทอม 1' });
    const withCourse = reduce(withTerm, {
      type: 'add-course',
      termId: withTerm.terms[0]?.id ?? '',
    });

    expect(withCourse.terms[0]?.courses).toHaveLength(1);
  });

  it('ignores a term with no name', () => {
    expect(reduce(EMPTY_DATA, { type: 'add-term', name: '   ' })).toBe(EMPTY_DATA);
  });

  it('gives every term and course an id of its own', () => {
    let data = reduce(EMPTY_DATA, { type: 'add-term', name: 'a' });
    data = reduce(data, { type: 'add-term', name: 'b' });
    data = reduce(data, { type: 'add-course', termId: 't1' });
    data = reduce(data, { type: 'add-course', termId: 't1' });

    const ids = [
      ...data.terms.map((term) => term.id),
      ...data.terms.flatMap((term) => term.courses.map((course) => course.id)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('removes a course and a term', () => {
    const data = dataWith(['เทอม 1', [course(3, 'A')]]);

    expect(
      reduce(data, { type: 'remove-course', termId: 't1', courseId: 'c1' }).terms[0]
        ?.courses,
    ).toHaveLength(0);
    expect(reduce(data, { type: 'remove-term', termId: 't1' }).terms).toHaveLength(0);
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = dataWith(['เทอม 1', [course(3, 'A')]]);
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual({
      ...data,
      nextId: 2,
    });
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ terms: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: GPA_SCHEMA + 1, terms: [] })).toEqual(EMPTY_DATA);
  });

  it('reads an unknown grade as an F rather than dropping the credits', () => {
    // Losing the course would quietly raise the GPA, which is the wrong way to
    // be wrong about somebody's transcript.
    const repaired = migrate({
      schema: GPA_SCHEMA,
      terms: [
        { id: 't1', name: 'เทอม 1', courses: [{ id: 'c1', credits: 3, grade: 'Z' }] },
      ],
      nextId: 2,
    });

    expect(repaired.terms[0]?.courses[0]?.grade).toBe('F');
    expect(cumulativeTotals(repaired).credits).toBe(3);
  });

  it('never hands out an id a stored course already has', () => {
    const repaired = migrate({
      schema: GPA_SCHEMA,
      terms: [{ id: 't5', name: 'x', courses: [{ id: 'c9', credits: 3, grade: 'A' }] }],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add-course', termId: 't5' });
    const ids = added.terms[0]?.courses.map((each) => each.id) ?? [];

    expect(new Set(ids).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts courses across every term', () => {
    expect(countStoredItems({ terms: [{ courses: [1, 2] }, { courses: [3] }] })).toBe(3);
    expect(countStoredItems(null)).toBe(0);
  });
});
