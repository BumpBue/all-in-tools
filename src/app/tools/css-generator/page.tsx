import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import CssGenerator from '@/tools/css-generator';

const SLUG = 'css-generator';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <CssGenerator searchParams={query} />
    </ToolPage>
  );
}
