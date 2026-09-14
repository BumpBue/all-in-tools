'use client';

import { Search } from 'lucide-react';
import { useRef } from 'react';

import { useCommandPalette } from '@/components/command-palette/provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

const ICON_SIZE = 18;
const QUERY_PARAM = 'q';

// A real GET form so search still works with no JavaScript; the client hijacks
// the submit and opens the palette instead.
export function SearchForm({
  defaultValue = '',
  placeholder,
  submitLabel,
  className,
}: {
  defaultValue?: string;
  placeholder: string;
  submitLabel: string;
  className?: string;
}) {
  const { open } = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      method="get"
      action="/search"
      role="search"
      className={className ?? 'flex w-full max-w-xl items-center gap-2'}
      onSubmit={(event) => {
        event.preventDefault();
        open(inputRef.current?.value ?? '');
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          size={ICON_SIZE}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          ref={inputRef}
          type="search"
          name={QUERY_PARAM}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className="pl-10"
        />
      </div>
      <Button type="submit" variant="secondary">
        {submitLabel}
      </Button>
    </form>
  );
}
