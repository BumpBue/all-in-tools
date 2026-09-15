'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);

  return () => media.removeEventListener('change', listener);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * False on the server, which is the safe default: an animation that never
 * starts is a smaller mistake than one that runs for somebody who asked the
 * system not to.
 */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
