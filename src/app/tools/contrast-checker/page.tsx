import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import ContrastChecker from '@/tools/contrast-checker';

const SLUG = 'contrast-checker';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <ContrastChecker searchParams={query} />
    </ToolPage>
  );
}
