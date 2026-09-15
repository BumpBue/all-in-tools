export const CRON_FIELDS = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'] as const;
export type CronField = (typeof CRON_FIELDS)[number];

export interface FieldRange {
  min: number;
  max: number;
  names?: readonly string[];
}

export const FIELD_RANGES: Readonly<Record<CronField, FieldRange>> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: {
    min: 1,
    max: 12,
    names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  },
  dayOfWeek: {
    min: 0,
    max: 6,
    names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
};

/** ICT never shifts, so a fixed offset is exact rather than an approximation. */
export const ICT_OFFSET_MINUTES = 420;
export const NEXT_RUN_COUNT = 10;

/** Far enough ahead to find 29 February, and bounded so a pattern that never
 * matches gives up instead of looping. */
const SEARCH_DAYS = 1_500;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const SUNDAY_ALIAS = 7;

export type CronErrorCode =
  | 'wrong-field-count'
  | 'unknown-value'
  | 'out-of-range'
  | 'bad-range'
  | 'bad-step';

export interface CronFailure {
  ok: false;
  code: CronErrorCode;
  field: CronField | null;
  detail: string;
}

export interface ParsedField {
  values: number[];
  /** True when the field was written as *, which changes how it reads. */
  wildcard: boolean;
  // The n of a step expression, kept so the description can say "every n"
  // rather than listing every value it expands to.
  step: number | null;
  raw: string;
}

export type ParsedCron = {
  ok: true;
  fields: Record<CronField, ParsedField>;
  expression: string;
};

export type CronResult = ParsedCron | CronFailure;

function nameToNumber(part: string, range: FieldRange): number | null {
  const index = range.names?.indexOf(part.toLowerCase()) ?? -1;
  if (index === -1) return null;

  return range.min + index;
}

function toNumber(part: string, range: FieldRange, field: CronField): number | CronFailure {
  const named = nameToNumber(part, range);
  if (named !== null) return named;

  if (!/^\d+$/.test(part)) {
    return { ok: false, code: 'unknown-value', field, detail: part };
  }

  let value = Number(part);
  // Sunday is written either 0 or 7, and both are common in the wild.
  if (field === 'dayOfWeek' && value === SUNDAY_ALIAS) value = 0;

  if (value < range.min || value > range.max) {
    return { ok: false, code: 'out-of-range', field, detail: part };
  }

  return value;
}

function isFailure(value: number | CronFailure): value is CronFailure {
  return typeof value !== 'number';
}

export function parseField(raw: string, field: CronField): ParsedField | CronFailure {
  const range = FIELD_RANGES[field];
  const values = new Set<number>();
  let wildcard = false;
  let step: number | null = null;

  for (const piece of raw.split(',')) {
    const part = piece.trim();
    if (part.length === 0) {
      return { ok: false, code: 'unknown-value', field, detail: raw };
    }

    const [body = '', stepText] = part.split('/');

    let stepValue = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) === 0) {
        return { ok: false, code: 'bad-step', field, detail: part };
      }
      stepValue = Number(stepText);
      step = stepValue;
    }

    let low = range.min;
    let high = range.max;

    if (body === '*') {
      wildcard = stepText === undefined;
    } else if (body.includes('-')) {
      const [fromText = '', toText = ''] = body.split('-');
      const from = toNumber(fromText, range, field);
      const to = toNumber(toText, range, field);

      if (isFailure(from)) return from;
      if (isFailure(to)) return to;
      if (from > to) return { ok: false, code: 'bad-range', field, detail: body };

      low = from;
      high = to;
    } else {
      const single = toNumber(body, range, field);
      if (isFailure(single)) return single;

      low = single;
      high = stepText === undefined ? single : range.max;
    }

    for (let value = low; value <= high; value += stepValue) values.add(value);
  }

  return {
    values: [...values].sort((left, right) => left - right),
    wildcard,
    step,
    raw: raw.trim(),
  };
}

export function parseCron(expression: string): CronResult {
  const parts = expression.trim().split(/\s+/).filter((part) => part.length > 0);

  if (parts.length !== CRON_FIELDS.length) {
    return {
      ok: false,
      code: 'wrong-field-count',
      field: null,
      detail: String(parts.length),
    };
  }

  const fields = {} as Record<CronField, ParsedField>;

  for (const [index, field] of CRON_FIELDS.entries()) {
    const parsed = parseField(parts[index] ?? '', field);
    if ('ok' in parsed) return parsed;
    fields[field] = parsed;
  }

  return { ok: true, fields, expression: parts.join(' ') };
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

function toIct(milliseconds: number): WallClock {
  const shifted = new Date(milliseconds + ICT_OFFSET_MINUTES * MINUTE_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function fromIct(clock: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): number {
  return (
    Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute) -
    ICT_OFFSET_MINUTES * MINUTE_MS
  );
}

/**
 * Vixie cron: when both the day of month and the day of week are restricted,
 * the job runs when *either* matches, not both. It surprises everybody once.
 */
export function dayMatches(fields: Record<CronField, ParsedField>, clock: WallClock): boolean {
  if (!fields.month.values.includes(clock.month)) return false;

  const domRestricted = !fields.dayOfMonth.wildcard;
  const dowRestricted = !fields.dayOfWeek.wildcard;

  const domHit = fields.dayOfMonth.values.includes(clock.day);
  const dowHit = fields.dayOfWeek.values.includes(clock.weekday);

  if (domRestricted && dowRestricted) return domHit || dowHit;
  if (domRestricted) return domHit;
  if (dowRestricted) return dowHit;

  return true;
}

export function nextRuns(
  parsed: ParsedCron,
  fromMs: number,
  count = NEXT_RUN_COUNT,
): number[] {
  const { fields } = parsed;
  const runs: number[] = [];

  // Start at the next whole minute: a job never fires in the second it is asked.
  const start = Math.floor(fromMs / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  const startClock = toIct(start);

  for (let offset = 0; offset < SEARCH_DAYS && runs.length < count; offset += 1) {
    const dayClock = toIct(
      fromIct({
        year: startClock.year,
        month: startClock.month,
        day: startClock.day,
        hour: 0,
        minute: 0,
      }) +
        offset * DAY_MS,
    );

    if (!dayMatches(fields, dayClock)) continue;

    for (const hour of fields.hour.values) {
      for (const minute of fields.minute.values) {
        const instant = fromIct({
          year: dayClock.year,
          month: dayClock.month,
          day: dayClock.day,
          hour,
          minute,
        });

        if (instant < start) continue;
        runs.push(instant);
        if (runs.length >= count) return runs;
      }
    }
  }

  return runs;
}

export interface CronPreset {
  id: string;
  expression: string;
  th: string;
  en: string;
}

export const PRESETS: readonly CronPreset[] = [
  { id: 'every-minute', expression: '* * * * *', th: 'ทุกนาที', en: 'Every minute' },
  { id: 'every-5', expression: '*/5 * * * *', th: 'ทุก 5 นาที', en: 'Every 5 minutes' },
  { id: 'hourly', expression: '0 * * * *', th: 'ทุกชั่วโมง', en: 'Every hour' },
  { id: 'daily', expression: '0 0 * * *', th: 'ทุกวันตอนเที่ยงคืน', en: 'Every day at midnight' },
  { id: 'workday', expression: '30 8 * * 1-5', th: 'จันทร์ถึงศุกร์ 08:30', en: 'Weekdays at 08:30' },
  { id: 'weekly', expression: '0 9 * * 1', th: 'ทุกวันจันทร์ 09:00', en: 'Mondays at 09:00' },
  { id: 'monthly', expression: '0 0 1 * *', th: 'วันที่ 1 ของทุกเดือน', en: 'The first of each month' },
  { id: 'yearly', expression: '0 0 1 1 *', th: 'ปีละครั้ง 1 มกราคม', en: 'Once a year on 1 January' },
];

export function isEveryValue(field: ParsedField, range: FieldRange): boolean {
  return field.values.length === range.max - range.min + 1;
}

export function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}
