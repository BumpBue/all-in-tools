import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import { Skeleton } from '@/components/ui/card';
import type { ToolComponentProps } from '@/tools/types';

// Roughly the shape of a loaded tool, so the page does not jump when it lands.
function ToolLoading() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-20" />
    </div>
  );
}

/**
 * SSR stays on so the tool's markup is in the HTML for search engines and for
 * anyone whose JavaScript has not arrived yet. Turn it off only for a tool that
 * genuinely needs a browser API on its very first render.
 *
 * Measured caveat: this does not split per slug. Everything reachable from the
 * single /tools/[slug] route lands in that route's client bundle, so every tool
 * page carries every tool's code. One tool costs about 5 kB gzipped. See
 * docs/TOOL_PATTERN.md before this list grows.
 */
export const TOOL_COMPONENTS: Record<string, ComponentType<ToolComponentProps>> = {
  'base-converter': dynamic(() => import('@/tools/base-converter'), {
    loading: ToolLoading,
  }),
};

export const IMPLEMENTED_TOOL_SLUGS = Object.keys(TOOL_COMPONENTS);

export function hasToolComponent(slug: string): boolean {
  return slug in TOOL_COMPONENTS;
}

export function getToolComponent(
  slug: string,
): ComponentType<ToolComponentProps> | undefined {
  return TOOL_COMPONENTS[slug];
}
