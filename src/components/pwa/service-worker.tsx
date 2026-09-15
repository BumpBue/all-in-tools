'use client';

import { useEffect } from 'react';

const SCRIPT_URL = '/sw.js';

// Registration waits for load: the service worker's install step fetches the
// offline page and the icons, and doing that while the first page is still
// fetching its own chunks would compete with it.
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function register() {
      void navigator.serviceWorker.register(SCRIPT_URL, { scope: '/' });
    }

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
