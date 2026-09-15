import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import EisenhowerMatrix from '@/tools/eisenhower-matrix';

const SLUG = 'eisenhower-matrix';

export const generateMetadata = () => buildToolMetadata(SLUG);

// The board lives on the device, so there is no query state to read.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <EisenhowerMatrix />
    </ToolPage>
  );
}
