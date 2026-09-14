'use client';

import Link from 'next/link';
import { Check, Menu, Settings } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { usePreferences } from '@/hooks/use-preferences';
import { useT } from '@/hooks/use-t';
import { cn } from '@/lib/utils';
import type { Locale } from '@/types/tool';

const ICON_SIZE = 16;
const LOCALES: readonly Locale[] = ['th', 'en'];

const ITEM =
  'flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-sm text-left ' +
  'transition-colors hover:bg-surface-subtle';

export function SiteMenu() {
  const t = useT();
  const { locale, setLocale } = usePreferences();
  const [open, setOpen] = useState(false);

  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t.nav.menu}
        title={t.nav.menu}
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-control transition-colors',
          open
            ? 'bg-surface-subtle text-foreground'
            : 'text-muted hover:bg-surface-subtle hover:text-foreground',
        )}
      >
        <Menu size={ICON_SIZE} aria-hidden />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={t.nav.menu}
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-card border border-border bg-surface p-1.5 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted">
            {t.language.label}
          </p>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === locale}
              onClick={() => {
                setLocale(option);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={ITEM}
            >
              <Check
                size={ICON_SIZE}
                aria-hidden
                className={option === locale ? 'text-accent' : 'invisible'}
              />
              {t.language[option]}
            </button>
          ))}

          <div className="my-1.5 border-t border-border" />

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM}
          >
            <Settings size={ICON_SIZE} aria-hidden />
            {t.nav.settings}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
