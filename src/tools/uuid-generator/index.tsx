'use client';

import { RefreshCw } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, Input, Label, Select } from '@/components/ui/field';
import { useLocale, useT } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import {
  ID_KINDS,
  MAX_COUNT,
  MAX_CUSTOM_LENGTH,
  MIN_COUNT,
  MIN_CUSTOM_LENGTH,
  NANOID_ALPHABET,
  NANOID_DEFAULT_LENGTH,
  clampCount,
  clampLength,
  extractV7Time,
  generate,
  isValidAlphabet,
  type IdKind,
} from '@/tools/uuid-generator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_KIND_KEY = 'k';
const URL_COUNT_KEY = 'n';
const URL_LENGTH_KEY = 'len';
const URL_UPPERCASE_KEY = 'uc';
const URL_HYPHENS_KEY = 'hy';
const URL_ALPHABET_KEY = 'ab';
const URL_DEBOUNCE_MS = 400;

const ICON_SIZE = 16;
const ON = '1';
const OFF = '0';
const DEFAULT_COUNT = 5;
const DATE_LOCALES = { th: 'th-TH', en: 'en-GB' } as const;

function readKind(raw: string | undefined): IdKind {
  return ID_KINDS.includes(raw as IdKind) ? (raw as IdKind) : 'uuid-v4';
}

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === ON) return true;
  if (raw === OFF) return false;
  return fallback;
}

export default function UuidGenerator({ searchParams }: ToolComponentProps) {
  const t = useT().uuidGenerator;
  const locale = useLocale();

  // Options travel in the link; the generated values do not. A link that
  // reproduced somebody else's ids would be worse than useless.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_KIND_KEY]: readKind(searchParams[URL_KIND_KEY]) as string,
      [URL_COUNT_KEY]: String(
        clampCount(Number(searchParams[URL_COUNT_KEY] ?? DEFAULT_COUNT)),
      ),
      [URL_LENGTH_KEY]: String(
        clampLength(Number(searchParams[URL_LENGTH_KEY] ?? NANOID_DEFAULT_LENGTH)),
      ),
      [URL_UPPERCASE_KEY]: readFlag(searchParams[URL_UPPERCASE_KEY], false) ? ON : OFF,
      [URL_HYPHENS_KEY]: readFlag(searchParams[URL_HYPHENS_KEY], true) ? ON : OFF,
      [URL_ALPHABET_KEY]: searchParams[URL_ALPHABET_KEY] ?? NANOID_ALPHABET,
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const kind = readKind(urlState[URL_KIND_KEY]);
  const count = clampCount(Number(urlState[URL_COUNT_KEY]));
  const length = clampLength(Number(urlState[URL_LENGTH_KEY]));
  const uppercase = urlState[URL_UPPERCASE_KEY] === ON;
  const hyphens = urlState[URL_HYPHENS_KEY] === ON;
  const alphabet = urlState[URL_ALPHABET_KEY];

  const [seed, setSeed] = useState(0);

  const kindId = useId();
  const countId = useId();
  const lengthId = useId();
  const alphabetId = useId();

  const alphabetOk = kind !== 'custom' || isValidAlphabet(alphabet);

  const ids = useMemo(
    () =>
      alphabetOk
        ? generate({ kind, count, uppercase, hyphens, alphabet, length })
        : [],
    // seed is the regenerate button: same options, new values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alphabet, alphabetOk, count, hyphens, kind, length, seed, uppercase],
  );

  const hints: Record<IdKind, string> = {
    'uuid-v4': t.kindHintV4,
    'uuid-v7': t.kindHintV7,
    nanoid: t.kindHintNanoid,
    custom: t.kindHintCustom,
  };

  const labels: Record<IdKind, string> = {
    'uuid-v4': t.kindV4,
    'uuid-v7': t.kindV7,
    nanoid: t.kindNanoid,
    custom: t.kindCustom,
  };

  const showsLength = kind === 'nanoid' || kind === 'custom';
  const showsFormat = kind === 'uuid-v4' || kind === 'uuid-v7';

  const formatTime = (value: number) =>
    new Intl.DateTimeFormat(DATE_LOCALES[locale], {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(value);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={kindId}>{t.kind}</Label>
          <Select
            id={kindId}
            value={kind}
            onChange={(event) => setUrlState({ [URL_KIND_KEY]: event.target.value })}
          >
            {ID_KINDS.map((option) => (
              <option key={option} value={option}>
                {labels[option]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={countId}>{t.count}</Label>
          <Input
            id={countId}
            type="number"
            inputMode="numeric"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            onChange={(event) =>
              setUrlState({
                [URL_COUNT_KEY]: String(clampCount(Number(event.target.value))),
              })
            }
          />
        </div>

        {showsLength ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={lengthId}>{t.length}</Label>
            <Input
              id={lengthId}
              type="number"
              inputMode="numeric"
              min={MIN_CUSTOM_LENGTH}
              max={MAX_CUSTOM_LENGTH}
              value={length}
              onChange={(event) =>
                setUrlState({
                  [URL_LENGTH_KEY]: String(clampLength(Number(event.target.value))),
                })
              }
            />
          </div>
        ) : null}

        {kind === 'custom' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={alphabetId}>{t.alphabet}</Label>
            <Input
              id={alphabetId}
              value={alphabet}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={alphabetOk ? undefined : true}
              onChange={(event) =>
                setUrlState({ [URL_ALPHABET_KEY]: event.target.value })
              }
              className="font-mono text-sm"
            />
            {alphabetOk ? null : <FieldError>{t.alphabetInvalid}</FieldError>}
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted">{hints[kind]}</p>

      {showsFormat ? (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(event) =>
                setUrlState({ [URL_UPPERCASE_KEY]: event.target.checked ? ON : OFF })
              }
            />
            {t.uppercase}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hyphens}
              onChange={(event) =>
                setUrlState({ [URL_HYPHENS_KEY]: event.target.checked ? ON : OFF })
              }
            />
            {t.hyphens}
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setSeed((previous) => previous + 1)}>
          <RefreshCw size={ICON_SIZE} aria-hidden />
          {t.regenerate}
        </Button>
        <CopyButton
          value={ids.join('\n')}
          label={t.copyAll}
          showLabel
          variant="secondary"
          size="sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t.result}</Label>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {ids.map((id, index) => {
            const embedded = kind === 'uuid-v7' ? extractV7Time(id) : null;

            return (
              <li
                key={`${seed}-${index}`}
                className="flex flex-wrap items-center gap-2 px-3 py-2"
              >
                <code className="min-w-0 flex-1 break-all font-mono text-sm">{id}</code>
                {embedded !== null ? (
                  <span className="text-xs text-muted">
                    {t.timestamp}: {formatTime(embedded)}
                  </span>
                ) : null}
                <CopyButton value={id} variant="ghost" size="icon" />
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-sm text-muted">{t.secure}</p>
    </div>
  );
}
