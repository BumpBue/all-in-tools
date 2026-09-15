import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import DecisionMatrix from '@/tools/decision-matrix';

const SLUG = 'decision-matrix';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <DecisionMatrix searchParams={query} />
    </ToolPage>
  );
}
