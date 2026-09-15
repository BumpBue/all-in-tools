/**
 * Day keys, in the reader's own time zone.
 *
 * A habit ticked at 23:00 belongs to that day as the person lived it, not as
 * UTC saw it, so these read the local calendar rather than an ISO string.
 */
const PAD = 2;
export const DAY_MS = 86_400_000;
export const DAYS_PER_WEEK = 7;

export function toDayKey(milliseconds: number): string {
  const date = new Date(milliseconds);

  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(PAD, '0'),
    String(date.getDate()).padStart(PAD, '0'),
  ].join('-');
}

export function fromDayKey(key: string): number {
  const [year = '0', month = '1', day = '1'] = key.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

/** Adds days by the calendar, so a clock change never loses or repeats one. */
export function addDays(key: string, count: number): string {
  const date = new Date(fromDayKey(key));
  date.setDate(date.getDate() + count);
  return toDayKey(date.getTime());
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(fromDayKey(from));
  const end = new Date(fromDayKey(to));

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function dayKeysBack(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

/** 0 is Sunday, matching Date.getDay. */
export function weekdayOf(key: string): number {
  return new Date(fromDayKey(key)).getDay();
}

export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
