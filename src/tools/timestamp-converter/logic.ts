export type TimestampUnit = 'seconds' | 'milliseconds';

export const UNITS: readonly TimestampUnit[] = ['seconds', 'milliseconds'];

export const ICT_TIME_ZONE = 'Asia/Bangkok';
export const UTC_TIME_ZONE = 'UTC';

/** พ.ศ. is the Gregorian year plus this. */
export const BUDDHIST_YEAR_OFFSET = 543;

const MILLISECONDS_PER_SECOND = 1000;

/**
 * At or above this, the number is milliseconds: read as seconds it would land
 * in the year 33658, while as milliseconds it is September 2001. Anything
 * smaller is read as seconds, which covers every plausible date either way.
 */
const MILLISECOND_THRESHOLD = 1e12;

const RFC_2822_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RFC_2822_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SEPARATORS = /[_,\s]/g;
const INTEGER = /^-?\d+$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const PAD_WIDTH = 2;
const ISO_SECONDS_LENGTH = 19;
const HOURS_PER_DAY = 24;

export type TimestampErrorCode = 'empty' | 'not-a-number' | 'out-of-range';

export interface TimestampFailure {
  ok: false;
  code: TimestampErrorCode;
}

export type TimestampResult =
  | { ok: true; milliseconds: number; unit: TimestampUnit }
  | TimestampFailure;

export function detectUnit(value: number): TimestampUnit {
  return Math.abs(value) >= MILLISECOND_THRESHOLD ? 'milliseconds' : 'seconds';
}

export function toMilliseconds(value: number, unit: TimestampUnit): number {
  return unit === 'seconds' ? value * MILLISECONDS_PER_SECOND : value;
}

export function fromMilliseconds(milliseconds: number, unit: TimestampUnit): number {
  return unit === 'seconds'
    ? Math.floor(milliseconds / MILLISECONDS_PER_SECOND)
    : milliseconds;
}

export function parseTimestamp(
  raw: string,
  forcedUnit?: TimestampUnit,
): TimestampResult {
  const trimmed = raw.trim().replace(SEPARATORS, '');
  if (trimmed.length === 0) return { ok: false, code: 'empty' };
  if (!INTEGER.test(trimmed)) return { ok: false, code: 'not-a-number' };

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, code: 'not-a-number' };

  const unit = forcedUnit ?? detectUnit(value);
  const milliseconds = toMilliseconds(value, unit);

  if (Number.isNaN(new Date(milliseconds).getTime())) {
    return { ok: false, code: 'out-of-range' };
  }

  return { ok: true, milliseconds, unit };
}

/** How far ahead of UTC a zone is at a given instant. */
export function zoneOffsetMilliseconds(
  milliseconds: number,
  timeZone: string,
): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(milliseconds)
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % HOURS_PER_DAY,
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - milliseconds;
}

/** Reads what a datetime-local input produces, as wall-clock time in a zone. */
export function parseLocalDateTime(raw: string, timeZone: string): TimestampResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, code: 'empty' };

  const match = LOCAL_DATE_TIME.exec(trimmed);
  if (!match) return { ok: false, code: 'not-a-number' };

  const [, year, month, day, hour, minute, second = '0'] = match;
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (Number.isNaN(asUtc)) return { ok: false, code: 'out-of-range' };

  // Date.UTC read the wall clock as if it were UTC; shifting by the zone's
  // offset at that instant gives the real moment.
  const offset = zoneOffsetMilliseconds(asUtc, timeZone);
  return { ok: true, milliseconds: asUtc - offset, unit: 'milliseconds' };
}

export function formatIso(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

export function formatRfc2822(milliseconds: number): string {
  const date = new Date(milliseconds);
  const pad = (value: number) => String(value).padStart(PAD_WIDTH, '0');

  const day = RFC_2822_DAYS[date.getUTCDay()];
  const month = RFC_2822_MONTHS[date.getUTCMonth()];
  const clock = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    .map(pad)
    .join(':');

  return [
    day + ',',
    pad(date.getUTCDate()),
    month,
    String(date.getUTCFullYear()),
    clock,
    '+0000',
  ].join(' ');
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

/** The value a datetime-local input wants, expressed in the given zone. */
export function toLocalInputValue(milliseconds: number, timeZone: string): string {
  const offset = zoneOffsetMilliseconds(milliseconds, timeZone);
  return new Date(milliseconds + offset).toISOString().slice(0, ISO_SECONDS_LENGTH);
}

export function gregorianYear(milliseconds: number, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(
      milliseconds,
    ),
  );
}

export function toBuddhistYear(gregorian: number): number {
  return gregorian + BUDDHIST_YEAR_OFFSET;
}

const RELATIVE_STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

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

export function listTimeZones(): string[] {
  const withSupported = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  };

  // supportedValuesOf is missing in some browsers Next 16 still supports, and
  // where it exists it lists IANA zones only, so plain "UTC" is not in it.
  const supported = withSupported.supportedValuesOf?.('timeZone') ?? [];
  return [...new Set([ICT_TIME_ZONE, UTC_TIME_ZONE, ...supported])];
}
