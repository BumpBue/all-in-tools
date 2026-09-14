'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<ToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-control border border-border bg-surface-subtle p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-[0.4rem] text-sm transition-colors',
              option.icon ? 'w-8' : 'px-2.5',
              selected
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted hover:text-foreground',
            )}
          >
            {option.icon}
            <span className={option.icon ? 'sr-only' : undefined}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
