import { describe, expect, it } from 'vitest';

import { MESSAGES, format, getMessages, pick } from '@/config/i18n';
import { TOOLS } from '@/config/tools';

/**
 * The shared dictionary is loaded by the header on every page, so anything in
 * it ships to readers who never open the tool it belongs to. A tool's own
 * strings live in src/tools/<slug>/i18n.ts instead.
 */
const CORE_SECTIONS = [
  'skipToContent',
  'brand',
  'nav',
  'search',
  'theme',
  'language',
  'home',
  'tool',
  'footer',
  'settings',
  // The install button sits in the footer, so it is on every page too.
  'install',
];

function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

describe('the shared dictionary stays shared', () => {
  it('holds only the sections every page needs', () => {
    expect(Object.keys(MESSAGES.th).sort()).toEqual([...CORE_SECTIONS].sort());
  });

  it('has no section named after a tool', () => {
    const slugs = TOOLS.flatMap((tool) => [tool.slug, toCamelCase(tool.slug)]);
    const leaked = Object.keys(MESSAGES.th).filter((key) => slugs.includes(key));

    expect(leaked).toEqual([]);
  });

  it('keeps both languages in step', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.th).sort());
  });
});

describe('getMessages', () => {
  it('returns the table for each locale', () => {
    expect(getMessages('th').nav.home).toBe('หน้าแรก');
    expect(getMessages('en').nav.home).toBe('Home');
  });
});

describe('pick', () => {
  it('takes the side matching the locale', () => {
    const text = { th: 'ไทย', en: 'English' };
    expect(pick(text, 'th')).toBe('ไทย');
    expect(pick(text, 'en')).toBe('English');
  });
});

describe('format', () => {
  it('fills a placeholder', () => {
    expect(format('พบ {count} เครื่องมือ', { count: 7 })).toBe('พบ 7 เครื่องมือ');
  });

  it('fills every occurrence', () => {
    expect(format('{a} and {a}', { a: 'x' })).toBe('x and x');
  });

  it('leaves an unknown placeholder as written', () => {
    expect(format('keep {nope}', {})).toBe('keep {nope}');
  });
});
