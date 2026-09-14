'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;
const MILLISECONDS_PER_SECOND = 1000;

/** 0 on the server, where there is no "now" that would survive to the client. */
export const NO_TIME = 0;

function subscribe(listener: () => void): () => void {
  const timer = window.setInterval(listener, TICK_MS);
  return () => window.clearInterval(timer);
}

// Whole seconds so the snapshot is stable within a render; returning Date.now()
// would hand useSyncExternalStore a new value every time it looked.
function getSnapshot(): number {
  return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

function getServerSnapshot(): number {
  return NO_TIME;
}

export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
