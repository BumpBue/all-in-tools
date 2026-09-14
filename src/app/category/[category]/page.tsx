import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { ToolGrid } from '@/components/tool/tool-grid';
import { Icon } from '@/components/ui/icon';
import { format, getMessages } from '@/config/i18n';
import { SITE_NAME } from '@/config/site';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  TOOLS_BY_CATEGORY,
  isToolCategory,
} from '@/config/tools';
import { readPreferences } from '@/lib/cookies.server';

const ICON_SIZE = 22;
const CHEVRON_SIZE = 14;

type CategoryParams = { category: string };

export function generateStaticParams(): CategoryParams[] {
  return CATEGORY_ORDER.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryParams>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isToolCategory(category)) return {};

  const { locale } = await readPreferences();
  const t = getMessages(locale);
  const meta = CATEGORY_META[category];
  const title = `${meta[locale]} — ${SITE_NAME}`;

  return {
    title,
    description: format(t.home.toolCount, {
      count: TOOLS_BY_CATEGORY[category].length,
    }),
    alternates: { canonical: `/category/${category}` },
    openGraph: { title, type: 'website', url: `/category/${category}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<CategoryParams>;
}) {
  const { category } = await params;
  if (!isToolCategory(category)) notFound();

  const { locale } = await readPreferences();
  const t = getMessages(locale);
  const meta = CATEGORY_META[category];
  const tools = TOOLS_BY_CATEGORY[category];

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="breadcrumb">
        <ol className="flex items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/" className="rounded transition-colors hover:text-foreground">
              {t.nav.home}
            </Link>
          </li>
          <ChevronRight size={CHEVRON_SIZE} aria-hidden />
          <li aria-current="page" className="text-foreground">
            {meta[locale]}
          </li>
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <span
          style={{ color: meta.color }}
          className="flex size-11 shrink-0 items-center justify-center rounded-card bg-surface-subtle"
        >
          <Icon name={meta.icon} size={ICON_SIZE} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h1 className="text-title font-semibold">{meta[locale]}</h1>
          <p className="text-sm text-muted">
            {format(t.home.toolCount, { count: tools.length })}
          </p>
        </div>
      </div>

      <ToolGrid tools={tools} />
    </div>
  );
}
