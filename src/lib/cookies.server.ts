import { cookies } from 'next/headers';

import { COOKIE_KEYS, MAX_FAVORITES, MAX_RECENT } from '@/config/storage-keys';
import {
  normalizeLocale,
  normalizeTheme,
  parseSlugList,
  type Preferences,
} from '@/lib/cookies';

// Kept apart from cookies.ts because importing next/headers anywhere in a
// module makes that module unusable from a Client Component.
export async function readPreferences(): Promise<Preferences> {
  const jar = await cookies();

  return {
    theme: normalizeTheme(jar.get(COOKIE_KEYS.theme)?.value),
    locale: normalizeLocale(jar.get(COOKIE_KEYS.lang)?.value),
    favorites: parseSlugList(jar.get(COOKIE_KEYS.favorites)?.value, MAX_FAVORITES),
    recent: parseSlugList(jar.get(COOKIE_KEYS.recent)?.value, MAX_RECENT),
  };
}
