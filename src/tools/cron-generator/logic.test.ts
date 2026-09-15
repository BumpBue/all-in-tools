import { describe, expect, it } from 'vitest';

import { describeCron, hasDayAmbiguity } from '@/tools/cron-generator/describe';
import {
  CRON_FIELDS,
  ICT_OFFSET_MINUTES,
  NEXT_RUN_COUNT,
  PRESETS,
  dayMatches,
  nextRuns,
  parseCron,
  type ParsedCron,
} from '@/tools/cron-generator/logic';

function parsed(expression: string): ParsedCron {
  const result = parseCron(expression);
  if (!result.ok) throw new Error(`expected "${expression}" to parse: ${result.code}`);
  return result;
}

function failure(expression: string) {
  const result = parseCron(expression);
  if (result.ok) throw new Error(`expected "${expression}" to fail`);
  return result;
}

function valuesOf(expression: string, field: (typeof CRON_FIELDS)[number]): number[] {
  return parsed(expression).fields[field].values;
}

/** The instant as ICT wall clock, which is what the tool shows. */
function ict(milliseconds: number): string {
  return new Date(milliseconds + ICT_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

const NOON_ICT = Date.UTC(2026, 8, 15, 5, 0); // 12:00 in Bangkok

describe('parseField', () => {
  it('expands a wildcard to every value', () => {
    expect(valuesOf('* * * * *', 'minute')).toHaveLength(60);
    expect(valuesOf('* * * * *', 'hour')).toHaveLength(24);
    expect(valuesOf('* * * * *', 'dayOfMonth')).toHaveLength(31);
  });

  it('expands a step', () => {
    expect(valuesOf('*/15 * * * *', 'minute')).toEqual([0, 15, 30, 45]);
  });

  it('expands a range', () => {
    expect(valuesOf('0 9-12 * * *', 'hour')).toEqual([9, 10, 11, 12]);
  });

  it('expands a range with a step', () => {
    expect(valuesOf('0 0-12/4 * * *', 'hour')).toEqual([0, 4, 8, 12]);
  });

  it('expands a list', () => {
    expect(valuesOf('0,30 * * * *', 'minute')).toEqual([0, 30]);
  });

  it('expands a list of ranges without repeating a value', () => {
    expect(valuesOf('1-3,2-4 * * * *', 'minute')).toEqual([1, 2, 3, 4]);
  });

  it('reads a step from a single value as "from here on"', () => {
    expect(valuesOf('0 5/6 * * *', 'hour')).toEqual([5, 11, 17, 23]);
  });

  it('reads month names', () => {
    expect(valuesOf('0 0 1 JAN,DEC *', 'month')).toEqual([1, 12]);
    expect(valuesOf('0 0 1 jan-mar *', 'month')).toEqual([1, 2, 3]);
  });

  it('reads weekday names', () => {
    expect(valuesOf('0 0 * * MON-FRI', 'dayOfWeek')).toEqual([1, 2, 3, 4, 5]);
  });

  it('accepts both 0 and 7 for Sunday', () => {
    expect(valuesOf('0 0 * * 0', 'dayOfWeek')).toEqual([0]);
    expect(valuesOf('0 0 * * 7', 'dayOfWeek')).toEqual([0]);
  });

  it('remembers a wildcard, which changes what the field means', () => {
    expect(parsed('* * * * *').fields.dayOfMonth.wildcard).toBe(true);
    expect(parsed('* * 1 * *').fields.dayOfMonth.wildcard).toBe(false);
    // A stepped wildcard restricts, so it is not a wildcard any more.
    expect(parsed('*/5 * * * *').fields.minute.wildcard).toBe(false);
  });

  it('keeps the step so it can be described rather than listed', () => {
    expect(parsed('*/5 * * * *').fields.minute.step).toBe(5);
    expect(parsed('0 * * * *').fields.minute.step).toBeNull();
  });
});

describe('parseCron failures', () => {
  it('needs exactly five fields', () => {
    expect(failure('* * * *')).toMatchObject({ code: 'wrong-field-count', detail: '4' });
    expect(failure('* * * * * *')).toMatchObject({ code: 'wrong-field-count' });
  });

  it('reports a value outside the field range, and which field', () => {
    expect(failure('60 * * * *')).toMatchObject({ code: 'out-of-range', field: 'minute' });
    expect(failure('0 24 * * *')).toMatchObject({ code: 'out-of-range', field: 'hour' });
    expect(failure('0 0 32 * *')).toMatchObject({ code: 'out-of-range', field: 'dayOfMonth' });
    expect(failure('0 0 * 13 *')).toMatchObject({ code: 'out-of-range', field: 'month' });
  });

  it('reports a value it cannot read at all', () => {
    expect(failure('abc * * * *')).toMatchObject({ code: 'unknown-value', field: 'minute' });
    expect(failure('0 0 * FOO *')).toMatchObject({ code: 'unknown-value', field: 'month' });
  });

  it('reports a backwards range', () => {
    expect(failure('0 12-9 * * *')).toMatchObject({ code: 'bad-range', field: 'hour' });
  });

  it('reports a step of zero, which would never advance', () => {
    expect(failure('*/0 * * * *')).toMatchObject({ code: 'bad-step' });
  });

  it('reports an empty item in a list', () => {
    expect(failure('1,,2 * * * *')).toMatchObject({ code: 'unknown-value' });
  });

  it('tidies the spacing of an expression it accepts', () => {
    expect(parsed('  0   9  *  *  1  ').expression).toBe('0 9 * * 1');
  });

  it('accepts every preset it offers', () => {
    for (const preset of PRESETS) {
      expect(parseCron(preset.expression).ok).toBe(true);
    }
  });
});

describe('dayMatches', () => {
  // The classic gotcha: with both day fields restricted, cron runs on either.
  it('runs on either day field when both are restricted', () => {
    const fields = parsed('0 0 1 * MON').fields;
    const onFirst = { year: 2026, month: 3, day: 1, hour: 0, minute: 0, weekday: 0 };
    const onMonday = { year: 2026, month: 3, day: 2, hour: 0, minute: 0, weekday: 1 };
    const neither = { year: 2026, month: 3, day: 3, hour: 0, minute: 0, weekday: 2 };

    expect(dayMatches(fields, onFirst)).toBe(true);
    expect(dayMatches(fields, onMonday)).toBe(true);
    expect(dayMatches(fields, neither)).toBe(false);
  });

  it('uses only the restricted one when the other is a wildcard', () => {
    const fields = parsed('0 0 * * MON').fields;
    const monday = { year: 2026, month: 3, day: 2, hour: 0, minute: 0, weekday: 1 };
    const tuesday = { year: 2026, month: 3, day: 3, hour: 0, minute: 0, weekday: 2 };

    expect(dayMatches(fields, monday)).toBe(true);
    expect(dayMatches(fields, tuesday)).toBe(false);
  });

  it('respects the month whatever the day fields say', () => {
    const fields = parsed('0 0 1 1 *').fields;
    expect(
      dayMatches(fields, { year: 2026, month: 2, day: 1, hour: 0, minute: 0, weekday: 0 }),
    ).toBe(false);
  });

  it('says so when the two day fields are an either/or', () => {
    expect(hasDayAmbiguity(parsed('0 0 1 * MON'))).toBe(true);
    expect(hasDayAmbiguity(parsed('0 0 1 * *'))).toBe(false);
    expect(hasDayAmbiguity(parsed('0 0 * * MON'))).toBe(false);
  });
});

describe('nextRuns', () => {
  it('gives the number asked for', () => {
    expect(nextRuns(parsed('* * * * *'), NOON_ICT)).toHaveLength(NEXT_RUN_COUNT);
  });

  it('starts after the moment asked about, never on it', () => {
    const runs = nextRuns(parsed('* * * * *'), NOON_ICT, 1);
    expect(runs[0]).toBeGreaterThan(NOON_ICT);
    expect(ict(runs[0] ?? 0)).toBe('2026-09-15 12:01');
  });

  it('comes back in order', () => {
    const runs = nextRuns(parsed('*/7 * * * *'), NOON_ICT);
    const sorted = [...runs].sort((left, right) => left - right);
    expect(runs).toEqual(sorted);
  });

  it('reads the clock in Bangkok, not in UTC', () => {
    const runs = nextRuns(parsed('0 9 * * *'), NOON_ICT, 1);
    expect(ict(runs[0] ?? 0)).toBe('2026-09-16 09:00');
  });

  it('finds the next weekday run', () => {
    // 15 September 2026 is a Tuesday, so Monday 08:30 is six days away.
    const runs = nextRuns(parsed('30 8 * * 1'), NOON_ICT, 1);
    expect(ict(runs[0] ?? 0)).toBe('2026-09-21 08:30');
  });

  it('finds a date months ahead', () => {
    const runs = nextRuns(parsed('0 0 1 1 *'), NOON_ICT, 2);
    expect(ict(runs[0] ?? 0)).toBe('2027-01-01 00:00');
    expect(ict(runs[1] ?? 0)).toBe('2028-01-01 00:00');
  });

  it('finds 29 February without being told leap years exist', () => {
    const runs = nextRuns(parsed('0 12 29 2 *'), NOON_ICT, 1);
    expect(ict(runs[0] ?? 0)).toBe('2028-02-29 12:00');
  });

  it('gives nothing rather than looping for a date that never comes', () => {
    // 30 February.
    expect(nextRuns(parsed('0 0 30 2 *'), NOON_ICT, 1)).toEqual([]);
  });

  it('runs on either day when both day fields are set', () => {
    const runs = nextRuns(parsed('0 0 1 * MON'), NOON_ICT, 3).map(ict);
    // The Mondays in between and the first of October all appear.
    expect(runs[0]).toBe('2026-09-21 00:00');
    expect(runs).toContain('2026-10-01 00:00');
  });

  it('lists every minute of a stepped expression within the hour', () => {
    const runs = nextRuns(parsed('*/20 * * * *'), NOON_ICT, 3).map(ict);
    expect(runs).toEqual(['2026-09-15 12:20', '2026-09-15 12:40', '2026-09-15 13:00']);
  });
});

describe('describeCron', () => {
  it('describes every minute', () => {
    expect(describeCron(parsed('* * * * *'), 'en')).toContain('every minute');
    expect(describeCron(parsed('* * * * *'), 'th')).toContain('ทุกนาที');
  });

  it('describes a step as an interval rather than a list', () => {
    expect(describeCron(parsed('*/5 * * * *'), 'en')).toContain('every 5 minutes');
    expect(describeCron(parsed('*/5 * * * *'), 'th')).toContain('ทุก 5 นาที');
  });

  it('describes a time of day as a clock reading', () => {
    expect(describeCron(parsed('30 8 * * *'), 'en')).toContain('08:30');
    expect(describeCron(parsed('30 8 * * *'), 'th')).toContain('08:30');
  });

  it('names the weekdays', () => {
    expect(describeCron(parsed('0 9 * * 1'), 'en')).toContain('Monday');
    expect(describeCron(parsed('0 9 * * 1'), 'th')).toContain('จันทร์');
  });

  it('names the months', () => {
    expect(describeCron(parsed('0 0 1 1 *'), 'en')).toContain('January');
    expect(describeCron(parsed('0 0 1 1 *'), 'th')).toContain('มกราคม');
  });

  it('says every day when nothing restricts the date', () => {
    expect(describeCron(parsed('0 9 * * *'), 'en')).toContain('every day');
    expect(describeCron(parsed('0 9 * * *'), 'th')).toContain('ทุกวัน');
  });

  it('describes each preset in both languages without leaving a gap', () => {
    for (const preset of PRESETS) {
      for (const locale of ['th', 'en'] as const) {
        const text = describeCron(parsed(preset.expression), locale);
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toContain('undefined');
      }
    }
  });
});
