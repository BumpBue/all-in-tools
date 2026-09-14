'use client';

import { useId, useMemo, useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Select } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useT } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import type { ToolComponentProps } from '@/tools/types';
import {
  MAX_BASE,
  MIN_BASE,
  STANDARD_BASES,
  bitLength,
  describeWidths,
  formatBigInt,
  isValidBase,
  parseBigInt,
  toBitGroups,
  type ParseFailure,
} from '@/tools/base-converter/logic';

const URL_VALUE_KEY = 'v';
const URL_BASE_KEY = 'b';
const URL_CUSTOM_BASE_KEY = 'cb';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_BASE = 10;
const DEFAULT_CUSTOM_BASE = 36;
const EXAMPLES = ['255', '-1024', '18446744073709551616'];

const BASE_LABEL_KEYS = {
  2: 'base2',
  8: 'base8',
  10: 'base10',
  16: 'base16',
} as const;

const ALL_BASES = Array.from(
  { length: MAX_BASE - MIN_BASE + 1 },
  (_, index) => MIN_BASE + index,
);

function readBase(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return isValidBase(parsed) ? parsed : fallback;
}

export default function BaseConverter({ searchParams }: ToolComponentProps) {
  const messages = useT();
  const t = messages.baseConverter;

  const initialBase = readBase(searchParams[URL_BASE_KEY], DEFAULT_BASE);
  const initialText = searchParams[URL_VALUE_KEY] ?? '';
  // Without an explicit cb, a shared link that was typed in a non-standard base
  // should reopen on that base rather than jumping back to the default.
  const initialCustomBase = readBase(
    searchParams[URL_CUSTOM_BASE_KEY],
    (STANDARD_BASES as readonly number[]).includes(initialBase)
      ? DEFAULT_CUSTOM_BASE
      : initialBase,
  );

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_VALUE_KEY]: initialText,
      [URL_BASE_KEY]: String(initialBase),
      [URL_CUSTOM_BASE_KEY]: String(initialCustomBase),
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const activeBase = readBase(urlState[URL_BASE_KEY], DEFAULT_BASE);
  const customBase = readBase(urlState[URL_CUSTOM_BASE_KEY], DEFAULT_CUSTOM_BASE);
  const text = urlState[URL_VALUE_KEY];

  const [value, setValue] = useState<bigint | null>(() => {
    const result = parseBigInt(initialText, initialBase);
    return result.ok ? result.value : null;
  });

  const parsed = useMemo(() => parseBigInt(text, activeBase), [activeBase, text]);
  const showError = text.trim().length > 0 && !parsed.ok;

  const errorId = useId();
  const fieldPrefix = useId();

  function errorMessage(failure: ParseFailure): string {
    switch (failure.code) {
      case 'sign-only':
        return t.errorSignOnly;
      case 'invalid-base':
        return t.errorInvalidBase;
      case 'invalid-digit':
        return format(t.errorInvalidDigit, {
          character: failure.character ?? '',
          base: failure.base,
        });
      default:
        return t.errorEmpty;
    }
  }

  function edit(base: number, nextText: string) {
    setUrlState({ [URL_VALUE_KEY]: nextText, [URL_BASE_KEY]: String(base) });

    const result = parseBigInt(nextText, base);
    if (result.ok) setValue(result.value);
  }

  // Keep the number and restate it in the new base rather than reinterpreting
  // the digits, which would silently change the value.
  function changeCustomBase(nextBase: number) {
    const restate =
      activeBase === customBase && value !== null
        ? {
            [URL_VALUE_KEY]: formatBigInt(value, nextBase),
            [URL_BASE_KEY]: String(nextBase),
          }
        : {};

    setUrlState({ [URL_CUSTOM_BASE_KEY]: String(nextBase), ...restate });
  }

  function clearAll() {
    setUrlState({ [URL_VALUE_KEY]: '', [URL_BASE_KEY]: String(DEFAULT_BASE) });
    setValue(null);
  }

  function textFor(base: number): string {
    if (base === activeBase) return text;
    return value === null ? '' : formatBigInt(value, base);
  }

  function renderField(base: number, label: string, key: string) {
    const id = `${fieldPrefix}-${key}`;
    const active = base === activeBase;
    const invalid = active && showError;
    const fieldText = textFor(base);

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={fieldText}
            onChange={(event) => edit(base, event.target.value)}
            inputMode="text"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className="font-mono"
          />
          <CopyButton value={fieldText} variant="secondary" size="icon" />
        </div>
        {invalid && !parsed.ok ? (
          <p id={errorId}>
            <FieldError>{errorMessage(parsed)}</FieldError>
          </p>
        ) : null}
      </div>
    );
  }

  const widths = value === null ? [] : describeWidths(value);
  const fitsSomewhere = widths.some((entry) => entry.signed || entry.unsigned);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted">{t.hint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {STANDARD_BASES.map((base) =>
          <div key={base}>{renderField(base, t[BASE_LABEL_KEYS[base]], String(base))}</div>,
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-subtle p-4 sm:flex-row sm:items-end">
        <div className="flex w-full flex-col gap-1.5 sm:w-44">
          <Label htmlFor={`${fieldPrefix}-custom-base`}>{t.customBaseLabel}</Label>
          <Select
            id={`${fieldPrefix}-custom-base`}
            value={customBase}
            onChange={(event) => changeCustomBase(Number(event.target.value))}
          >
            {ALL_BASES.map((base) => (
              <option key={base} value={base}>
                {format(t.baseOption, { base })}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          {renderField(
            customBase,
            format(t.customBase, { base: customBase }),
            'custom',
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.bits}</h2>
        {value === null ? (
          <p className="text-sm text-muted">{t.errorEmpty}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code className="block min-w-0 flex-1 overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm">
                {toBitGroups(value)}
              </code>
              <CopyButton
                value={toBitGroups(value)}
                variant="secondary"
                size="icon"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                {format(t.bitsUsed, { count: bitLength(value) })}
              </Badge>

              {fitsSomewhere ? (
                <>
                  <span className="text-sm text-muted">{t.widthFits}</span>
                  {widths
                    .filter((entry) => entry.signed || entry.unsigned)
                    .map((entry) => (
                      <Badge key={entry.width} tone="accent">
                        {entry.width}-bit{' '}
                        {entry.signed && entry.unsigned
                          ? `${t.signed} / ${t.unsigned}`
                          : entry.signed
                            ? t.signed
                            : t.unsigned}
                      </Badge>
                    ))}
                </>
              ) : (
                <span className="text-sm text-danger">{t.overflowAll}</span>
              )}
            </div>
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
        <span className="text-sm text-muted">{t.examples}</span>
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            variant="ghost"
            size="sm"
            className="font-mono"
            onClick={() => edit(DEFAULT_BASE, example)}
          >
            {example}
          </Button>
        ))}
      </div>
    </div>
  );
}
