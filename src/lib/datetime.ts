export const ICT_TIME_ZONE = 'Asia/Bangkok';
export const UTC_TIME_ZONE = 'UTC';

/** พ.ศ. is the Gregorian year plus this. */
export const BUDDHIST_YEAR_OFFSET = 543;

const RELATIVE_STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

export function toBuddhistYear(gregorian: number): number {
  return gregorian + BUDDHIST_YEAR_OFFSET;
}

export function gregorianYear(milliseconds: number, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(milliseconds),
  );
}

export function formatInZone(
  milliseconds: number,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(milliseconds);
}

export function formatRelative(
  milliseconds: number,
  now: number,
  locale: string,
): string {
  const difference = milliseconds - now;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(difference) >= size) {
      return formatter.format(Math.round(difference / size), unit);
    }
  }

  return formatter.format(0, 'second');
}
