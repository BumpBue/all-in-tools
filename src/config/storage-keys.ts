/**
 * Every localStorage and cookie key in the app is declared here. Nothing else
 * may build a key string by hand — that is how keys drift and data goes missing.
 */

/** All tool data lives under this prefix so export/import can find it by scanning. */
export const TOOL_STORAGE_PREFIX = 'tools:';

/** Bumped only when the stored envelope shape changes and needs a migration. */
export const TOOL_STORAGE_VERSION = 1;

export function buildToolStorageKey(slug: string): string {
  return `${TOOL_STORAGE_PREFIX}${slug}:v${TOOL_STORAGE_VERSION}`;
}

export const COOKIE_KEYS = {
  theme: 'theme',
  lang: 'lang',
  favorites: 'favorites',
  recent: 'recent',
} as const;

export type CookieKey = (typeof COOKIE_KEYS)[keyof typeof COOKIE_KEYS];

/** One year. */
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const COOKIE_PATH = '/';

/** Not httpOnly on purpose: client code toggles theme, language and favourites. */
export const COOKIE_SAME_SITE = 'Lax';

export const COOKIE_LIST_SEPARATOR = ',';

/**
 * Cookies ride along with every request and cap out around 4KB, so these lists
 * stay short. Tool data never goes in a cookie.
 */
export const MAX_FAVORITES = 20;
export const MAX_RECENT = 8;
