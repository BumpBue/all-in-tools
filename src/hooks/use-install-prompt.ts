'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const STANDALONE_QUERY = '(display-mode: standalone)';
const IOS_PATTERN = /iphone|ipad|ipod/i;

/**
 * The event Chromium fires instead of showing its own install banner. It is not
 * in the DOM lib because no standard defines it, so the shape this code relies
 * on is spelled out rather than cast to any.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BEFORE_INSTALL_PROMPT = 'beforeinstallprompt';
const APP_INSTALLED = 'appinstalled';

function subscribeStandalone(listener: () => void): () => void {
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener('change', listener);

  return () => media.removeEventListener('change', listener);
}

/** True once the app is running from a home screen rather than a browser tab. */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribeStandalone,
    () => window.matchMedia(STANDALONE_QUERY).matches,
    () => false,
  );
}

export function useIsIos(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => IOS_PATTERN.test(navigator.userAgent),
    () => false,
  );
}

export interface InstallPrompt {
  /** Null until the browser says the app is installable. */
  install: (() => Promise<boolean>) | null;
}

export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Without this the browser shows its own banner and never hands the event
      // over, so there would be nothing left to trigger from a button.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setDeferred(null);
    }

    window.addEventListener(BEFORE_INSTALL_PROMPT, onBeforeInstallPrompt);
    window.addEventListener(APP_INSTALLED, onInstalled);

    return () => {
      window.removeEventListener(BEFORE_INSTALL_PROMPT, onBeforeInstallPrompt);
      window.removeEventListener(APP_INSTALLED, onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;

    // The event is single use; a second prompt() on it throws.
    setDeferred(null);

    return outcome === 'accepted';
  }, [deferred]);

  return { install: deferred ? install : null };
}
