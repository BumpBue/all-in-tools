import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import ImageResizer from '@/tools/image-resizer';

const SLUG = 'image-resizer';

export const generateMetadata = () => buildToolMetadata(SLUG);

// No query state: the files are the reader's own and never leave the device,
// so there is nothing here worth putting in a link.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <ImageResizer />
    </ToolPage>
  );
}
