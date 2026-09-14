export const TOOL_STORAGE_PREFIX = 'tools:';

export const TOOL_STORAGE_VERSION = 1;

export const TOOL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildToolStorageKey(slug: string): string {
  return `${TOOL_STORAGE_PREFIX}${slug}:v${TOOL_STORAGE_VERSION}`;
}

export function parseToolStorageKey(key: string): string | null {
  if (!key.startsWith(TOOL_STORAGE_PREFIX)) return null;

  const rest = key.slice(TOOL_STORAGE_PREFIX.length);
  const versionSeparator = rest.lastIndexOf(':');
  if (versionSeparator === -1) return null;

  const slug = rest.slice(0, versionSeparator);
  return TOOL_SLUG_PATTERN.test(slug) ? slug : null;
}

export const COOKIE_KEYS = {
  theme: 'theme',
  lang: 'lang',
  favorites: 'favorites',
  recent: 'recent',
} as const;

export type CookieKey = (typeof COOKIE_KEYS)[keyof typeof COOKIE_KEYS];

export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const COOKIE_PATH = '/';

// Not httpOnly: client code toggles theme, language and favourites.
export const COOKIE_SAME_SITE = 'Lax';

export const COOKIE_LIST_SEPARATOR = ',';

// Cookies ride along with every request and cap out near 4KB, so these stay short.
export const MAX_FAVORITES = 20;
export const MAX_RECENT = 8;
