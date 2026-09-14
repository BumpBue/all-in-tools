'use client';

import { useEffect } from 'react';

import { usePreferences } from '@/hooks/use-preferences';

export function RecordRecent({ slug }: { slug: string }) {
  const { markRecent } = usePreferences();

  useEffect(() => {
    markRecent(slug);
  }, [markRecent, slug]);

  return null;
}
