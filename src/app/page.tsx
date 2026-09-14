import { ShieldCheck } from 'lucide-react';

import { HeroSearchButton } from '@/components/home/hero-search-button';
import { ToolSection } from '@/components/tool/tool-section';
import { Icon } from '@/components/ui/icon';
import { format, getMessages } from '@/config/i18n';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  TOOLS_BY_CATEGORY,
  TOOL_COUNT,
  getTool,
  type Tool,
} from '@/config/tools';
import { readPreferences } from '@/lib/cookies.server';

const CATEGORY_ICON_SIZE = 18;
const NOTE_ICON_SIZE = 16;

function toTools(slugs: string[]): Tool[] {
  return slugs.map(getTool).filter((tool): tool is Tool => tool !== undefined);
}

export default async function HomePage() {
  const { locale, favorites, recent } = await readPreferences();
  const t = getMessages(locale);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 pb-2 pt-4">
        <h1 className="max-w-2xl text-display font-semibold">{t.home.heroTitle}</h1>
        <p className="max-w-2xl text-muted">
          {format(t.home.heroSubtitle, { count: TOOL_COUNT })}
        </p>
        <HeroSearchButton />
      </section>

      <ToolSection title={t.home.recent} tools={toTools(recent)} />
      <ToolSection title={t.home.favorites} tools={toTools(favorites)} />

      {CATEGORY_ORDER.map((category) => (
        <ToolSection
          key={category}
          title={CATEGORY_META[category][locale]}
          meta={format(t.home.toolCount, {
            count: TOOLS_BY_CATEGORY[category].length,
          })}
          icon={
            <Icon name={CATEGORY_META[category].icon} size={CATEGORY_ICON_SIZE} />
          }
          tools={TOOLS_BY_CATEGORY[category]}
        />
      ))}

      <p className="flex items-center justify-center gap-2 border-t border-border pt-8 text-center text-sm text-muted">
        <ShieldCheck size={NOTE_ICON_SIZE} className="shrink-0" aria-hidden />
        {t.home.privacyNote}
      </p>
    </div>
  );
}
