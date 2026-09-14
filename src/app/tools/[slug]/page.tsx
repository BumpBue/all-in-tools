import type { Metadata } from 'next';

import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import { TOOLS } from '@/config/tools';
import { hasOwnRoute } from '@/tools/routes';

type ToolParams = { slug: string };

// Tools with a route of their own are served by that static segment, which
// always wins over this dynamic one.
export function generateStaticParams(): ToolParams[] {
  return TOOLS.filter((tool) => !hasOwnRoute(tool.slug)).map((tool) => ({
    slug: tool.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ToolParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildToolMetadata(slug);
}

export default async function Page({ params }: { params: Promise<ToolParams> }) {
  const { slug } = await params;
  return <ToolPage slug={slug} />;
}
