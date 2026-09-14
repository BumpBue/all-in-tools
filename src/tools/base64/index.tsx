'use client';

import { Download, FileUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, Label, Textarea } from '@/components/ui/field';
import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { formatBytes } from '@/lib/utils';
import {
  MAX_FILE_BYTES,
  bytesToBase64,
  decodeText,
  encodeText,
  type Base64Variant,
} from '@/tools/base64/logic';
import { messages } from '@/tools/base64/i18n';
import type { ToolComponentProps } from '@/tools/types';

const URL_TEXT_KEY = 't';
const URL_SIDE_KEY = 's';
const URL_VARIANT_KEY = 'u';
const URL_DEBOUNCE_MS = 400;
// Long enough for a sentence to travel in a link, short enough that an encoded
// file never does.
const URL_MAX_VALUE_LENGTH = 1200;

const ICON_SIZE = 16;
const DOWNLOAD_MIME = 'application/octet-stream';
const DOWNLOAD_NAME = 'decoded.bin';

type Side = 'plain' | 'encoded';

function readSide(raw: string | undefined): Side {
  return raw === 'encoded' ? 'encoded' : 'plain';
}

function readVariant(raw: string | undefined): Base64Variant {
  return raw === 'url-safe' ? 'url-safe' : 'standard';
}

function downloadBytes(bytes: Uint8Array) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: DOWNLOAD_MIME }),
  );
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = DOWNLOAD_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Base64Tool({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_TEXT_KEY]: searchParams[URL_TEXT_KEY] ?? '',
      [URL_SIDE_KEY]: readSide(searchParams[URL_SIDE_KEY]) as string,
      [URL_VARIANT_KEY]: readVariant(searchParams[URL_VARIANT_KEY]) as string,
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const side = readSide(urlState[URL_SIDE_KEY]);
  const variant = readVariant(urlState[URL_VARIANT_KEY]);
  const typed = urlState[URL_TEXT_KEY];

  const [fileNote, setFileNote] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const plainId = useId();
  const encodedId = useId();
  const errorId = useId();

  const decoded = side === 'encoded' ? decodeText(typed) : null;

  const plain = side === 'plain' ? typed : decoded?.ok ? decoded.text : '';
  const encoded = side === 'plain' ? encodeText(typed, variant) : typed;

  const binaryBytes =
    decoded && !decoded.ok && decoded.code === 'not-text' ? decoded.bytes : undefined;

  const decodeError =
    decoded && !decoded.ok && decoded.code !== 'not-text' && typed.trim().length > 0
      ? decoded.code === 'invalid-character'
        ? format(t.errorInvalidCharacter, { character: decoded.character ?? '' })
        : t.errorInvalidLength
      : null;

  function edit(nextSide: Side, value: string) {
    setFileNote(null);
    setFileError(null);
    setUrlState({ [URL_TEXT_KEY]: value, [URL_SIDE_KEY]: nextSide });
  }

  // Re-encode rather than reinterpret, so switching variants cannot change what
  // the reader is actually looking at.
  function changeVariant(next: Base64Variant) {
    if (side === 'encoded') {
      const current = decodeText(typed);
      if (current.ok) {
        setUrlState({
          [URL_VARIANT_KEY]: next,
          [URL_TEXT_KEY]: bytesToBase64(current.bytes, next),
        });
        return;
      }
    }
    setUrlState({ [URL_VARIANT_KEY]: next });
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFileNote(null);
      setFileError(format(t.fileTooLarge, { limit: formatBytes(MAX_FILE_BYTES) }));
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    setFileError(null);
    setFileNote(
      format(t.fileLoaded, { name: file.name, size: formatBytes(file.size) }),
    );
    setUrlState({
      [URL_TEXT_KEY]: bytesToBase64(bytes, variant),
      [URL_SIDE_KEY]: 'encoded',
    });
  }

  function clearAll() {
    setFileNote(null);
    setFileError(null);
    setUrlState({ [URL_TEXT_KEY]: '', [URL_SIDE_KEY]: 'plain' });
    if (fileRef.current) fileRef.current.value = '';
  }

  const variantOptions: ReadonlyArray<ToggleOption<Base64Variant>> = [
    { value: 'standard', label: t.variantStandard },
    { value: 'url-safe', label: t.variantUrlSafe },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t.hint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t.variant}</span>
        <Toggle
          options={variantOptions}
          value={variant}
          onChange={changeVariant}
          label={t.variant}
        />
        <span className="text-sm text-muted">{t.variantHint}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={plainId}>{t.plain}</Label>
            <CopyButton value={plain} variant="secondary" size="icon" />
          </div>
          <Textarea
            id={plainId}
            value={plain}
            onChange={(event) => edit('plain', event.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-h-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={encodedId}>{t.encoded}</Label>
            <CopyButton value={encoded} variant="secondary" size="icon" />
          </div>
          <Textarea
            id={encodedId}
            value={encoded}
            onChange={(event) => edit('encoded', event.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={decodeError ? true : undefined}
            aria-describedby={decodeError ? errorId : undefined}
            className="min-h-44 font-mono text-sm"
          />
          <p id={errorId}>
            <FieldError>{decodeError ?? undefined}</FieldError>
          </p>
        </div>
      </div>

      {binaryBytes ? (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-subtle p-4">
          <p className="text-sm font-medium">{t.binaryTitle}</p>
          <p className="text-sm text-muted">
            {format(t.binaryBody, { size: formatBytes(binaryBytes.length) })}
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadBytes(binaryBytes)}
            >
              <Download size={ICON_SIZE} aria-hidden />
              {t.binaryDownload}
            </Button>
          </div>
        </div>
      ) : null}

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
              ? 'flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-accent bg-accent-subtle px-4 py-6 text-sm'
              : 'flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-6 text-sm text-muted transition-colors hover:border-border-strong'
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

        {fileNote ? <p className="text-sm text-muted">{fileNote}</p> : null}
        <FieldError>{fileError ?? undefined}</FieldError>
      </div>

      <div>
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
