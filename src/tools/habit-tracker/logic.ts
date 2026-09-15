import { DAYS_PER_WEEK, addDays, toDayKey, weekdayOf } from '@/lib/day';
import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const HABIT_SCHEMA = 1;

export const MAX_HABITS = 20;
export const MAX_NAME_LENGTH = 60;
export const MIN_TARGET = 1;
export const DAILY_TARGET = DAYS_PER_WEEK;

/** How far back a streak is allowed to be searched. */
const MAX_LOOKBACK_DAYS = 3_650;
const MAX_LOOKBACK_WEEKS = 520;

export interface Habit {
  id: string;
  name: string;
  /** 7 means every day; anything less is a weekly quota. */
  targetPerWeek: number;
  /** Day keys that were ticked, sorted. */
  days: string[];
}

export interface HabitData {
  schema: number;
  habits: Habit[];
  nextId: number;
}

export const EMPTY_DATA: HabitData = { schema: HABIT_SCHEMA, habits: [], nextId: 1 };

export function isDaily(habit: Habit): boolean {
  return habit.targetPerWeek >= DAILY_TARGET;
}

export function clampTarget(value: number): number {
  if (!Number.isFinite(value)) return DAILY_TARGET;
  return Math.min(DAILY_TARGET, Math.max(MIN_TARGET, Math.round(value)));
}

export function isTicked(habit: Habit, day: string): boolean {
  return habit.days.includes(day);
}

/** Weeks start on Sunday, matching the heatmap's rows. */
export function weekStart(day: string): string {
  return addDays(day, -weekdayOf(day));
}

export function ticksInWeek(habit: Habit, start: string): number {
  const end = addDays(start, DAYS_PER_WEEK - 1);
  return habit.days.filter((day) => day >= start && day <= end).length;
}

/**
 * What a streak means here, in one place, because the answer is not obvious
 * for a habit that is not meant to be daily.
 *
 * A daily habit counts days: the run of consecutive days ticked. Today not
 * being ticked does not break it — the day is not over — so the count starts
 * at today if it is ticked and at yesterday if it is not.
 *
 * A habit with a weekly quota counts weeks instead: the run of consecutive
 * weeks in which the quota was met. Counting days there would call a perfectly
 * kept three-times-a-week habit a broken streak four days out of seven. The
 * current week is included once its quota is met and otherwise left out rather
 * than counted as a failure, for the same reason.
 */
export function currentStreak(habit: Habit, today: string): number {
  if (habit.days.length === 0) return 0;

  if (isDaily(habit)) {
    let day = isTicked(habit, today) ? today : addDays(today, -1);
    let streak = 0;

    while (streak < MAX_LOOKBACK_DAYS && isTicked(habit, day)) {
      streak += 1;
      day = addDays(day, -1);
    }

    return streak;
  }

  let start = weekStart(today);
  let streak = 0;

  if (ticksInWeek(habit, start) >= habit.targetPerWeek) streak += 1;
  start = addDays(start, -DAYS_PER_WEEK);

  while (
    streak < MAX_LOOKBACK_WEEKS &&
    ticksInWeek(habit, start) >= habit.targetPerWeek
  ) {
    streak += 1;
    start = addDays(start, -DAYS_PER_WEEK);
  }

  return streak;
}

export function longestStreak(habit: Habit, today: string): number {
  if (habit.days.length === 0) return 0;

  const first = habit.days[0] ?? today;

  if (isDaily(habit)) {
    let best = 0;
    let run = 0;
    let day = first;

    while (day <= today) {
      run = isTicked(habit, day) ? run + 1 : 0;
      best = Math.max(best, run);
      day = addDays(day, 1);
    }

    return best;
  }

  let best = 0;
  let run = 0;
  let start = weekStart(first);
  const lastStart = weekStart(today);

  while (start <= lastStart) {
    const met = ticksInWeek(habit, start) >= habit.targetPerWeek;
    // The week in progress cannot break a run it has not finished.
    const inProgress = start === lastStart && !met;

    if (!inProgress) {
      run = met ? run + 1 : 0;
      best = Math.max(best, run);
    }

    start = addDays(start, DAYS_PER_WEEK);
  }

  return best;
}

export function ticksByDay(habit: Habit): Record<string, number> {
  return Object.fromEntries(habit.days.map((day) => [day, 1]));
}

export function allTicksByDay(data: HabitData): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const habit of data.habits) {
    for (const day of habit.days) counts[day] = (counts[day] ?? 0) + 1;
  }

  return counts;
}

export function completionRate(habit: Habit, today: string, days: number): number {
  const from = addDays(today, -(days - 1));
  const ticks = habit.days.filter((day) => day >= from && day <= today).length;
  const expected = isDaily(habit)
    ? days
    : Math.round((days / DAYS_PER_WEEK) * habit.targetPerWeek);

  if (expected <= 0) return 0;
  return Math.min(100, Math.round((ticks / expected) * 100));
}

export type HabitAction =
  | { type: 'add'; name: string; targetPerWeek: number }
  | { type: 'rename'; id: string; name: string }
  | { type: 'retarget'; id: string; targetPerWeek: number }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string; day: string };

export function reduce(data: HabitData, action: HabitAction): HabitData {
  switch (action.type) {
    case 'add': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || data.habits.length >= MAX_HABITS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        habits: [
          ...data.habits,
          {
            id: `h${data.nextId}`,
            name,
            targetPerWeek: clampTarget(action.targetPerWeek),
            days: [],
          },
        ],
      };
    }

    case 'rename':
      return {
        ...data,
        habits: data.habits.map((habit) =>
          habit.id === action.id
            ? { ...habit, name: action.name.slice(0, MAX_NAME_LENGTH) }
            : habit,
        ),
      };

    case 'retarget':
      return {
        ...data,
        habits: data.habits.map((habit) =>
          habit.id === action.id
            ? { ...habit, targetPerWeek: clampTarget(action.targetPerWeek) }
            : habit,
        ),
      };

    case 'remove':
      return { ...data, habits: data.habits.filter((habit) => habit.id !== action.id) };

    default:
      return {
        ...data,
        habits: data.habits.map((habit) => {
          if (habit.id !== action.id) return habit;

          const ticked = isTicked(habit, action.day);
          const days = ticked
            ? habit.days.filter((day) => day !== action.day)
            : [...habit.days, action.day].sort();

          return { ...habit, days };
        }),
      };
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return Array.isArray(data.habits) ? data.habits.length : 0;
}

export function migrate(raw: unknown): HabitData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > HABIT_SCHEMA) return EMPTY_DATA;

  const habits = asArray(raw.habits)
    .slice(0, MAX_HABITS)
    .filter(isRecord)
    .map((habit, index) => ({
      id: asString(habit.id, `h${index}`),
      name: asString(habit.name).slice(0, MAX_NAME_LENGTH),
      targetPerWeek: clampTarget(asNumber(habit.targetPerWeek, DAILY_TARGET)),
      days: [
        ...new Set(
          asArray(habit.days)
            .filter((day): day is string => typeof day === 'string')
            .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)),
        ),
      ].sort(),
    }))
    .filter((habit) => habit.name.length > 0);

  const highest = habits.reduce((top, habit) => {
    const numeric = Number(habit.id.replace(/\D/g, ''));
    return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
  }, 0);

  return {
    schema: HABIT_SCHEMA,
    habits,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}

export function todayKey(now: number): string {
  return toDayKey(now);
}
