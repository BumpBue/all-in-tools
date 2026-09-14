'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

import { FavoriteButton } from '@/components/tool/favorite-button';
import { Badge } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { CATEGORY_META, type Tool } from '@/config/tools';
import { useLocale, useT } from '@/hooks/use-t';
import { cn } from '@/lib/utils';

const ICON_SIZE = 20;

export function ToolCard({ tool }: { tool: Tool }) {
  const t = useT();
  const locale = useLocale();
  const planned = tool.status === 'planned';

  return (
    <div
      style={{ '--tool-accent': CATEGORY_META[tool.category].color } as CSSProperties}
      className="relative rounded-card border border-border bg-surface transition-colors hover:border-border-strong"
    >
      {/* The favourite button is a sibling of the link, not a child, so a click
          on it never navigates. */}
      <FavoriteButton slug={tool.slug} className="absolute right-2 top-2 z-10" />

      <Link
        href={`/tools/${tool.slug}`}
        className={cn(
          'flex h-full flex-col gap-3 rounded-card p-4 pr-12',
          planned && 'opacity-65',
        )}
      >
        <span className="flex items-center gap-3">
          <span className="tool-accent-tint flex size-10 shrink-0 items-center justify-center rounded-control text-(--tool-accent)">
            <Icon name={tool.icon} size={ICON_SIZE} aria-hidden />
          </span>
          <span className="min-w-0 font-medium">{tool.name[locale]}</span>
        </span>

        <span className="line-clamp-2 text-sm text-muted">
          {tool.description[locale]}
        </span>

        {planned ? (
          <Badge tone="muted" className="mt-auto w-fit">
            {t.tool.comingSoon}
          </Badge>
        ) : null}
      </Link>
    </div>
  );
}
