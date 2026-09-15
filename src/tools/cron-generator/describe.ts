import {
  FIELD_RANGES,
  isEveryValue,
  padTwo,
  type CronField,
  type ParsedCron,
  type ParsedField,
} from '@/tools/cron-generator/logic';
import type { Locale } from '@/types/tool';

const MONTH_NAMES: Record<Locale, readonly string[]> = {
  th: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};

const WEEKDAY_NAMES: Record<Locale, readonly string[]> = {
  th: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const JOINERS: Record<Locale, { and: string; every: string }> = {
  th: { and: ' และ ', every: 'ทุก' },
  en: { and: ' and ', every: 'every' },
};

function joinList(parts: string[], locale: Locale): string {
  if (parts.length <= 1) return parts[0] ?? '';

  const head = parts.slice(0, -1).join(locale === 'th' ? ' ' : ', ');
  return `${head}${JOINERS[locale].and}${parts[parts.length - 1]}`;
}

function namesOf(field: ParsedField, names: readonly string[], offset: number): string[] {
  return field.values.map((value) => names[value - offset] ?? String(value));
}

/**
 * Describes the time of day as a clock reading where it is one, because
 * "08:30" is what a reader checks against, not "minute 30 of hour 8".
 */
function describeTime(
  minute: ParsedField,
  hour: ParsedField,
  locale: Locale,
): string {
  const everyMinute = isEveryValue(minute, FIELD_RANGES.minute);
  const everyHour = isEveryValue(hour, FIELD_RANGES.hour);

  if (everyMinute && everyHour) {
    return locale === 'th' ? 'ทุกนาที' : 'every minute';
  }

  if (minute.step !== null && everyHour) {
    return locale === 'th'
      ? `ทุก ${minute.step} นาที`
      : `every ${minute.step} minutes`;
  }

  if (everyMinute) {
    const hours = joinList(hour.values.map((value) => `${padTwo(value)}:00`), locale);
    return locale === 'th'
      ? `ทุกนาทีในชั่วโมง ${hours}`
      : `every minute of the hour at ${hours}`;
  }

  if (hour.step !== null && minute.values.length === 1) {
    const at = padTwo(minute.values[0] ?? 0);
    return locale === 'th'
      ? `ทุก ${hour.step} ชั่วโมง ที่นาทีที่ ${at}`
      : `every ${hour.step} hours at minute ${at}`;
  }

  if (everyHour) {
    const minutes = joinList(minute.values.map((value) => `นาทีที่ ${value}`), locale);
    return locale === 'th'
      ? `ทุกชั่วโมง ${minutes}`
      : `every hour at minute ${joinList(minute.values.map(String), locale)}`;
  }

  const times: string[] = [];
  for (const eachHour of hour.values) {
    for (const eachMinute of minute.values) {
      times.push(`${padTwo(eachHour)}:${padTwo(eachMinute)}`);
    }
  }

  return joinList(times, locale);
}

function describeDays(
  fields: Record<CronField, ParsedField>,
  locale: Locale,
): string {
  const { dayOfMonth, month, dayOfWeek } = fields;

  const everyDom = isEveryValue(dayOfMonth, FIELD_RANGES.dayOfMonth);
  const everyMonth = isEveryValue(month, FIELD_RANGES.month);
  const everyDow = isEveryValue(dayOfWeek, FIELD_RANGES.dayOfWeek);

  const parts: string[] = [];

  if (!everyDow) {
    const days = joinList(namesOf(dayOfWeek, WEEKDAY_NAMES[locale], 0), locale);
    parts.push(locale === 'th' ? `วัน${days}` : `on ${days}`);
  }

  if (!everyDom) {
    const days = joinList(dayOfMonth.values.map(String), locale);
    parts.push(locale === 'th' ? `วันที่ ${days}` : `on day ${days} of the month`);
  }

  if (!everyMonth) {
    const months = joinList(namesOf(month, MONTH_NAMES[locale], 1), locale);
    parts.push(locale === 'th' ? `เดือน${months}` : `in ${months}`);
  }

  if (parts.length === 0) {
    return locale === 'th' ? 'ทุกวัน' : 'every day';
  }

  return parts.join(locale === 'th' ? ' ' : ', ');
}

export function describeCron(parsed: ParsedCron, locale: Locale): string {
  const time = describeTime(parsed.fields.minute, parsed.fields.hour, locale);
  const days = describeDays(parsed.fields, locale);

  return locale === 'th' ? `${days} ${time}` : `${time}, ${days}`;
}

/** True when both day fields are restricted, which makes them an either/or. */
export function hasDayAmbiguity(parsed: ParsedCron): boolean {
  return !parsed.fields.dayOfMonth.wildcard && !parsed.fields.dayOfWeek.wildcard;
}
