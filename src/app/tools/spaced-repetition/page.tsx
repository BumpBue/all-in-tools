import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import SpacedRepetition from '@/tools/spaced-repetition';

const SLUG = 'spaced-repetition';

export const generateMetadata = () => buildToolMetadata(SLUG);

// Reads the same decks the flashcards page writes, from the device.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <SpacedRepetition />
    </ToolPage>
  );
}
