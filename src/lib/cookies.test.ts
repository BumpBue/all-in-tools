import { describe, expect, it } from 'vitest';

import { MAX_FAVORITES, MAX_RECENT } from '@/config/storage-keys';
import {
  normalizeLocale,
  normalizeTheme,
  parseCookieHeader,
  parseSlugList,
  pushRecent,
  serializeCookie,
  serializeSlugList,
  toPreferences,
  toggleFavorite,
} from '@/lib/cookies';

const OVER_LIMIT = 30;

function slugs(count: number, prefix = 'tool'): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

describe('normalizeTheme', () => {
  it('accepts the three known themes', () => {
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('system')).toBe('system');
  });

  it('falls back for anything else', () => {
    expect(normalizeTheme('neon')).toBe('system');
    expect(normalizeTheme(undefined)).toBe('system');
  });
});

describe('normalizeLocale', () => {
  it('accepts the two supported locales', () => {
    expect(normalizeLocale('th')).toBe('th');
    expect(normalizeLocale('en')).toBe('en');
  });

  it('falls back to Thai', () => {
    expect(normalizeLocale('fr')).toBe('th');
    expect(normalizeLocale(undefined)).toBe('th');
  });
});

describe('parseSlugList', () => {
  it('returns an empty list for a missing cookie', () => {
    expect(parseSlugList(undefined, MAX_RECENT)).toEqual([]);
    expect(parseSlugList('', MAX_RECENT)).toEqual([]);
  });

  it('splits on commas and trims', () => {
    expect(parseSlugList('pomodoro, base-converter', MAX_RECENT)).toEqual([
      'pomodoro',
      'base-converter',
    ]);
  });

  it('drops entries that are not valid slugs', () => {
    expect(parseSlugList('pomodoro,../evil,Bad Slug,base64', MAX_RECENT)).toEqual([
      'pomodoro',
      'base64',
    ]);
  });

  it('drops duplicates, keeping the first', () => {
    expect(parseSlugList('a,b,a,c', MAX_RECENT)).toEqual(['a', 'b', 'c']);
  });

  it('truncates a tampered cookie to the limit', () => {
    const parsed = parseSlugList(slugs(OVER_LIMIT).join(','), MAX_RECENT);
    expect(parsed).toHaveLength(MAX_RECENT);
  });
});

describe('toggleFavorite', () => {
  it('adds a new favourite at the front', () => {
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('removes a favourite that is already set', () => {
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('never grows past the limit', () => {
    const full = slugs(MAX_FAVORITES);
    const result = toggleFavorite(full, 'newcomer');

    expect(result).toHaveLength(MAX_FAVORITES);
    expect(result[0]).toBe('newcomer');
    expect(result).not.toContain(full[MAX_FAVORITES - 1]);
  });
});

describe('pushRecent', () => {
  it('puts the newest entry first', () => {
    expect(pushRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('moves an existing entry to the front instead of duplicating it', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('drops the oldest entry past the limit', () => {
    const full = slugs(MAX_RECENT);
    const result = pushRecent(full, 'newcomer');

    expect(result).toHaveLength(MAX_RECENT);
    expect(result[0]).toBe('newcomer');
    expect(result).not.toContain(full[MAX_RECENT - 1]);
  });
});

describe('parseCookieHeader', () => {
  it('reads name and value pairs', () => {
    expect(parseCookieHeader('theme=dark; lang=en')).toEqual({
      theme: 'dark',
      lang: 'en',
    });
  });

  it('decodes percent-encoded values', () => {
    expect(parseCookieHeader('recent=a%2Cb').recent).toBe('a,b');
  });

  it('ignores malformed segments', () => {
    expect(parseCookieHeader('theme=dark; broken; =orphan')).toEqual({
      theme: 'dark',
    });
  });

  it('returns an empty jar for an empty header', () => {
    expect(parseCookieHeader('')).toEqual({});
  });
});

describe('serializeCookie', () => {
  it('sets a one-year lifetime scoped to the whole site', () => {
    const serialized = serializeCookie('theme', 'dark');

    expect(serialized).toContain('theme=dark');
    expect(serialized).toContain('Path=/');
    expect(serialized).toContain('Max-Age=31536000');
    expect(serialized).toContain('SameSite=Lax');
  });

  it('encodes the comma in a slug list', () => {
    expect(serializeCookie('recent', serializeSlugList(['a', 'b']))).toContain(
      'recent=a%2Cb',
    );
  });
});

describe('toPreferences', () => {
  it('builds a complete preference set from an empty jar', () => {
    expect(toPreferences({})).toEqual({
      theme: 'system',
      locale: 'th',
      favorites: [],
      recent: [],
    });
  });

  it('reads every preference from the jar', () => {
    expect(
      toPreferences({
        theme: 'dark',
        lang: 'en',
        favorites: 'base-converter',
        recent: 'pomodoro,base64',
      }),
    ).toEqual({
      theme: 'dark',
      locale: 'en',
      favorites: ['base-converter'],
      recent: ['pomodoro', 'base64'],
    });
  });
});
