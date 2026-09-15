'use client';

import { useState } from 'react';
import { Download, Share } from 'lucide-react';

import {
  useInstallPrompt,
  useIsIos,
  useIsStandalone,
} from '@/hooks/use-install-prompt';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useT } from '@/hooks/use-t';

const ICON_SIZE = 16;
const DISMISSED_KEY = 'toolbox:install-dismissed';

export function InstallButton() {
  const t = useT();
  const { install } = useInstallPrompt();
  const isStandalone = useIsStandalone();
  const isIos = useIsIos();

  const [dismissed, setDismissed] = useLocalStorage(DISMISSED_KEY, false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  // Already installed, or turned down before: nothing to offer.
  if (isStandalone || dismissed) return null;

  // Safari on iOS never fires the install event, so the only thing on offer
  // there is the instructions.
  if (isIos) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowIosSteps((open) => !open)}
          aria-expanded={showIosSteps}
          className="flex items-center gap-2 self-start rounded-control border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-subtle"
        >
          <Share size={ICON_SIZE} aria-hidden />
          {t.install.action}
        </button>

        {showIosSteps && (
          <div className="flex flex-col gap-1 text-sm text-muted">
            <p className="font-medium text-foreground">{t.install.iosTitle}</p>
            <p>{t.install.iosSteps}</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="self-start rounded underline underline-offset-2"
            >
              {t.install.dismiss}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!install) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void install()}
          className="flex items-center gap-2 rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          <Download size={ICON_SIZE} aria-hidden />
          {t.install.action}
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded px-2 py-1.5 text-sm text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {t.install.dismiss}
        </button>
      </div>

      <p className="text-sm text-muted">{t.install.hint}</p>
    </div>
  );
}
