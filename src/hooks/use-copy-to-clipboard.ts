'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { COPY_FEEDBACK_MS } from '@/config/site';

export type CopyState = 'idle' | 'copied' | 'failed';

function copyViaSelection(text: string): boolean {
  // navigator.clipboard is undefined outside secure contexts, which includes
  // plain-http LAN testing.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);

  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

export function useCopyToClipboard(): [CopyState, (text: string) => Promise<void>] {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(async (text: string) => {
    let succeeded = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }

    if (!succeeded) succeeded = copyViaSelection(text);

    setState(succeeded ? 'copied' : 'failed');

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setState('idle');
    }, COPY_FEEDBACK_MS);
  }, []);

  return [state, copy];
}
