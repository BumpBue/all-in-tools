import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hammer } from 'lucide-react';
import type { ReactNode } from 'react';

import { JsonLd } from '@/components/json-ld';
import { RecordRecent } from '@/components/tool/record-recent';
import { ToolShell } from '@/components/tool/tool-shell';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { getMessages } from '@/config/i18n';
import { RELATED_TOOLS_COUNT, SITE_NAME, SITE_URL } from '@/config/site';
import { getRelatedTools, getTool } from '@/config/tools';
import { readPreferences } from '@/lib/cookies.server';

const EMPTY_ICON_SIZE = 28;
const APPLICATION_CATEGORY = 'UtilitiesApplication';

export type ToolQuery = Record<string, string | string[] | undefined>;

export interface ToolRouteProps {
  searchParams: Promise<ToolQuery>;
}

export function firstValues(query: ToolQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      const single = Array.isArray(value) ? value[0] : value;
      return single === undefined ? [] : [[key, single]];
    }),
  );
}

/** Shared by every tool route so metadata is written once, not 36 times. */
export async function buildToolMetadata(slug: string): Promise<Metadata> {
  const tool = getTool(slug);
  if (!tool) return {};

  const { locale } = await readPreferences();
  const title = `${tool.name[locale]} — ${SITE_NAME}`;
  const description = tool.description[locale];
  const url = `/tools/${tool.slug}`;

  return {
    title,
    description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: SITE_NAME },
    twitter: { card: 'summary', title, description },
  };
}

/**
 * The whole page around a tool. Pass children to render the tool itself; leave
 * them out and the slug is treated as not yet built.
 */
export async function ToolPage({
  slug,
  children,
}: {
  slug: string;
  children?: ReactNode;
}) {
  const tool = getTool(slug);
  if (!tool) notFound();

  const { locale } = await readPreferences();
  const t = getMessages(locale);
  const related = getRelatedTools(tool, RELATED_TOOLS_COUNT);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: tool.name[locale],
          description: tool.description[locale],
          url: `${SITE_URL}/tools/${tool.slug}`,
          applicationCategory: APPLICATION_CATEGORY,
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript',
          keywords: tool.keywords.join(', '),
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
        }}
      />

      {/* Only tools that actually work are worth a slot in the recent list. */}
      {children ? <RecordRecent slug={tool.slug} /> : null}

      <ToolShell tool={tool} related={related} locale={locale}>
        {children ?? (
          <EmptyState
            icon={<Hammer size={EMPTY_ICON_SIZE} aria-hidden />}
            title={t.tool.comingSoon}
            description={t.tool.notReady}
            action={
              <Link
                href={`/category/${tool.category}`}
                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
              >
                {t.tool.backToCategory}
              </Link>
            }
          />
        )}
      </ToolShell>
    </>
  );
}
