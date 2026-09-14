'use client';

import { Check, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useT } from '@/hooks/use-t';

const ICON_SIZE = 16;

export function ShareLinkButton() {
  const t = useT();
  const [state, copy] = useCopyToClipboard();
  const copied = state === 'copied';

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void copy(window.location.href)}
      aria-label={copied ? t.tool.linkCopied : t.tool.share}
    >
      {copied ? (
        <Check size={ICON_SIZE} className="text-success" aria-hidden />
      ) : (
        <Link2 size={ICON_SIZE} aria-hidden />
      )}
      <span className="hidden sm:inline">
        {copied ? t.tool.linkCopied : t.tool.share}
      </span>
    </Button>
  );
}
