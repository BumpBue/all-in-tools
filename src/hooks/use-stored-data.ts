'use client';

import { useSyncExternalStore } from 'react';

import { summarizeStorage, type StorageSummary } from '@/lib/storage';

const EMPTY: StorageSummary = { tools: [], totalBytes: 0 };

const listeners = new Set<() => void>();
let cached: StorageSummary | null = null;

/** Call after any write so every reader recomputes. */
export function invalidateStoredData(): void {
  cached = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', invalidateStoredData);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', invalidateStoredData);
    }
  };
}

// The snapshot has to be referentially stable or useSyncExternalStore loops,
// hence the cache rather than summarizing on every call.
function getSnapshot(): StorageSummary {
  cached ??= summarizeStorage();
  return cached;
}

function getServerSnapshot(): StorageSummary {
  return EMPTY;
}

export function useStoredData(): StorageSummary {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
