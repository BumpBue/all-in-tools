'use client';

import Link from 'next/link';
import { Monitor, Moon, Search, Sun } from 'lucide-react';

import { useCommandPalette } from '@/components/command-palette/provider';
import { SiteMenu } from '@/components/layout/site-menu';
import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { useIsMac } from '@/hooks/use-is-mac';
import { usePreferences } from '@/hooks/use-preferences';
import { useT } from '@/hooks/use-t';
import type { Theme } from '@/types/tool';

const ICON_SIZE = 16;

export function Header() {
  const t = useT();
  const { open: openSearch } = useCommandPalette();
  const { theme, setTheme } = usePreferences();
  const isMac = useIsMac();

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

        {/* Below sm the trigger is an icon only; a text field that narrow is
            unusable and the palette provides the real input anyway. */}
        <button
          type="button"
          onClick={openSearch}
          aria-label={t.search.trigger}
          title={t.search.trigger}
          className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-subtle hover:text-foreground sm:ml-0 sm:h-9 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-start sm:gap-2 sm:border sm:border-border sm:bg-surface sm:px-3 sm:text-sm sm:hover:border-border-strong sm:hover:bg-surface"
        >
          <Search size={ICON_SIZE} aria-hidden />
          <span className="hidden truncate sm:inline">{t.search.placeholder}</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <Toggle
          options={themeOptions}
          value={theme}
          onChange={setTheme}
          label={t.theme.label}
          className="shrink-0"
        />

        <SiteMenu />
      </div>
    </header>
  );
}
