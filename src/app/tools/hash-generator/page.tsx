import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import HashGenerator from '@/tools/hash-generator';

const SLUG = 'hash-generator';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <HashGenerator searchParams={query} />
    </ToolPage>
  );
}
