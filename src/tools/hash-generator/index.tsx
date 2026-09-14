'use client';

import { Check, FileUp, ShieldOff, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge, Skeleton } from '@/components/ui/card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { formatBytes } from '@/lib/utils';
import {
  HASH_ALGORITHMS,
  MAX_FILE_BYTES,
  compareDigest,
  digestAll,
  encodeText,
  isWeak,
  readFileBytes,
  whichAlgorithmByLength,
  type HashAlgorithm,
} from '@/tools/hash-generator/logic';
import { messages } from '@/tools/hash-generator/i18n';
import type { ToolComponentProps } from '@/tools/types';

const URL_SOURCE_KEY = 'src';
const URL_DEBOUNCE_MS = 400;
const ICON_SIZE = 16;
const FULL_PERCENT = 100;

type Source = 'text' | 'file';

type Digests = Record<HashAlgorithm, string> | null;

function readSource(raw: string | undefined): Source {
  return raw === 'file' ? 'file' : 'text';
}

export default function HashGenerator({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // Only the chosen source travels in the link. What is being hashed is often a
  // password or a private file and has no business in a URL.
  const [urlState, setUrlState] = useUrlState(
    { [URL_SOURCE_KEY]: readSource(searchParams[URL_SOURCE_KEY]) as string },
    { debounceMs: URL_DEBOUNCE_MS },
  );
  const source = readSource(urlState[URL_SOURCE_KEY]);

  const [text, setText] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [computed, setComputed] = useState<{ key: string; values: Digests } | null>(
    null,
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [expected, setExpected] = useState('');
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const expectedId = useId();

  // Keyed by what is being hashed rather than by the bytes themselves: a fresh
  // Uint8Array every render would restart the effect forever. "Working" is then
  // derived from the key not yet matching, so the effect body sets no state.
  const inputKey =
    source === 'text' ? `text:${text}` : bytes ? `file:${fileKey}` : null;

  const digests: Digests = computed?.key === inputKey ? computed.values : null;
  const working = inputKey !== null && digests === null;

  useEffect(() => {
    if (inputKey === null) return;

    const input = source === 'text' ? encodeText(text) : bytes;
    if (!input) return;

    let cancelled = false;
    void digestAll(input).then((values) => {
      if (!cancelled) setComputed({ key: inputKey, values });
    });

    return () => {
      cancelled = true;
    };
  }, [bytes, inputKey, source, text]);

  async function acceptFile(file: File | undefined) {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFileNote(null);
      setFileError(format(t.fileTooLarge, { limit: formatBytes(MAX_FILE_BYTES) }));
      return;
    }

    setFileError(null);
    setFileNote(format(t.fileLoaded, { name: file.name, size: formatBytes(file.size) }));
    setProgress(0);

    const loaded = await readFileBytes(file, (done, total) => {
      setProgress(total === 0 ? FULL_PERCENT : Math.round((done / total) * FULL_PERCENT));
    });

    setProgress(null);
    setBytes(loaded);
    setFileKey((previous) => previous + 1);
    setUrlState({ [URL_SOURCE_KEY]: 'file' });
  }

  function clearAll() {
    setText('');
    setBytes(null);
    setComputed(null);
    setExpected('');
    setFileNote(null);
    setFileError(null);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const matched = digests
    ? HASH_ALGORITHMS.find(
        (algorithm) => compareDigest(expected, digests[algorithm]) === 'match',
      )
    : undefined;

  const guess = whichAlgorithmByLength(expected);
  const hasExpected = expected.trim().length > 0;

  const sourceOptions: ReadonlyArray<ToggleOption<Source>> = [
    { value: 'text', label: t.sourceText },
    { value: 'file', label: t.sourceFile },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t.source}</span>
        <Toggle
          options={sourceOptions}
          value={source}
          onChange={(next) => setUrlState({ [URL_SOURCE_KEY]: next })}
          label={t.source}
        />
      </div>

      {source === 'text' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={textId}>{t.input}</Label>
          <Textarea
            id={textId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-h-32"
          />
          <p className="text-sm text-muted">{t.inputHint}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void acceptFile(event.dataTransfer.files[0]);
            }}
            className={
              dragging
                ? 'flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-accent bg-accent-subtle px-4 py-8 text-sm'
                : 'flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-8 text-sm text-muted transition-colors hover:border-border-strong'
            }
          >
            <FileUp size={ICON_SIZE} aria-hidden />
            {t.dropFile}
          </button>

          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            aria-label={t.dropFile}
            onChange={(event) => void acceptFile(event.target.files?.[0])}
          />

          {progress !== null ? (
            <p role="status" className="text-sm text-muted">
              {format(t.reading, { percent: progress })}
            </p>
          ) : null}
          {fileNote ? <p className="text-sm text-muted">{fileNote}</p> : null}
          <FieldError>{fileError ?? undefined}</FieldError>
          <p className="text-sm text-muted">{t.privacy}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {HASH_ALGORITHMS.map((algorithm) => {
          const value = digests?.[algorithm] ?? '';
          const isMatch = matched === algorithm;

          return (
            <div key={algorithm} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium">{algorithm}</span>
                {isWeak(algorithm) ? (
                  <Badge tone="muted">
                    <ShieldOff size={12} aria-hidden />
                    {t.weak}
                  </Badge>
                ) : null}
                {isMatch ? (
                  <Badge tone="success">
                    <Check size={12} aria-hidden />
                    {format(t.compareMatch, { algorithm })}
                  </Badge>
                ) : null}
                <CopyButton
                  value={value}
                  variant="secondary"
                  size="icon"
                  className="ml-auto"
                />
              </div>

              {working && !value ? (
                <Skeleton className="h-9" />
              ) : (
                <p
                  className={
                    isMatch
                      ? 'min-w-0 break-all rounded-control border border-success bg-surface px-3 py-2 font-mono text-sm'
                      : 'min-w-0 break-all rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm'
                  }
                >
                  {value}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted">{t.weakNote}</p>

      <div className="flex flex-col gap-1.5 border-t border-border pt-6">
        <Label htmlFor={expectedId}>{t.compare}</Label>
        <Input
          id={expectedId}
          value={expected}
          placeholder={t.comparePlaceholder}
          onChange={(event) => setExpected(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-sm"
        />
        {hasExpected && !matched ? (
          <p role="status" className="flex items-center gap-1.5 text-sm text-danger">
            <X size={ICON_SIZE} aria-hidden />
            {t.compareMismatch}
            {guess ? ` — ${format(t.compareGuess, { algorithm: guess })}` : ''}
          </p>
        ) : null}
      </div>

      <div>
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
