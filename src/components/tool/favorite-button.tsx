'use client';

import { Star } from 'lucide-react';

import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';

const ICON_SIZE = 16;

// Primitives only, never the Tool object: everything a client component takes
// as props is serialized into the RSC payload of every page that renders it.
export function FavoriteButton({
  slug,
  addLabel,
  removeLabel,
  className,
}: {
  slug: string;
  addLabel: string;
  removeLabel: string;
  className?: string;
}) {
  // Read from context rather than a prop so the star flips on click instead of
  // waiting for the server round trip that router.refresh() starts.
  const { isFavorite, toggleFavorite } = usePreferences();
  const active = isFavorite(slug);
  const label = active ? removeLabel : addLabel;

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
