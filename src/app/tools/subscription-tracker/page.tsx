import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import SubscriptionTracker from '@/tools/subscription-tracker';

const SLUG = 'subscription-tracker';

export const generateMetadata = () => buildToolMetadata(SLUG);

// What somebody pays for and how often is their business; it stays here.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <SubscriptionTracker />
    </ToolPage>
  );
}
