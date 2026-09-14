import { describe, expect, it } from 'vitest';

import {
  FIXED_THAI_HOLIDAYS,
  thaiHolidaySet,
  thaiHolidaysFor,
} from '@/tools/date-calculator/holidays';
import {
  addToDate,
  countBusinessDays,
  dateSpan,
  daysInMonth,
  formatDate,
  holidaysBetween,
  isWeekend,
  parseDate,
  toBuddhistYear,
} from '@/tools/date-calculator/logic';

function at(iso: string): number {
  const result = parseDate(iso);
  if (!result.ok) throw new Error(`expected "${iso}" to parse`);
  return result.utc;
}

function add(iso: string, amount: number, unit: 'days' | 'weeks' | 'months' | 'years', mode: 'clamp' | 'overflow' = 'clamp') {
  return formatDate(addToDate(at(iso), amount, unit, mode));
}

describe('parseDate', () => {
  it('reads an ISO date', () => {
    expect(formatDate(at('2026-09-14'))).toBe('2026-09-14');
  });

  it('names why it failed', () => {
    expect(parseDate('')).toEqual({ ok: false, code: 'empty' });
    expect(parseDate('14/09/2026')).toEqual({ ok: false, code: 'not-a-date' });
    expect(parseDate('not a date')).toEqual({ ok: false, code: 'not-a-date' });
  });

  it('rejects a day the month does not have', () => {
    expect(parseDate('2026-02-30')).toEqual({ ok: false, code: 'not-a-date' });
    expect(parseDate('2026-04-31')).toEqual({ ok: false, code: 'not-a-date' });
  });

  it('accepts the leap day only in a leap year', () => {
    expect(parseDate('2028-02-29').ok).toBe(true);
    expect(parseDate('2026-02-29').ok).toBe(false);
  });
});

describe('adding days and weeks', () => {
  it('adds and subtracts days', () => {
    expect(add('2026-09-14', 10, 'days')).toBe('2026-09-24');
    expect(add('2026-09-14', -14, 'days')).toBe('2026-08-31');
  });

  it('adds weeks', () => {
    expect(add('2026-09-14', 2, 'weeks')).toBe('2026-09-28');
  });

  it('crosses a year boundary', () => {
    expect(add('2026-12-28', 5, 'days')).toBe('2027-01-02');
  });

  it('crosses a leap day', () => {
    expect(add('2028-02-28', 1, 'days')).toBe('2028-02-29');
    expect(add('2026-02-28', 1, 'days')).toBe('2026-03-01');
  });
});

describe('adding months at the end of a month', () => {
  it('clamps to the last day the target month has', () => {
    expect(add('2026-01-31', 1, 'months', 'clamp')).toBe('2026-02-28');
    expect(add('2028-01-31', 1, 'months', 'clamp')).toBe('2028-02-29');
    expect(add('2026-03-31', 1, 'months', 'clamp')).toBe('2026-04-30');
  });

  it('overflows into the next month when asked', () => {
    expect(add('2026-01-31', 1, 'months', 'overflow')).toBe('2026-03-03');
    expect(add('2028-01-31', 1, 'months', 'overflow')).toBe('2028-03-02');
  });

  it('treats an ordinary day the same either way', () => {
    expect(add('2026-01-15', 1, 'months', 'clamp')).toBe('2026-02-15');
    expect(add('2026-01-15', 1, 'months', 'overflow')).toBe('2026-02-15');
  });

  it('handles a negative month step', () => {
    expect(add('2026-03-31', -1, 'months', 'clamp')).toBe('2026-02-28');
    expect(add('2026-01-15', -2, 'months')).toBe('2025-11-15');
  });

  it('adds years, clamping the leap day', () => {
    expect(add('2028-02-29', 1, 'years', 'clamp')).toBe('2029-02-28');
    expect(add('2026-09-14', 3, 'years')).toBe('2029-09-14');
  });
});

describe('daysInMonth', () => {
  it('knows the short months', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
    expect(daysInMonth(2026, 0)).toBe(31);
  });
});

describe('dateSpan', () => {
  it('counts plain days', () => {
    expect(dateSpan(at('2026-01-01'), at('2026-01-31')).days).toBe(30);
  });

  it('counts whole weeks, dropping the remainder', () => {
    expect(dateSpan(at('2026-01-01'), at('2026-01-16')).weeks).toBe(2);
  });

  it('counts whole months and years', () => {
    const span = dateSpan(at('2024-03-15'), at('2026-09-14'));
    expect(span.years).toBe(2);
    expect(span.months).toBe(29);
  });

  it('breaks the gap into years, months and days', () => {
    expect(dateSpan(at('2024-03-15'), at('2026-09-20')).combined).toEqual({
      years: 2,
      months: 6,
      days: 5,
    });
  });

  it('borrows correctly when the day of month goes backwards', () => {
    expect(dateSpan(at('2026-01-31'), at('2026-03-01')).combined).toEqual({
      years: 0,
      months: 1,
      days: 1,
    });
  });

  it('is zero for the same date', () => {
    const span = dateSpan(at('2026-09-14'), at('2026-09-14'));
    expect(span.days).toBe(0);
    expect(span.combined).toEqual({ years: 0, months: 0, days: 0 });
  });

  it('reports a negative span when the dates are the other way round', () => {
    expect(dateSpan(at('2026-09-14'), at('2026-09-04')).days).toBe(-10);
  });
});

describe('weekends', () => {
  it('knows Saturday and Sunday', () => {
    expect(isWeekend(at('2026-09-12'))).toBe(true);
    expect(isWeekend(at('2026-09-13'))).toBe(true);
    expect(isWeekend(at('2026-09-14'))).toBe(false);
  });
});

describe('business days', () => {
  const none = new Set<string>();

  it('counts a plain working week', () => {
    expect(countBusinessDays(at('2026-09-14'), at('2026-09-18'), none)).toEqual({
      total: 5,
      weekends: 0,
      holidays: 0,
      business: 5,
    });
  });

  it('drops the weekend from a full week', () => {
    const result = countBusinessDays(at('2026-09-14'), at('2026-09-20'), none);
    expect(result.total).toBe(7);
    expect(result.weekends).toBe(2);
    expect(result.business).toBe(5);
  });

  it('drops a holiday that falls on a weekday', () => {
    // 2026-12-10 is Constitution Day, a Thursday.
    const holidays = holidaysBetween(at('2026-12-07'), at('2026-12-11'));
    const result = countBusinessDays(at('2026-12-07'), at('2026-12-11'), holidays);

    expect(result.total).toBe(5);
    expect(result.holidays).toBe(1);
    expect(result.business).toBe(4);
  });

  it('counts a holiday on a weekend only once, as a weekend', () => {
    // 2026-08-12 is a Wednesday, so use a year where a fixed date lands on a
    // Saturday instead: 2028-01-01.
    const holidays = holidaysBetween(at('2027-12-30'), at('2028-01-03'));
    const result = countBusinessDays(at('2027-12-30'), at('2028-01-03'), holidays);

    expect(result.total).toBe(5);
    expect(result.weekends + result.holidays + result.business).toBe(result.total);
  });

  it('includes both ends of the range', () => {
    expect(countBusinessDays(at('2026-09-14'), at('2026-09-14'), none).total).toBe(1);
  });

  it('gives the same answer with the dates reversed', () => {
    const forwards = countBusinessDays(at('2026-09-14'), at('2026-09-20'), none);
    const backwards = countBusinessDays(at('2026-09-20'), at('2026-09-14'), none);
    expect(backwards).toEqual(forwards);
  });
});

describe('Thai holidays', () => {
  it('produces a dated list for any year', () => {
    const holidays = thaiHolidaysFor(2026);
    expect(holidays).toHaveLength(FIXED_THAI_HOLIDAYS.length);
    expect(holidays[0]).toMatchObject({ date: '2026-01-01' });
  });

  it('includes the dates that never move', () => {
    const dates = thaiHolidaysFor(2027).map((holiday) => holiday.date);
    expect(dates).toContain('2027-04-13');
    expect(dates).toContain('2027-10-23');
    expect(dates).toContain('2027-12-05');
  });

  it('names every holiday in both languages', () => {
    for (const holiday of thaiHolidaysFor(2026)) {
      expect(holiday.th.length).toBeGreaterThan(0);
      expect(holiday.en.length).toBeGreaterThan(0);
    }
  });

  it('covers a span of years without duplicates', () => {
    const set = thaiHolidaySet(2026, 2028);
    expect(set.size).toBe(FIXED_THAI_HOLIDAYS.length * 3);
  });

  it('leaves out the lunar holidays, which move each year', () => {
    const names = FIXED_THAI_HOLIDAYS.map((holiday) => holiday.name.en.toLowerCase());
    expect(names.some((name) => name.includes('bucha'))).toBe(false);
    expect(names.some((name) => name.includes('ploughing'))).toBe(false);
  });
});

describe('Buddhist year', () => {
  it('is 543 ahead', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
  });
});
