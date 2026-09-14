import { thaiHolidaySet } from '@/tools/date-calculator/holidays';

export const BUDDHIST_YEAR_OFFSET = 543;

export type DateUnit = 'days' | 'weeks' | 'months' | 'years';
export const DATE_UNITS: readonly DateUnit[] = ['days', 'weeks', 'months', 'years'];

/**
 * What to do when the target month has no such day — 31 January plus one month.
 * "clamp" gives 28 or 29 February, "overflow" gives 2 or 3 March, which is what
 * plain date arithmetic does if nobody decides.
 */
export type MonthEndMode = 'clamp' | 'overflow';
export const MONTH_END_MODES: readonly MonthEndMode[] = ['clamp', 'overflow'];

export const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const PAD = 2;
const SATURDAY = 6;
const SUNDAY = 0;

export type DateErrorCode = 'empty' | 'not-a-date';

export type DateResult =
  | { ok: true; utc: number }
  | { ok: false; code: DateErrorCode };

export function parseDate(raw: string): DateResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, code: 'empty' };

  const match = ISO_DATE.exec(trimmed);
  if (!match) return { ok: false, code: 'not-a-date' };

  const [, year, month, day] = match.map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);

  // Date.UTC rolls 2026-02-31 forward rather than rejecting it.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, code: 'not-a-date' };
  }

  return { ok: true, utc };
}

export function formatDate(utc: number): string {
  const date = new Date(utc);
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(PAD, '0'),
    String(date.getUTCDate()).padStart(PAD, '0'),
  ].join('-');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addToDate(
  utc: number,
  amount: number,
  unit: DateUnit,
  monthEnd: MonthEndMode,
): number {
  const date = new Date(utc);

  if (unit === 'days') return utc + amount * MS_PER_DAY;
  if (unit === 'weeks') return utc + amount * DAYS_PER_WEEK * MS_PER_DAY;

  const monthsToAdd = unit === 'years' ? amount * MONTHS_PER_YEAR : amount;
  const targetMonthIndex = date.getUTCMonth() + monthsToAdd;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / MONTHS_PER_YEAR);
  const targetMonth = ((targetMonthIndex % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;

  const day = date.getUTCDate();
  const lastDay = daysInMonth(targetYear, targetMonth);
  const clampedDay = monthEnd === 'clamp' ? Math.min(day, lastDay) : day;

  return Date.UTC(targetYear, targetMonth, clampedDay);
}

export interface DateSpan {
  days: number;
  weeks: number;
  months: number;
  years: number;
  /** The same gap written as years, months and days together. */
  combined: { years: number; months: number; days: number };
}

/**
 * How many whole months fit between two dates, measured with the same clamp
 * rule the add mode uses. Borrowing days from the previous month instead gives
 * a negative remainder whenever the start day is longer than that month:
 * 31 January to 1 March came out as one month and minus two days.
 */
function wholeMonthsBetween(earlier: number, later: number): number {
  const from = new Date(earlier);
  const to = new Date(later);

  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    (to.getUTCMonth() - from.getUTCMonth());

  if (months < 0) months = 0;
  while (months > 0 && addToDate(earlier, months, 'months', 'clamp') > later) {
    months -= 1;
  }
  while (addToDate(earlier, months + 1, 'months', 'clamp') <= later) {
    months += 1;
  }

  return months;
}

export function dateSpan(fromUtc: number, toUtc: number): DateSpan {
  const [earlier, later] = fromUtc <= toUtc ? [fromUtc, toUtc] : [toUtc, fromUtc];
  const sign = fromUtc <= toUtc ? 1 : -1;

  const days = Math.round((later - earlier) / MS_PER_DAY);
  const wholeMonths = wholeMonthsBetween(earlier, later);
  const restDays = Math.round(
    (later - addToDate(earlier, wholeMonths, 'months', 'clamp')) / MS_PER_DAY,
  );

  return {
    days: days * sign,
    weeks: Math.floor(days / DAYS_PER_WEEK) * sign,
    months: wholeMonths * sign,
    years: Math.floor(wholeMonths / MONTHS_PER_YEAR) * sign,
    combined: {
      years: Math.floor(wholeMonths / MONTHS_PER_YEAR) * sign,
      months: (wholeMonths % MONTHS_PER_YEAR) * sign,
      days: restDays * sign,
    },
  };
}

export function isWeekend(utc: number): boolean {
  const day = new Date(utc).getUTCDay();
  return day === SATURDAY || day === SUNDAY;
}

export interface BusinessDayCount {
  total: number;
  weekends: number;
  holidays: number;
  business: number;
}

/**
 * Counts whole days from the earlier date up to and including the later one.
 * Holidays that land on a weekend are counted once, as a weekend.
 */
export function countBusinessDays(
  fromUtc: number,
  toUtc: number,
  holidays: ReadonlySet<string>,
): BusinessDayCount {
  const [earlier, later] = fromUtc <= toUtc ? [fromUtc, toUtc] : [toUtc, fromUtc];

  let total = 0;
  let weekends = 0;
  let holidayCount = 0;

  for (let day = earlier; day <= later; day += MS_PER_DAY) {
    total += 1;

    if (isWeekend(day)) {
      weekends += 1;
      continue;
    }
    if (holidays.has(formatDate(day))) holidayCount += 1;
  }

  return {
    total,
    weekends,
    holidays: holidayCount,
    business: total - weekends - holidayCount,
  };
}

export function toBuddhistYear(gregorian: number): number {
  return gregorian + BUDDHIST_YEAR_OFFSET;
}

export function yearOf(utc: number): number {
  return new Date(utc).getUTCFullYear();
}

export function holidaysBetween(fromUtc: number, toUtc: number): Set<string> {
  const [earlier, later] = fromUtc <= toUtc ? [fromUtc, toUtc] : [toUtc, fromUtc];
  return thaiHolidaySet(yearOf(earlier), yearOf(later));
}
