import type { Locale, Theme } from '@/types/tool';

export const SITE_NAME = 'Toolbox';

export const SITE_TITLE = {
  th: 'Toolbox — รวมเครื่องมือออนไลน์ 36 ตัวในที่เดียว',
  en: 'Toolbox — 36 online utilities in one place',
} as const;

export const SITE_DESCRIPTION = {
  th: 'เครื่องมือออนไลน์ 36 ตัวสำหรับงานเรียน งานเงิน งานเขียนโค้ด และงานออกแบบ ทำงานในเบราว์เซอร์ของคุณล้วน ไม่ส่งข้อมูลขึ้นเซิร์ฟเวอร์',
  en: 'Thirty-six browser utilities for study, money, code and design. Everything runs on your device — nothing is uploaded.',
} as const;

/**
 * Stands in when NEXT_PUBLIC_SITE_URL is missing or unusable. Canonical URLs
 * and the sitemap will point at the wrong host, which is a bad deploy but a
 * recoverable one; throwing here would take the whole build down instead.
 */
export const FALLBACK_SITE_URL = 'https://all-in-tools.vercel.app';

const SITE_URL_PROTOCOLS = ['http:', 'https:'];

export function resolveSiteUrl(
  raw: string | undefined,
  onFallback?: (reason: string) => void,
): string {
  // `??` is not enough: an environment variable set to an empty string is not
  // nullish, and `new URL('')` throws. That is what broke the first deploy.
  const trimmed = raw?.trim() ?? '';

  if (trimmed.length === 0) {
    onFallback?.('NEXT_PUBLIC_SITE_URL is not set');
    return FALLBACK_SITE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    onFallback?.(`NEXT_PUBLIC_SITE_URL is not a URL: ${trimmed}`);
    return FALLBACK_SITE_URL;
  }

  if (!SITE_URL_PROTOCOLS.includes(parsed.protocol)) {
    onFallback?.(`NEXT_PUBLIC_SITE_URL is not http or https: ${trimmed}`);
    return FALLBACK_SITE_URL;
  }

  // Callers build paths as `${SITE_URL}/thing`, so a trailing slash would give
  // them a double one. Query and hash have no meaning for a site origin.
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
}

let warnedAboutSiteUrl = false;

function warnAboutSiteUrl(reason: string): void {
  // Said once during the build, where someone can act on it. Shouting in every
  // visitor's console would help nobody.
  if (typeof window !== 'undefined') return;

  // The build evaluates this module many times over; one line is a warning,
  // forty is noise someone learns to scroll past.
  if (warnedAboutSiteUrl) return;
  warnedAboutSiteUrl = true;

  console.warn(
    `[config] ${reason}. Falling back to ${FALLBACK_SITE_URL}. ` +
      'Set NEXT_PUBLIC_SITE_URL so canonical URLs, Open Graph tags and ' +
      'sitemap.xml point at the real host.',
  );
}

/** Used for canonical URLs and Open Graph. Always a valid absolute URL. */
export const SITE_URL = resolveSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  warnAboutSiteUrl,
);

export const DEFAULT_LOCALE: Locale = 'th';

export const DEFAULT_THEME: Theme = 'system';

/** How many same-category tools ToolShell suggests at the bottom of a tool page. */
export const RELATED_TOOLS_COUNT = 4;

/** Milliseconds the CopyButton stays in its confirmed state. */
export const COPY_FEEDBACK_MS = 2000;

/** Milliseconds to wait before running a search or a live conversion. */
export const INPUT_DEBOUNCE_MS = 200;
