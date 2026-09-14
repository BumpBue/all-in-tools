'use client';

import { useEffect, useRef } from 'react';

import { usePreferences } from '@/hooks/use-preferences';

export function RecordRecent({ slug }: { slug: string }) {
  const { markRecent } = usePreferences();
  const recordedRef = useRef<string | null>(null);

  // markRecent changes identity whenever the recent list does, so without this
  // guard writing the visit would re-run the effect that wrote it.
  useEffect(() => {
    if (recordedRef.current === slug) return;
    recordedRef.current = slug;
    markRecent(slug);
  }, [markRecent, slug]);

  return null;
}
