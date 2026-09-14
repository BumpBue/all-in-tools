import type { Locale } from '@/types/tool';

/**
 * A tool's own strings, kept beside the tool rather than in the shared
 * dictionary. The shared one is loaded by the header on every page, so anything
 * put there ships to readers who never open the tool.
 *
 * The English table is typed against the Thai one, so a missing or renamed key
 * is a compile error.
 */
export function createToolMessages<T extends Record<string, string>>(
  th: T,
  en: T,
): (locale: Locale) => T {
  const messages: Record<Locale, T> = { th, en };
  return (locale) => messages[locale];
}
