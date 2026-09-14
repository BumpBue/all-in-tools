import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-control border bg-surface px-3 text-foreground ' +
  'placeholder:text-muted transition-colors disabled:opacity-50 ' +
  'aria-invalid:border-danger';

const CONTROL_IDLE = 'border-border hover:border-border-strong';

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, CONTROL_IDLE, 'h-10', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(CONTROL, CONTROL_IDLE, 'min-h-28 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(CONTROL, CONTROL_IDLE, 'h-10 cursor-pointer pr-8', className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-muted">{children}</p>;
}
