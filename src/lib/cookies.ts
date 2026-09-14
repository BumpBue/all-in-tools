import {
  COOKIE_LIST_SEPARATOR,
  COOKIE_MAX_AGE_SECONDS,
  COOKIE_PATH,
  COOKIE_SAME_SITE,
  MAX_FAVORITES,
  MAX_RECENT,
  TOOL_SLUG_PATTERN,
} from '@/config/storage-keys';
import { DEFAULT_LOCALE, DEFAULT_THEME } from '@/config/site';
import type { Locale, Theme } from '@/types/tool';

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];
const LOCALES: readonly Locale[] = ['th', 'en'];

export interface Preferences {
  theme: Theme;
  locale: Locale;
  favorites: string[];
  recent: string[];
}

export function normalizeTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

export function normalizeLocale(value: string | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function parseSlugList(value: string | undefined, limit: number): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const raw of value.split(COOKIE_LIST_SEPARATOR)) {
    const slug = raw.trim();
    if (!TOOL_SLUG_PATTERN.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length === limit) break;
  }

  return slugs;
}

export function serializeSlugList(slugs: string[]): string {
  return slugs.join(COOKIE_LIST_SEPARATOR);
}

export function toggleFavorite(favorites: string[], slug: string): string[] {
  if (favorites.includes(slug)) {
    return favorites.filter((entry) => entry !== slug);
  }
  return [slug, ...favorites].slice(0, MAX_FAVORITES);
}

export function pushRecent(recent: string[], slug: string): string[] {
  return [slug, ...recent.filter((entry) => entry !== slug)].slice(0, MAX_RECENT);
}

export function parseCookieHeader(header: string): Record<string, string> {
  const jar: Record<string, string> = {};

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (!name) continue;

    try {
      jar[name] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      jar[name] = part.slice(separator + 1).trim();
    }
  }

  return jar;
}

export function serializeCookie(name: string, value: string): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    `SameSite=${COOKIE_SAME_SITE}`,
  ].join('; ');
}

export function toPreferences(jar: Record<string, string>): Preferences {
  return {
    theme: normalizeTheme(jar.theme),
    locale: normalizeLocale(jar.lang),
    favorites: parseSlugList(jar.favorites, MAX_FAVORITES),
    recent: parseSlugList(jar.recent, MAX_RECENT),
  };
}

export function readClientCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return parseCookieHeader(document.cookie);
}

export function writeClientCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = serializeCookie(name, value);
}
