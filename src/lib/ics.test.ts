import { describe, expect, it } from 'vitest';

import { buildIcs, escapeIcs, foldIcsLine } from '@/lib/ics';

describe('the ics export', () => {
  const schedule = { '2026-09-16': 3, '2026-09-20': 1 };
  const ics = buildIcs({
    schedule,
    title: (day, count) => `ทบทวน ${count} ใบ`,
    calendarName: 'ตารางทบทวน',
    stamp: '20260915T000000Z',
  });

  it('is a complete calendar', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('writes one event per review day', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('separates lines with CRLF, as the format requires', () => {
    expect(ics).toContain('\r\n');
  });

  it('ends an all-day event on the following day, which is exclusive', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260916');
    expect(ics).toContain('DTEND;VALUE=DATE:20260917');
  });

  it('writes the days in order', () => {
    expect(ics.indexOf('20260916')).toBeLessThan(ics.indexOf('20260920'));
  });

  it('escapes the characters iCalendar uses as syntax', () => {
    expect(escapeIcs('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds a line too long for the format', () => {
    const folded = foldIcsLine(`SUMMARY:${'x'.repeat(200)}`);

    expect(folded).toContain('\r\n ');
    for (const line of folded.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('leaves a short line alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('writes an empty calendar when nothing is scheduled', () => {
    const empty = buildIcs({
      schedule: {},
      title: () => 'x',
      calendarName: 'none',
      stamp: '20260915T000000Z',
    });

    expect(empty).not.toContain('BEGIN:VEVENT');
    expect(empty).toContain('END:VCALENDAR');
  });
});
