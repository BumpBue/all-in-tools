import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import HabitTracker from '@/tools/habit-tracker';

const SLUG = 'habit-tracker';

export const generateMetadata = () => buildToolMetadata(SLUG);

// Habits live on the device, so there is no query state to read.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <HabitTracker />
    </ToolPage>
  );
}
