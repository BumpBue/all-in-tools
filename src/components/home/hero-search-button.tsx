'use client';

import { Search } from 'lucide-react';

import { useCommandPalette } from '@/components/command-palette/provider';
import { useIsMac } from '@/hooks/use-is-mac';
import { useT } from '@/hooks/use-t';

const ICON_SIZE = 18;

export function HeroSearchButton() {
  const t = useT();
  const { open } = useCommandPalette();
  const isMac = useIsMac();

  return (
    <button
      type="button"
      onClick={open}
      className="flex h-12 w-full max-w-xl items-center gap-3 rounded-control border border-border bg-surface px-4 text-left text-muted transition-colors hover:border-border-strong"
    >
      <Search size={ICON_SIZE} className="shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{t.search.placeholder}</span>
      <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
