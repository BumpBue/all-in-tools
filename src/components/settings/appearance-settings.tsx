'use client';

import { Monitor, Moon, Sun } from 'lucide-react';

import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { usePreferences } from '@/hooks/use-preferences';
import { useT } from '@/hooks/use-t';
import type { Locale, Theme } from '@/types/tool';

const ICON_SIZE = 16;

export function AppearanceSettings() {
  const t = useT();
  const { theme, locale, setTheme, setLocale } = usePreferences();

  const themeOptions: ReadonlyArray<ToggleOption<Theme>> = [
    { value: 'light', label: t.theme.light, icon: <Sun size={ICON_SIZE} aria-hidden /> },
    { value: 'dark', label: t.theme.dark, icon: <Moon size={ICON_SIZE} aria-hidden /> },
    {
      value: 'system',
      label: t.theme.system,
      icon: <Monitor size={ICON_SIZE} aria-hidden />,
    },
  ];

  const localeOptions: ReadonlyArray<ToggleOption<Locale>> = [
    { value: 'th', label: t.language.th },
    { value: 'en', label: t.language.en },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">{t.theme.label}</span>
        <Toggle
          options={themeOptions}
          value={theme}
          onChange={setTheme}
          label={t.theme.label}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">{t.language.label}</span>
        <Toggle
          options={localeOptions}
          value={locale}
          onChange={setLocale}
          label={t.language.label}
        />
      </div>
    </div>
  );
}
