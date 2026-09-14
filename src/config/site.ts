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

/** Used for canonical URLs and Open Graph. Vercel injects the real host at build time. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://toolbox.example.com';

export const DEFAULT_LOCALE: Locale = 'th';

export const DEFAULT_THEME: Theme = 'system';

/** How many same-category tools ToolShell suggests at the bottom of a tool page. */
export const RELATED_TOOLS_COUNT = 4;

/** Milliseconds the CopyButton stays in its confirmed state. */
export const COPY_FEEDBACK_MS = 2000;

/** Milliseconds to wait before running a search or a live conversion. */
export const INPUT_DEBOUNCE_MS = 200;
