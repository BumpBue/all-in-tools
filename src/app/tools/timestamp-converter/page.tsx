import {
  ToolPage,
  buildToolMetadata,
  firstValues,
  type ToolRouteProps,
} from '@/app/tools/_shared/tool-page';
import TimestampConverter from '@/tools/timestamp-converter';

const SLUG = 'timestamp-converter';

export const generateMetadata = () => buildToolMetadata(SLUG);

export default async function Page({ searchParams }: ToolRouteProps) {
  const query = firstValues(await searchParams);

  return (
    <ToolPage slug={SLUG}>
      <TimestampConverter searchParams={query} />
    </ToolPage>
  );
}
