import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import DateCalculator from '@/tools/date-calculator';

const SLUG = 'date-calculator';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <DateCalculator searchParams={query} />
    </ToolPage>
  );
}
