import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hammer } from 'lucide-react';

import { JsonLd } from '@/components/json-ld';
import { RecordRecent } from '@/components/tool/record-recent';
import { ToolShell } from '@/components/tool/tool-shell';
import { EmptyState } from '@/components/ui/card';
import { getMessages } from '@/config/i18n';
import { RELATED_TOOLS_COUNT, SITE_NAME, SITE_URL } from '@/config/site';
import { TOOLS, getRelatedTools, getTool } from '@/config/tools';
import { readPreferences } from '@/lib/cookies.server';

const EMPTY_ICON_SIZE = 28;
const APPLICATION_CATEGORY = 'UtilitiesApplication';

type ToolParams = { slug: string };

export function generateStaticParams(): ToolParams[] {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ToolParams>;
}): Promise<Metadata> {
  const { slug } = await params;
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

export default async function ToolPage({
  params,
}: {
  params: Promise<ToolParams>;
}) {
  const { slug } = await params;
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

      {/* Only tools that actually work are worth putting in the recent list. */}
      {tool.status === 'ready' ? <RecordRecent slug={tool.slug} /> : null}

      <ToolShell tool={tool} related={related}>
        {tool.status === 'ready' ? (
          <p className="text-sm text-muted">{t.tool.uiPending}</p>
        ) : (
          <EmptyState
            icon={<Hammer size={EMPTY_ICON_SIZE} aria-hidden />}
            title={t.tool.comingSoon}
            description={t.tool.notReady}
            action={
              <Link
                href={`/category/${tool.category}`}
                className="inline-flex h-8 items-center rounded-control border border-border bg-surface px-3 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface-subtle"
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
