import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { SearchForm } from '@/components/search/search-form';
import { ToolGrid } from '@/components/tool/tool-grid';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { format, getMessages } from '@/config/i18n';
import { SITE_NAME } from '@/config/site';
import { TOOLS, searchTools } from '@/config/tools';
import { readPreferences } from '@/lib/cookies.server';

const EMPTY_ICON_SIZE = 28;

export const metadata: Metadata = {
  title: `ค้นหาเครื่องมือ — ${SITE_NAME}`,
  // Results pages are a navigation aid, not content worth indexing.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const { locale } = await readPreferences();
  const t = getMessages(locale);
  const results = query.length > 0 ? searchTools(query) : TOOLS;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-title font-semibold">{t.search.pageTitle}</h1>
        <SearchForm
          defaultValue={query}
          placeholder={t.search.placeholder}
          submitLabel={t.search.submit}
        />
      </div>

      {results.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm text-muted">
            {query.length > 0
              ? format(t.search.resultsFor, { query })
              : t.home.allTools}
            {' · '}
            {format(t.home.toolCount, { count: results.length })}
          </h2>
          <ToolGrid tools={results} locale={locale} />
        </section>
      ) : (
        <EmptyState
          icon={<SearchX size={EMPTY_ICON_SIZE} aria-hidden />}
          title={t.search.empty}
          description={t.search.emptyHint}
          action={
            <Link href="/" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {t.search.backHome}
            </Link>
          }
        />
      )}
    </div>
  );
}
