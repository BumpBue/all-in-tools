import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import Flashcards from '@/tools/flashcards';

const SLUG = 'flashcards';

export const generateMetadata = () => buildToolMetadata(SLUG);

// Decks live on the device; nothing here belongs in a link.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <Flashcards />
    </ToolPage>
  );
}
