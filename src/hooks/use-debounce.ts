'use client';

import { useEffect, useState } from 'react';

import { INPUT_DEBOUNCE_MS } from '@/config/site';

export function useDebounce<T>(value: T, delayMs: number = INPUT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
