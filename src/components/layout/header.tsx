'use client';

import Link from 'next/link';
import { Monitor, Moon, Search, Settings, Sun } from 'lucide-react';

import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { usePreferences } from '@/hooks/use-preferences';
import { useT } from '@/hooks/use-t';
import type { Theme } from '@/types/tool';

const ICON_SIZE = 16;
const SHORTCUT_HINT = '⌘K';
const LOCALE_LABELS = { th: 'TH', en: 'EN' } as const;

export function Header({ onOpenSearch }: { onOpenSearch?: () => void }) {
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-content items-center gap-2 px-4">
        <Link
          href="/"
          aria-label={t.brand.home}
          className="shrink-0 rounded-control text-base font-semibold tracking-tight"
        >
          Toolbox
        </Link>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm text-muted transition-colors hover:border-border-strong"
        >
          <Search size={ICON_SIZE} aria-hidden />
          <span className="truncate">{t.search.trigger}</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">
            {SHORTCUT_HINT}
          </kbd>
        </button>

        <Toggle
          options={themeOptions}
          value={theme}
          onChange={setTheme}
          label={t.theme.label}
          className="shrink-0"
        />

        <button
          type="button"
          onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
          aria-label={t.language.label}
          title={t.language.label}
          className="inline-flex h-8 shrink-0 items-center rounded-control border border-border px-2 font-mono text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          {LOCALE_LABELS[locale]}
        </button>

        <Link
          href="/settings"
          aria-label={t.nav.settings}
          title={t.nav.settings}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
        >
          <Settings size={ICON_SIZE} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
