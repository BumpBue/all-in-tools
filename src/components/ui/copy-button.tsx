'use client';

import { Check, Copy, X } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const ICON_SIZE = 16;

const LABELS = {
  idle: 'คัดลอก',
  copied: 'คัดลอกแล้ว',
  failed: 'คัดลอกไม่สำเร็จ',
} as const;

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  label?: string;
  showLabel?: boolean;
}

export function CopyButton({
  value,
  label,
  showLabel = false,
  variant = 'ghost',
  size = 'sm',
  ...props
}: CopyButtonProps) {
  const [state, copy] = useCopyToClipboard();

  const description = state === 'idle' ? (label ?? LABELS.idle) : LABELS[state];

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={description}
      title={description}
      disabled={value.length === 0}
      onClick={() => void copy(value)}
      {...props}
    >
      {state === 'copied' ? (
        <Check size={ICON_SIZE} className="text-success" aria-hidden />
      ) : state === 'failed' ? (
        <X size={ICON_SIZE} className="text-danger" aria-hidden />
      ) : (
        <Copy size={ICON_SIZE} aria-hidden />
      )}
      {showLabel ? description : null}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'idle' ? '' : description}
      </span>
    </Button>
  );
}
