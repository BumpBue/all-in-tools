import { addDays, fromDayKey } from '@/lib/day';

const QUOTE = '"';
const COMMA = ',';
const TAB = '\t';

export interface ImportedCard {
  front: string;
  back: string;
}

/**
 * RFC 4180 in the other direction: a quoted field may hold commas, newlines and
 * doubled quotes. Splitting on commas would tear apart any card whose front
 * contains one, which for a vocabulary deck is most of them.
 *
 * A tab is accepted as the separator too, because that is what a spreadsheet
 * puts on the clipboard.
 */
export function parseDelimited(text: string): ImportedCard[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };

  const endRow = () => {
    endField();
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const character = text[index];

    if (quoted) {
      if (character === QUOTE) {
        if (text[index + 1] === QUOTE) {
          field += QUOTE;
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }

      field += character;
      index += 1;
      continue;
    }

    if (character === QUOTE && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }

    if (character === COMMA || character === TAB) {
      endField();
      index += 1;
      continue;
    }

    if (character === '\r') {
      index += 1;
      continue;
    }

    if (character === '\n') {
      endRow();
      index += 1;
      continue;
    }

    field += character;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();

  return rows.map((values) => ({
    front: (values[0] ?? '').trim(),
    back: (values[1] ?? '').trim(),
  }));
}

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
