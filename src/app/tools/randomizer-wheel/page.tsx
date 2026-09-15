import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import RandomizerWheel from '@/tools/randomizer-wheel';

const SLUG = 'randomizer-wheel';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <RandomizerWheel searchParams={query} />
    </ToolPage>
  );
}
