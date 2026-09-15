import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import GpaCalculator from '@/tools/gpa-calculator';

const SLUG = 'gpa-calculator';

export const generateMetadata = () => buildToolMetadata(SLUG);

// A transcript stays on the device; nothing here belongs in a link.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <GpaCalculator />
    </ToolPage>
  );
}
