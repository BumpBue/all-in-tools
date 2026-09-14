'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getItem,
  setItem,
  type StorageFailure,
  type StorageWriteResult,
} from '@/lib/storage';

export interface LocalStorageStatus {
  isLoaded: boolean;
  error: { reason: StorageFailure; message: string } | null;
}

export interface UseLocalStorageOptions {
  debounceMs?: number;
}

type Updater<T> = T | ((previous: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = {},
): [T, (value: Updater<T>) => void, LocalStorageStatus] {
  const { debounceMs = 0 } = options;

  // The first render must match the server output, so the stored value is only
  // pulled in after mount.
  const [value, setValue] = useState<T>(initialValue);
  const [status, setStatus] = useState<LocalStorageStatus>({
    isLoaded: false,
    error: null,
  });

  const initialValueRef = useRef(initialValue);
  const valueRef = useRef(initialValue);
  const pendingRef = useRef<{ value: T } | null>(null);
  const timerRef = useRef<number | null>(null);

  const applyWriteResult = useCallback((result: StorageWriteResult) => {
    setStatus((previous) => ({
      isLoaded: previous.isLoaded,
      error: result.ok ? null : { reason: result.reason, message: result.message },
    }));
  }, []);

  const commit = useCallback(
    (next: T) => {
      valueRef.current = next;
      setValue(next);
    },
    [],
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingRef.current;
    if (!pending) return;

    pendingRef.current = null;
    applyWriteResult(setItem(key, pending.value));
  }, [applyWriteResult, key]);

  useEffect(() => {
    commit(getItem<T>(key, initialValueRef.current));
    setStatus({ isLoaded: true, error: null });
  }, [commit, key]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      commit(getItem<T>(key, initialValueRef.current));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [commit, key]);

  // A debounced write would otherwise be lost when the tab closes or is hidden.
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const update = useCallback(
    (next: Updater<T>) => {
      const resolved =
        typeof next === 'function'
          ? (next as (previous: T) => T)(valueRef.current)
          : next;

      commit(resolved);

      if (debounceMs <= 0) {
        applyWriteResult(setItem(key, resolved));
        return;
      }

      pendingRef.current = { value: resolved };
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) applyWriteResult(setItem(key, pending.value));
      }, debounceMs);
    },
    [applyWriteResult, commit, debounceMs, key],
  );

  return [value, update, status];
}
