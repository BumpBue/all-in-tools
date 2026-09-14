import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-colors select-none disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary:
    'bg-surface text-foreground border border-border hover:bg-surface-subtle hover:border-border-strong',
  ghost: 'text-muted hover:bg-surface-subtle hover:text-foreground',
  danger: 'bg-danger text-on-danger hover:opacity-90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'size-8',
};

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

// Shared with <Link>, which cannot be a <button> but should look like one.
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonStyle = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyle {}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}
