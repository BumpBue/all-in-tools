// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecordRecent } from '@/components/tool/record-recent';
import { COOKIE_KEYS } from '@/config/storage-keys';
import { PreferencesProvider } from '@/hooks/use-preferences';
import type { Preferences } from '@/lib/cookies';
import { render } from '@/test/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'th',
  favorites: [],
  recent: [],
};

function recentCookie(): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_KEYS.recent}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : '';
}

afterEach(() => {
  document.cookie = `${COOKIE_KEYS.recent}=; Max-Age=0; Path=/`;
});

describe('RecordRecent', () => {
  it('writes the visited slug to the recent cookie', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <RecordRecent slug="base-converter" />
      </PreferencesProvider>,
    );

    expect(recentCookie()).toBe('base-converter');
    view.unmount();
  });

  it('moves an already recorded slug to the front', () => {
    const view = render(
      <PreferencesProvider
        initial={{ ...BASE_PREFERENCES, recent: ['base64', 'base-converter'] }}
      >
        <RecordRecent slug="base-converter" />
      </PreferencesProvider>,
    );

    expect(recentCookie()).toBe('base-converter,base64');
    view.unmount();
  });

  it('writes once, without re-running when the recent list changes', () => {
    const setCookie = vi.spyOn(document, 'cookie', 'set');

    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <RecordRecent slug="base-converter" />
      </PreferencesProvider>,
    );

    expect(setCookie).toHaveBeenCalledTimes(1);
    view.unmount();
    setCookie.mockRestore();
  });

  it('does nothing when the slug is already the newest entry', () => {
    const setCookie = vi.spyOn(document, 'cookie', 'set');

    const view = render(
      <PreferencesProvider
        initial={{ ...BASE_PREFERENCES, recent: ['base-converter', 'base64'] }}
      >
        <RecordRecent slug="base-converter" />
      </PreferencesProvider>,
    );

    expect(setCookie).not.toHaveBeenCalled();
    view.unmount();
    setCookie.mockRestore();
  });
});
