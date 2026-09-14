'use client';

import { getMessages, type Dictionary } from '@/config/i18n';
import { usePreferences } from '@/hooks/use-preferences';
import type { Locale, LocalizedText } from '@/types/tool';

export function useT(): Dictionary {
  return getMessages(usePreferences().locale);
}

export function useLocale(): Locale {
  return usePreferences().locale;
}

export function useLocalized(): (text: LocalizedText) => string {
  const locale = useLocale();
  return (text) => text[locale];
}
