'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DEBOUNCE_MS = 400;

export interface UseUrlStateOptions {
  debounceMs?: number;
  /**
   * Values longer than this are dropped from the URL rather than written. A
   * shared link is worth having; a link carrying an encoded file is not.
   */
  maxValueLength?: number;
}

/**
 * Mirrors a tool's state into the query string so the share button copies a
 * working link.
 *
 * `initial` comes from the page's searchParams on the server, not from
 * window.location, so the first client render matches the server output.
 *
 * Writes go through history.replaceState rather than router.replace, which
 * would fire an RSC request on every keystroke.
 */
export function useUrlState<T extends Record<string, string>>(
  initial: T,
  options: UseUrlStateOptions = {},
): [T, (next: Partial<T>) => void] {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, maxValueLength = Infinity } = options;

  const [state, setState] = useState<T>(initial);
  const stateRef = useRef<T>(initial);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const writeToUrl = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;

    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(stateRef.current)) {
      if (value.length === 0 || value.length > maxValueLength) params.delete(key);
      else params.set(key, value);
    }

    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  }, [maxValueLength]);

  // Without this a share right after the last keystroke would copy a stale URL.
  useEffect(() => {
    window.addEventListener('pagehide', writeToUrl);
    return () => {
      window.removeEventListener('pagehide', writeToUrl);
      writeToUrl();
    };
  }, [writeToUrl]);

  const update = useCallback(
    (next: Partial<T>) => {
      const merged = { ...stateRef.current, ...next };
      stateRef.current = merged;
      setState(merged);

      pendingRef.current = true;
      if (debounceMs <= 0) {
        writeToUrl();
        return;
      }

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        writeToUrl();
      }, debounceMs);
    },
    [debounceMs, writeToUrl],
  );

  return [state, update];
}
