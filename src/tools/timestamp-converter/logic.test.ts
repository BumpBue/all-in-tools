import { describe, expect, it } from 'vitest';

import {
  BUDDHIST_YEAR_OFFSET,
  ICT_TIME_ZONE,
  UTC_TIME_ZONE,
  detectUnit,
  formatIso,
  formatRelative,
  formatRfc2822,
  fromMilliseconds,
  gregorianYear,
  listTimeZones,
  parseLocalDateTime,
  parseTimestamp,
  toBuddhistYear,
  toLocalInputValue,
  toMilliseconds,
  zoneOffsetMilliseconds,
} from '@/tools/timestamp-converter/logic';

/** 2026-09-14T08:30:00Z — a Monday, chosen so the weekday is checkable. */
const MOMENT_MS = Date.UTC(2026, 8, 14, 8, 30, 0);
const MOMENT_SECONDS = MOMENT_MS / 1000;
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

function ok(raw: string, unit?: 'seconds' | 'milliseconds') {
  const result = parseTimestamp(raw, unit);
  if (!result.ok) throw new Error(`expected "${raw}" to parse`);
  return result;
}

describe('detectUnit', () => {
  it('reads a ten-digit value as seconds', () => {
    expect(detectUnit(MOMENT_SECONDS)).toBe('seconds');
    expect(detectUnit(0)).toBe('seconds');
  });

  it('reads a thirteen-digit value as milliseconds', () => {
    expect(detectUnit(MOMENT_MS)).toBe('milliseconds');
  });

  it('ignores the sign when deciding', () => {
    expect(detectUnit(-MOMENT_MS)).toBe('milliseconds');
    expect(detectUnit(-MOMENT_SECONDS)).toBe('seconds');
  });

  it('puts the boundary where no real date is ambiguous', () => {
    expect(detectUnit(1e12 - 1)).toBe('seconds');
    expect(detectUnit(1e12)).toBe('milliseconds');
  });
});

describe('parseTimestamp', () => {
  it('detects the unit when not told', () => {
    expect(ok(String(MOMENT_SECONDS))).toMatchObject({
      milliseconds: MOMENT_MS,
      unit: 'seconds',
    });
    expect(ok(String(MOMENT_MS))).toMatchObject({
      milliseconds: MOMENT_MS,
      unit: 'milliseconds',
    });
  });

  it('obeys a forced unit over its own guess', () => {
    expect(ok(String(MOMENT_MS), 'seconds').milliseconds).toBe(MOMENT_MS * 1000);
    expect(ok(String(MOMENT_SECONDS), 'milliseconds').milliseconds).toBe(
      MOMENT_SECONDS,
    );
  });

  it('accepts the separators people paste', () => {
    expect(ok('1,789,000,000').milliseconds).toBe(1_789_000_000_000);
    expect(ok('1_789_000_000').milliseconds).toBe(1_789_000_000_000);
    expect(ok('  1789000000  ').milliseconds).toBe(1_789_000_000_000);
  });

  it('handles zero and negatives', () => {
    expect(ok('0').milliseconds).toBe(0);
    expect(ok('-86400').milliseconds).toBe(-86_400_000);
  });

  it('names why it failed', () => {
    expect(parseTimestamp('')).toEqual({ ok: false, code: 'empty' });
    expect(parseTimestamp('   ')).toEqual({ ok: false, code: 'empty' });
    expect(parseTimestamp('abc')).toEqual({ ok: false, code: 'not-a-number' });
    expect(parseTimestamp('12.5')).toEqual({ ok: false, code: 'not-a-number' });
  });

  it('rejects a value beyond what a Date can hold', () => {
    expect(parseTimestamp('99999999999999999', 'milliseconds')).toEqual({
      ok: false,
      code: 'out-of-range',
    });
  });
});

describe('unit conversion', () => {
  it('round-trips through seconds', () => {
    expect(toMilliseconds(MOMENT_SECONDS, 'seconds')).toBe(MOMENT_MS);
    expect(fromMilliseconds(MOMENT_MS, 'seconds')).toBe(MOMENT_SECONDS);
  });

  it('leaves milliseconds alone', () => {
    expect(toMilliseconds(MOMENT_MS, 'milliseconds')).toBe(MOMENT_MS);
    expect(fromMilliseconds(MOMENT_MS, 'milliseconds')).toBe(MOMENT_MS);
  });

  it('floors rather than rounds when dropping milliseconds', () => {
    expect(fromMilliseconds(1999, 'seconds')).toBe(1);
  });
});

describe('zone offsets', () => {
  it('puts Bangkok seven hours ahead of UTC', () => {
    expect(zoneOffsetMilliseconds(MOMENT_MS, ICT_TIME_ZONE)).toBe(ICT_OFFSET_MS);
  });

  it('puts UTC at zero', () => {
    expect(zoneOffsetMilliseconds(MOMENT_MS, UTC_TIME_ZONE)).toBe(0);
  });

  it('follows daylight saving where a zone has it', () => {
    const winter = Date.UTC(2026, 0, 15, 12);
    const summer = Date.UTC(2026, 6, 15, 12);

    expect(zoneOffsetMilliseconds(winter, 'Europe/London')).toBe(0);
    expect(zoneOffsetMilliseconds(summer, 'Europe/London')).toBe(60 * 60 * 1000);
  });
});

describe('parseLocalDateTime', () => {
  it('reads wall-clock time as the zone it was written in', () => {
    const result = parseLocalDateTime('2026-09-14T15:30:00', ICT_TIME_ZONE);
    expect(result).toMatchObject({ ok: true, milliseconds: MOMENT_MS });
  });

  it('reads the same text differently in another zone', () => {
    const ict = parseLocalDateTime('2026-09-14T15:30:00', ICT_TIME_ZONE);
    const utc = parseLocalDateTime('2026-09-14T15:30:00', UTC_TIME_ZONE);

    if (!ict.ok || !utc.ok) throw new Error('expected both to parse');
    expect(utc.milliseconds - ict.milliseconds).toBe(ICT_OFFSET_MS);
  });

  it('accepts a value with no seconds', () => {
    expect(parseLocalDateTime('2026-09-14T15:30', ICT_TIME_ZONE)).toMatchObject({
      ok: true,
      milliseconds: MOMENT_MS,
    });
  });

  it('names why it failed', () => {
    expect(parseLocalDateTime('', ICT_TIME_ZONE)).toEqual({
      ok: false,
      code: 'empty',
    });
    expect(parseLocalDateTime('not a date', ICT_TIME_ZONE)).toEqual({
      ok: false,
      code: 'not-a-number',
    });
  });

  it('round-trips through the input format', () => {
    const text = toLocalInputValue(MOMENT_MS, ICT_TIME_ZONE);
    expect(text).toBe('2026-09-14T15:30:00');
    expect(parseLocalDateTime(text, ICT_TIME_ZONE)).toMatchObject({
      milliseconds: MOMENT_MS,
    });
  });
});

describe('formats', () => {
  it('writes ISO 8601 in UTC', () => {
    expect(formatIso(MOMENT_MS)).toBe('2026-09-14T08:30:00.000Z');
  });

  it('writes RFC 2822 with the right weekday', () => {
    expect(formatRfc2822(MOMENT_MS)).toBe('Mon, 14 Sep 2026 08:30:00 +0000');
  });

  it('pads single-digit parts in RFC 2822', () => {
    expect(formatRfc2822(Date.UTC(2026, 0, 5, 3, 4, 5))).toBe(
      'Mon, 05 Jan 2026 03:04:05 +0000',
    );
  });
});

describe('Buddhist year', () => {
  it('is 543 ahead of the Gregorian one', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toBuddhistYear(2026) - 2026).toBe(BUDDHIST_YEAR_OFFSET);
  });

  it('reads the year in the zone being shown', () => {
    // 17:00 UTC on new year's eve is already the new year in Bangkok.
    const eve = Date.UTC(2026, 11, 31, 18, 0, 0);
    expect(gregorianYear(eve, UTC_TIME_ZONE)).toBe(2026);
    expect(gregorianYear(eve, ICT_TIME_ZONE)).toBe(2027);
  });
});

describe('formatRelative', () => {
  const now = MOMENT_MS;

  it('describes the past and the future', () => {
    expect(formatRelative(now - 3 * 60 * 60 * 1000, now, 'en')).toContain('3 hours ago');
    expect(formatRelative(now + 2 * 24 * 60 * 60 * 1000, now, 'en')).toContain(
      'in 2 days',
    );
  });

  it('picks the largest unit that fits', () => {
    expect(formatRelative(now - 90 * 1000, now, 'en')).toContain('minute');
    expect(formatRelative(now - 400 * 24 * 60 * 60 * 1000, now, 'en')).toContain(
      'year',
    );
  });

  it('says now when the difference is under a second', () => {
    expect(formatRelative(now + 200, now, 'en')).toBe('now');
  });

  it('speaks Thai too', () => {
    expect(formatRelative(now - 60 * 60 * 1000, now, 'th')).toContain('ชั่วโมง');
  });
});

describe('listTimeZones', () => {
  // supportedValuesOf lists IANA zones, which do not include plain "UTC".
  it('always offers Bangkok and UTC', () => {
    const zones = listTimeZones();
    expect(zones).toContain(ICT_TIME_ZONE);
    expect(zones).toContain(UTC_TIME_ZONE);
  });

  it('puts the two anchors first', () => {
    expect(listTimeZones().slice(0, 2)).toEqual([ICT_TIME_ZONE, UTC_TIME_ZONE]);
  });

  it('lists no zone twice', () => {
    const zones = listTimeZones();
    expect(new Set(zones).size).toBe(zones.length);
  });
});
