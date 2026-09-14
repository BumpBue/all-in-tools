import type { ReactNode } from 'react';

import { ToolGrid } from '@/components/tool/tool-grid';
import type { Tool } from '@/config/tools';
import type { Locale } from '@/types/tool';

export function ToolSection({
  title,
  meta,
  icon,
  tools,
  locale,
}: {
  title: string;
  meta?: string;
  icon?: ReactNode;
  tools: readonly Tool[];
  locale: Locale;
}) {
  if (tools.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        {icon ? <span className="self-center text-muted">{icon}</span> : null}
        <h2 className="text-title font-semibold">{title}</h2>
        {meta ? <span className="text-sm text-muted">{meta}</span> : null}
      </div>
      <ToolGrid tools={tools} locale={locale} />
    </section>
  );
}
