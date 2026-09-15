import type { Metadata } from 'next';

import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';

type ToolParams = { slug: string };

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
