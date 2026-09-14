import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import MarkdownPreview from '@/tools/markdown-preview';

const SLUG = 'markdown-preview';

export const generateMetadata = () => buildToolMetadata(SLUG);

// The draft is autosaved on the device rather than carried in the link, so
// this route reads no query string.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <MarkdownPreview />
    </ToolPage>
  );
}
