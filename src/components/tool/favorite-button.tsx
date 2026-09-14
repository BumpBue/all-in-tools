'use client';

import { Star } from 'lucide-react';

import { usePreferences } from '@/hooks/use-preferences';
import { useT } from '@/hooks/use-t';
import { cn } from '@/lib/utils';

const ICON_SIZE = 16;

export function FavoriteButton({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const t = useT();
  const { isFavorite, toggleFavorite } = usePreferences();
  const active = isFavorite(slug);
  const label = active ? t.tool.removeFavorite : t.tool.addFavorite;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={() => toggleFavorite(slug)}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-control transition-colors',
        active
          ? 'text-accent hover:bg-surface-subtle'
          : 'text-muted hover:bg-surface-subtle hover:text-foreground',
        className,
      )}
    >
      <Star size={ICON_SIZE} fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
