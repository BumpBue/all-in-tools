import { addDays, fromDayKey } from '@/lib/day';

/**
 * A small iCalendar writer. Two tools export schedules, and .ics is a text
 * format with four rules worth knowing, so it is written here rather than
 * pulled in.
 */
const ICS_LINE_LIMIT = 75;
const ICS_DATE_PAD = 2;

/** iCalendar escapes these four, and nothing else. */
export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 folds a long line by breaking it and starting the next with a space. */
export function foldIcsLine(line: string): string {
  if (line.length <= ICS_LINE_LIMIT) return line;

  const parts: string[] = [line.slice(0, ICS_LINE_LIMIT)];
  let rest = line.slice(ICS_LINE_LIMIT);

  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, ICS_LINE_LIMIT - 1)}`);
    rest = rest.slice(ICS_LINE_LIMIT - 1);
  }

  return parts.join('\r\n');
}

function icsDate(dayKey: string): string {
  const date = new Date(fromDayKey(dayKey));

  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(ICS_DATE_PAD, '0'),
    String(date.getDate()).padStart(ICS_DATE_PAD, '0'),
  ].join('');
}

export interface IcsOptions {
  schedule: Record<string, number>;
  title: (day: string, count: number) => string;
  calendarName: string;
  /** Fixed rather than read from a clock, so the same schedule exports the
   * same file twice and the export stays testable. */
  stamp: string;
}

/**
 * All-day events, one per review day. DTEND is the day after DTSTART because
 * an all-day VEVENT's end is exclusive — get that wrong and every entry shows
 * up as two days in a calendar.
 */
export function buildIcs(options: IcsOptions): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Toolbox//Spaced Repetition//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(options.calendarName)}`,
  ];

  for (const day of Object.keys(options.schedule).sort()) {
    const count = options.schedule[day] ?? 0;
    const start = icsDate(day);
    // addDays walks the calendar. Adding 86_400_000 and formatting through
    // toISOString() converts to UTC on the way, which in Bangkok lands back on
    // the same date and makes every event zero days long.
    const end = icsDate(addDays(day, 1));

    lines.push(
      'BEGIN:VEVENT',
      `UID:${start}-${count}@toolbox.local`,
      `DTSTAMP:${options.stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcs(options.title(day, count))}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n');
}
