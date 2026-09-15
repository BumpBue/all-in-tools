import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import Countdown from '@/tools/countdown';

const SLUG = 'countdown';

export const generateMetadata = () => buildToolMetadata(SLUG);

// Events live on the device, so there is no query state to read.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <Countdown />
    </ToolPage>
  );
}
