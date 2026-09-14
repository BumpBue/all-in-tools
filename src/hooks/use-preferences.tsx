'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { COOKIE_KEYS } from '@/config/storage-keys';
import {
  pushRecent,
  serializeSlugList,
  toggleFavorite,
  writeClientCookie,
  type Preferences,
} from '@/lib/cookies';
import { DARK_MEDIA_QUERY, applyTheme } from '@/lib/theme';
import type { Locale, Theme } from '@/types/tool';

export interface PreferencesApi extends Preferences {
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  toggleFavorite: (slug: string) => void;
  markRecent: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
}

const PreferencesContext = createContext<PreferencesApi | null>(null);

// Seeded from the server's cookie read, so the first client render matches the
// server output without an after-mount sync.
export function PreferencesProvider({
  initial,
  children,
}: {
  initial: Preferences;
  children: ReactNode;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(initial);

  useEffect(() => {
    if (preferences.theme !== 'system') return;

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preferences.theme]);

  // Server Components rendered from these cookies keep their old output until
  // the router re-fetches them.
  const persist = useCallback(
    (name: string, value: string, next: Preferences) => {
      writeClientCookie(name, value);
      setPreferences(next);
      router.refresh();
    },
    [router],
  );

  const setTheme = useCallback(
    (theme: Theme) => {
      applyTheme(theme);
      persist(COOKIE_KEYS.theme, theme, { ...preferences, theme });
    },
    [persist, preferences],
  );

  const setLocale = useCallback(
    (locale: Locale) => {
      document.documentElement.lang = locale;
      persist(COOKIE_KEYS.lang, locale, { ...preferences, locale });
    },
    [persist, preferences],
  );

  const toggle = useCallback(
    (slug: string) => {
      const favorites = toggleFavorite(preferences.favorites, slug);
      persist(COOKIE_KEYS.favorites, serializeSlugList(favorites), {
        ...preferences,
        favorites,
      });
    },
    [persist, preferences],
  );

  // No router.refresh() here: recording a visit must not re-render the page the
  // visit just landed on.
  const markRecent = useCallback(
    (slug: string) => {
      if (preferences.recent[0] === slug) return;

      const recent = pushRecent(preferences.recent, slug);
      writeClientCookie(COOKIE_KEYS.recent, serializeSlugList(recent));
      setPreferences((previous) => ({ ...previous, recent }));
    },
    [preferences.recent],
  );

  const api = useMemo<PreferencesApi>(
    () => ({
      ...preferences,
      setTheme,
      setLocale,
      toggleFavorite: toggle,
      markRecent,
      isFavorite: (slug: string) => preferences.favorites.includes(slug),
    }),
    [markRecent, preferences, setLocale, setTheme, toggle],
  );

  return (
    <PreferencesContext.Provider value={api}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesApi {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside a PreferencesProvider');
  }
  return context;
}
