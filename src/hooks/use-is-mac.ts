'use client';

import { useSyncExternalStore } from 'react';

const MAC_PATTERN = /mac|iphone|ipad|ipod/i;

function subscribe(): () => void {
  return () => {};
}

// useSyncExternalStore rather than an effect: the server has no user agent, so
// the shortcut hint renders as Ctrl until the client corrects it, with no
// hydration mismatch and no setState in an effect.
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => MAC_PATTERN.test(navigator.userAgent),
    () => false,
  );
}
