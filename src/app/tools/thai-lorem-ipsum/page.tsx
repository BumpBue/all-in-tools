import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import ThaiLoremIpsum from '@/tools/thai-lorem-ipsum';

const SLUG = 'thai-lorem-ipsum';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <ThaiLoremIpsum searchParams={query} />
    </ToolPage>
  );
}
