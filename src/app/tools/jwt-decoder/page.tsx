import { ToolPage, buildToolMetadata } from '@/app/tools/_shared/tool-page';
import JwtDecoder from '@/tools/jwt-decoder';

const SLUG = 'jwt-decoder';

export const generateMetadata = () => buildToolMetadata(SLUG);

// Deliberately reads no searchParams: a token and the secret that checks it
// have no business in a URL, so this tool takes none.
export default async function Page() {
  return (
    <ToolPage slug={SLUG}>
      <JwtDecoder />
    </ToolPage>
  );
}
