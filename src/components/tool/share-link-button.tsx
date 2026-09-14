'use client';

import { Check, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const ICON_SIZE = 16;

export function ShareLinkButton({
  shareLabel,
  copiedLabel,
}: {
  shareLabel: string;
  copiedLabel: string;
}) {
  const [state, copy] = useCopyToClipboard();
  const copied = state === 'copied';
  const label = copied ? copiedLabel : shareLabel;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void copy(window.location.href)}
      aria-label={label}
    >
      {copied ? (
        <Check size={ICON_SIZE} className="text-success" aria-hidden />
      ) : (
        <Link2 size={ICON_SIZE} aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
