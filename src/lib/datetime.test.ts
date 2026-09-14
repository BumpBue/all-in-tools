import { describe, expect, it } from 'vitest';

import {
  BUDDHIST_YEAR_OFFSET,
  ICT_TIME_ZONE,
  UTC_TIME_ZONE,
  formatInZone,
  formatRelative,
  gregorianYear,
  toBuddhistYear,
} from '@/lib/datetime';

const MOMENT_MS = Date.UTC(2026, 8, 14, 8, 30, 0);

describe('Buddhist year', () => {
  it('is 543 ahead of the Gregorian one', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toBuddhistYear(2026) - 2026).toBe(BUDDHIST_YEAR_OFFSET);
  });

  it('reads the year in the zone being shown', () => {
    // 18:00 UTC on new year's eve is already the new year in Bangkok.
    const eve = Date.UTC(2026, 11, 31, 18, 0, 0);
    expect(gregorianYear(eve, UTC_TIME_ZONE)).toBe(2026);
    expect(gregorianYear(eve, ICT_TIME_ZONE)).toBe(2027);
  });
});

describe('formatInZone', () => {
  it('shows the same moment at two different local times', () => {
    const ict = formatInZone(MOMENT_MS, ICT_TIME_ZONE, 'en');
    const utc = formatInZone(MOMENT_MS, UTC_TIME_ZONE, 'en');

    expect(ict).toContain('3:30:00 PM');
    expect(utc).toContain('8:30:00 AM');
    expect(ict).not.toBe(utc);
  });

  it('writes the date in Thai when asked', () => {
    expect(formatInZone(MOMENT_MS, ICT_TIME_ZONE, 'th')).toContain('กันยายน');
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
    expect(formatRelative(now - 400 * 24 * 60 * 60 * 1000, now, 'en')).toContain('year');
  });

  it('says now when the difference is under a second', () => {
    expect(formatRelative(now + 200, now, 'en')).toBe('now');
  });

  it('speaks Thai too', () => {
    expect(formatRelative(now - 60 * 60 * 1000, now, 'th')).toContain('ชั่วโมง');
  });
});
