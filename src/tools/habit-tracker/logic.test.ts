import { describe, expect, it } from 'vitest';

import { addDays, weekdayOf } from '@/lib/day';
import {
  DAILY_TARGET,
  EMPTY_DATA,
  HABIT_SCHEMA,
  MAX_HABITS,
  allTicksByDay,
  clampTarget,
  completionRate,
  countStoredItems,
  currentStreak,
  isDaily,
  isTicked,
  longestStreak,
  migrate,
  reduce,
  ticksInWeek,
  weekStart,
  type Habit,
} from '@/tools/habit-tracker/logic';

// A Sunday, so the week boundaries in these tests are easy to follow.
const SUNDAY = '2026-09-13';
const WEDNESDAY = '2026-09-16';

function habit(overrides: Partial<Habit> = {}): Habit {
  return { id: 'h1', name: 'อ่านหนังสือ', targetPerWeek: DAILY_TARGET, days: [], ...overrides };
}

function runOfDays(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(last, -index)).sort();
}

describe('the week', () => {
  it('starts on Sunday, matching the heatmap', () => {
    expect(weekdayOf(SUNDAY)).toBe(0);
    expect(weekStart(WEDNESDAY)).toBe(SUNDAY);
    expect(weekStart(SUNDAY)).toBe(SUNDAY);
  });

  it('counts the ticks inside one week and no further', () => {
    const tracked = habit({
      days: [addDays(SUNDAY, -1), SUNDAY, WEDNESDAY, addDays(SUNDAY, 7)],
    });

    expect(ticksInWeek(tracked, SUNDAY)).toBe(2);
  });

  it('knows a daily habit from a weekly one', () => {
    expect(isDaily(habit())).toBe(true);
    expect(isDaily(habit({ targetPerWeek: 3 }))).toBe(false);
  });
});

describe('a daily habit', () => {
  it('counts consecutive days', () => {
    const tracked = habit({ days: runOfDays(WEDNESDAY, 4) });
    expect(currentStreak(tracked, WEDNESDAY)).toBe(4);
  });

  it('does not break because today is not ticked yet', () => {
    // Yesterday and before are ticked; the day is not over.
    const tracked = habit({ days: runOfDays(addDays(WEDNESDAY, -1), 3) });
    expect(currentStreak(tracked, WEDNESDAY)).toBe(3);
  });

  it('breaks on a missed day', () => {
    const tracked = habit({
      days: [...runOfDays(addDays(WEDNESDAY, -2), 3), WEDNESDAY],
    });

    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });

  it('is zero for a habit never ticked', () => {
    expect(currentStreak(habit(), WEDNESDAY)).toBe(0);
    expect(longestStreak(habit(), WEDNESDAY)).toBe(0);
  });

  it('remembers the best run even after it breaks', () => {
    const tracked = habit({
      days: [...runOfDays(addDays(WEDNESDAY, -10), 5), WEDNESDAY],
    });

    expect(longestStreak(tracked, WEDNESDAY)).toBe(5);
    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });

  it('counts a run that is still going as the longest', () => {
    const tracked = habit({ days: runOfDays(WEDNESDAY, 6) });
    expect(longestStreak(tracked, WEDNESDAY)).toBe(6);
  });
});

// The part worth getting right: three times a week is not a broken streak on
// the four days you did not do it.
describe('a habit with a weekly quota', () => {
  const target = 3;

  it('counts weeks that met the quota, not days', () => {
    const tracked = habit({
      targetPerWeek: target,
      days: [
        // Three in the week before last.
        addDays(SUNDAY, -14),
        addDays(SUNDAY, -12),
        addDays(SUNDAY, -10),
        // Three last week.
        addDays(SUNDAY, -7),
        addDays(SUNDAY, -5),
        addDays(SUNDAY, -3),
        // Three this week.
        SUNDAY,
        addDays(SUNDAY, 1),
        WEDNESDAY,
      ],
    });

    expect(currentStreak(tracked, WEDNESDAY)).toBe(3);
  });

  it('does not count a week that fell short', () => {
    const tracked = habit({
      targetPerWeek: target,
      days: [addDays(SUNDAY, -7), addDays(SUNDAY, -5), SUNDAY, addDays(SUNDAY, 1), WEDNESDAY],
    });

    // Last week had two of three, so the run is this week alone.
    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });

  it('does not punish a week still in progress', () => {
    const tracked = habit({
      targetPerWeek: target,
      days: [
        addDays(SUNDAY, -7),
        addDays(SUNDAY, -5),
        addDays(SUNDAY, -3),
        // Only one so far this week, and the week is not over.
        SUNDAY,
      ],
    });

    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });

  it('counts an unfinished week once its quota is met', () => {
    const tracked = habit({
      targetPerWeek: target,
      days: [SUNDAY, addDays(SUNDAY, 1), addDays(SUNDAY, 2)],
    });

    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });

  it('remembers the best run of weeks', () => {
    const tracked = habit({
      targetPerWeek: 2,
      days: [
        addDays(SUNDAY, -28),
        addDays(SUNDAY, -27),
        addDays(SUNDAY, -21),
        addDays(SUNDAY, -20),
        // A week missed here.
        addDays(SUNDAY, -7),
        addDays(SUNDAY, -6),
      ],
    });

    expect(longestStreak(tracked, WEDNESDAY)).toBe(2);
  });

  it('would read very differently if days were counted', () => {
    // Sunday, Monday and Thursday of the week holding today, which is
    // Wednesday. Neither today nor yesterday was ticked.
    const tracked = habit({
      targetPerWeek: target,
      days: [SUNDAY, addDays(SUNDAY, 1), addDays(SUNDAY, 4)],
    });

    // Read as a daily habit that is a broken streak; read against a quota of
    // three a week it is a week kept in full.
    expect(currentStreak({ ...tracked, targetPerWeek: DAILY_TARGET }, WEDNESDAY)).toBe(0);
    expect(currentStreak(tracked, WEDNESDAY)).toBe(1);
  });
});

describe('completionRate', () => {
  it('is the share of days kept for a daily habit', () => {
    const tracked = habit({ days: runOfDays(WEDNESDAY, 7) });
    expect(completionRate(tracked, WEDNESDAY, 7)).toBe(100);
  });

  it('measures a weekly habit against its own quota', () => {
    const tracked = habit({
      targetPerWeek: 3,
      days: [SUNDAY, addDays(SUNDAY, 2), WEDNESDAY],
    });

    expect(completionRate(tracked, WEDNESDAY, 7)).toBe(100);
  });

  it('never claims more than everything', () => {
    const tracked = habit({ targetPerWeek: 1, days: runOfDays(WEDNESDAY, 7) });
    expect(completionRate(tracked, WEDNESDAY, 7)).toBe(100);
  });

  it('is nothing when nothing was done', () => {
    expect(completionRate(habit(), WEDNESDAY, 7)).toBe(0);
  });
});

describe('actions', () => {
  it('adds a habit with its target', () => {
    const data = reduce(EMPTY_DATA, { type: 'add', name: 'วิ่ง', targetPerWeek: 3 });

    expect(data.habits).toHaveLength(1);
    expect(data.habits[0]).toMatchObject({ name: 'วิ่ง', targetPerWeek: 3, days: [] });
  });

  it('ignores a habit with no name', () => {
    expect(reduce(EMPTY_DATA, { type: 'add', name: '  ', targetPerWeek: 7 })).toBe(
      EMPTY_DATA,
    );
  });

  it('holds the target inside one and seven', () => {
    expect(clampTarget(0)).toBe(1);
    expect(clampTarget(99)).toBe(DAILY_TARGET);
    expect(clampTarget(Number.NaN)).toBe(DAILY_TARGET);
  });

  it('stops at the number of habits it will track', () => {
    let data = EMPTY_DATA;
    for (let index = 0; index < MAX_HABITS + 5; index += 1) {
      data = reduce(data, { type: 'add', name: `h${index}`, targetPerWeek: 7 });
    }

    expect(data.habits).toHaveLength(MAX_HABITS);
  });

  it('ticks a day and unticks it again', () => {
    const added = reduce(EMPTY_DATA, { type: 'add', name: 'x', targetPerWeek: 7 });
    const id = added.habits[0]?.id ?? '';

    const ticked = reduce(added, { type: 'toggle', id, day: WEDNESDAY });
    expect(isTicked(ticked.habits[0]!, WEDNESDAY)).toBe(true);

    const unticked = reduce(ticked, { type: 'toggle', id, day: WEDNESDAY });
    expect(isTicked(unticked.habits[0]!, WEDNESDAY)).toBe(false);
  });

  it('ticks a day in the past, which is the point of being able to backfill', () => {
    const added = reduce(EMPTY_DATA, { type: 'add', name: 'x', targetPerWeek: 7 });
    const id = added.habits[0]?.id ?? '';
    const yesterday = addDays(WEDNESDAY, -1);

    const ticked = reduce(added, { type: 'toggle', id, day: yesterday });
    expect(isTicked(ticked.habits[0]!, yesterday)).toBe(true);
  });

  it('keeps the days sorted however they were ticked', () => {
    const added = reduce(EMPTY_DATA, { type: 'add', name: 'x', targetPerWeek: 7 });
    const id = added.habits[0]?.id ?? '';

    const out = [WEDNESDAY, SUNDAY, addDays(SUNDAY, 1)].reduce(
      (data, day) => reduce(data, { type: 'toggle', id, day }),
      added,
    );

    expect(out.habits[0]?.days).toEqual([...(out.habits[0]?.days ?? [])].sort());
  });

  it('renames, retargets and removes', () => {
    const added = reduce(EMPTY_DATA, { type: 'add', name: 'x', targetPerWeek: 7 });
    const id = added.habits[0]?.id ?? '';

    expect(reduce(added, { type: 'rename', id, name: 'y' }).habits[0]?.name).toBe('y');
    expect(
      reduce(added, { type: 'retarget', id, targetPerWeek: 2 }).habits[0]?.targetPerWeek,
    ).toBe(2);
    expect(reduce(added, { type: 'remove', id }).habits).toHaveLength(0);
  });
});

describe('allTicksByDay', () => {
  it('adds up every habit ticked on a day', () => {
    const data = {
      ...EMPTY_DATA,
      habits: [
        habit({ id: 'a', days: [SUNDAY, WEDNESDAY] }),
        habit({ id: 'b', days: [SUNDAY] }),
      ],
    };

    expect(allTicksByDay(data)).toEqual({ [SUNDAY]: 2, [WEDNESDAY]: 1 });
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = reduce(
      reduce(EMPTY_DATA, { type: 'add', name: 'x', targetPerWeek: 3 }),
      { type: 'toggle', id: 'h1', day: WEDNESDAY },
    );

    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ habits: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: HABIT_SCHEMA + 1, habits: [] })).toEqual(EMPTY_DATA);
  });

  it('throws away a day that is not a date', () => {
    const repaired = migrate({
      schema: HABIT_SCHEMA,
      habits: [{ id: 'h1', name: 'x', targetPerWeek: 7, days: ['2026-09-15', 'yesterday', 42] }],
      nextId: 2,
    });

    expect(repaired.habits[0]?.days).toEqual(['2026-09-15']);
  });

  it('removes a day recorded twice', () => {
    const repaired = migrate({
      schema: HABIT_SCHEMA,
      habits: [{ id: 'h1', name: 'x', targetPerWeek: 7, days: [SUNDAY, SUNDAY] }],
      nextId: 2,
    });

    expect(repaired.habits[0]?.days).toEqual([SUNDAY]);
  });

  it('never hands out an id a stored habit already has', () => {
    const repaired = migrate({
      schema: HABIT_SCHEMA,
      habits: [{ id: 'h7', name: 'x', targetPerWeek: 7, days: [] }],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add', name: 'new', targetPerWeek: 7 });
    expect(new Set(added.habits.map((each) => each.id)).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts the habits tracked', () => {
    expect(countStoredItems({ habits: [1, 2] })).toBe(2);
    expect(countStoredItems(null)).toBe(0);
  });
});
