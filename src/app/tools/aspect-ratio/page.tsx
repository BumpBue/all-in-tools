import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import AspectRatio from '@/tools/aspect-ratio';

const SLUG = 'aspect-ratio';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <AspectRatio searchParams={query} />
    </ToolPage>
  );
}
