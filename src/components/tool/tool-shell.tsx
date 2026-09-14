import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { JsonLd } from '@/components/json-ld';
import { FavoriteButton } from '@/components/tool/favorite-button';
import { ShareLinkButton } from '@/components/tool/share-link-button';
import { ToolGrid } from '@/components/tool/tool-grid';
import { Badge } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { getMessages } from '@/config/i18n';
import { SITE_URL } from '@/config/site';
import { CATEGORY_META, type Tool } from '@/config/tools';
import type { Locale } from '@/types/tool';

const ICON_SIZE = 24;
const CHEVRON_SIZE = 14;

export function ToolShell({
  tool,
  related,
  locale,
  children,
}: {
  tool: Tool;
  related: Tool[];
  locale: Locale;
  children: ReactNode;
}) {
  const t = getMessages(locale);
  const meta = CATEGORY_META[tool.category];
  const planned = tool.status === 'planned';

  const trail = [
    { name: t.nav.home, href: '/' },
    { name: meta[locale], href: `/category/${tool.category}` },
    { name: tool.name[locale], href: `/tools/${tool.slug}` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: trail.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: `${SITE_URL}${crumb.href}`,
          })),
        }}
      />

      <nav aria-label="breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight size={CHEVRON_SIZE} aria-hidden /> : null}
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="rounded transition-colors hover:text-foreground"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            style={{ color: meta.color }}
            className="flex size-12 shrink-0 items-center justify-center rounded-card bg-surface-subtle"
          >
            <Icon name={tool.icon} size={ICON_SIZE} aria-hidden />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title font-semibold">{tool.name[locale]}</h1>
              {planned ? <Badge tone="muted">{t.tool.comingSoon}</Badge> : null}
            </div>
            <p className="text-muted">{tool.description[locale]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShareLinkButton shareLabel={t.tool.share} copiedLabel={t.tool.linkCopied} />
          <FavoriteButton
            slug={tool.slug}
            addLabel={t.tool.addFavorite}
            removeLabel={t.tool.removeFavorite}
            className="border border-border"
          />
        </div>
      </header>

      <div>{children}</div>

      {related.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-base font-semibold">{t.tool.related}</h2>
          <ToolGrid tools={related} locale={locale} />
        </section>
      ) : null}
    </div>
  );
}
