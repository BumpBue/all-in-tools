import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import MockDataGenerator from '@/tools/mock-data-generator';

const SLUG = 'mock-data-generator';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <MockDataGenerator searchParams={query} />
    </ToolPage>
  );
}
