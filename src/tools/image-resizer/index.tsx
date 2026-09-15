'use client';

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { downloadBlob } from '@/lib/download';
import { formatBytes } from '@/lib/utils';
import { messages } from '@/tools/image-resizer/i18n';
import {
  DEFAULT_OPTIONS,
  DEFAULT_QUALITY,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_QUALITY,
  MIN_QUALITY,
  OUTPUT_FORMATS,
  RESIZE_MODES,
  checkFiles,
  clampQuality,
  outputName,
  savedPercent,
  uniqueNames,
  type OutputFormat,
  type RejectionReason,
  type ResizeMode,
  type ResizeOptions,
} from '@/tools/image-resizer/logic';
import { resizeImage } from '@/tools/image-resizer/resize';
import { buildZip } from '@/tools/image-resizer/zip';

const ZIP_MIME = 'application/zip';
const ZIP_NAME = 'resized-images.zip';
const QUALITY_STEP = 0.01;
const PERCENT = 100;
const PREVIEW_HEIGHT = 96;

interface Item {
  id: string;
  file: File;
  previewUrl: string;
  output: {
    blob: Blob;
    name: string;
    width: number;
    height: number;
    previewUrl: string;
  } | null;
  failed: boolean;
}

export default function ImageResizer() {
  const t = messages(useLocale());

  const [items, setItems] = useState<Item[]>([]);
  const [options, setOptions] = useState<ResizeOptions>(DEFAULT_OPTIONS);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('keep');
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [rejections, setRejections] = useState<
    Array<{ name: string; reason: RejectionReason }>
  >([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(0);
  const fieldId = useId();

  const modeLabels: Record<ResizeMode, string> = {
    dimensions: t.modeDimensions,
    percent: t.modePercent,
    longest: t.modeLongest,
  };

  const formatLabels: Record<OutputFormat, string> = {
    keep: t.formatKeep,
    jpeg: 'JPEG',
    png: 'PNG',
    webp: 'WebP',
  };

  const rejectionMessages: Record<RejectionReason, string> = {
    type: t.rejectedType,
    size: t.rejectedSize,
    count: t.rejectedCount,
  };

  function addFiles(files: File[]) {
    const { accepted, rejected } = checkFiles(files, items.length);
    setRejections(rejected);

    setItems((previous) => [
      ...previous,
      ...accepted.map((file) => {
        counterRef.current += 1;
        return {
          id: `file-${counterRef.current}`,
          file,
          previewUrl: URL.createObjectURL(file),
          output: null,
          failed: false,
        };
      }),
    ]);
  }

  function removeItem(id: string) {
    setItems((previous) => {
      const item = previous.find((each) => each.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.output) URL.revokeObjectURL(item.output.previewUrl);
      }

      return previous.filter((each) => each.id !== id);
    });
  }

  function clearAll() {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.output) URL.revokeObjectURL(item.output.previewUrl);
    }

    setItems([]);
    setRejections([]);
    setProgress(null);
  }

  async function processAll() {
    if (items.length === 0) return;
    setProgress({ done: 0, total: items.length });

    const results: Item[] = [];
    let done = 0;

    for (const item of items) {
      if (item.output) URL.revokeObjectURL(item.output.previewUrl);

      try {
        const outcome = await resizeImage({
          file: item.file,
          options,
          format: outputFormat,
          quality,
        });

        results.push({
          ...item,
          failed: false,
          output: {
            blob: outcome.blob,
            name: outputName(item.file.name, outcome.mime),
            width: outcome.output.width,
            height: outcome.output.height,
            previewUrl: URL.createObjectURL(outcome.blob),
          },
        });
      } catch {
        results.push({ ...item, output: null, failed: true });
      }

      done += 1;
      setProgress({ done, total: items.length });
    }

    setItems(results);
    setProgress(null);
  }

  async function downloadZip() {
    const ready = items.filter((item) => item.output !== null);
    if (ready.length === 0) return;

    const names = uniqueNames(ready.map((item) => item.output?.name ?? 'image'));

    const entries = await Promise.all(
      ready.map(async (item, index) => ({
        name: names[index] ?? `image-${index}`,
        bytes: new Uint8Array(await (item.output as NonNullable<Item['output']>).blob.arrayBuffer()),
      })),
    );

    const archive = buildZip(entries);
    downloadBlob(new Blob([archive as BlobPart], { type: ZIP_MIME }), ZIP_NAME);
  }

  const readyCount = items.filter((item) => item.output !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface-subtle p-4">
        <p className="text-sm text-muted">{t.privacy}</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles([...event.dataTransfer.files]);
        }}
        className={`flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center ${
          dragging ? 'border-accent bg-accent-subtle' : 'border-border'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => addFiles([...(event.target.files ?? [])])}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {t.drop}
        </Button>
        <FieldHint>
          {format(t.dropHint, {
            count: MAX_FILES,
            size: formatBytes(MAX_FILE_BYTES),
          })}
        </FieldHint>
      </div>

      {rejections.length > 0 ? (
        <div className="flex flex-col gap-1">
          {rejections.map((rejection) => (
            <FieldError key={`${rejection.name}-${rejection.reason}`}>
              {format(rejectionMessages[rejection.reason], {
                name: rejection.name,
                size: formatBytes(MAX_FILE_BYTES),
              })}
            </FieldError>
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t.mode}</span>
            <Toggle
              label={t.mode}
              value={options.mode}
              onChange={(mode) => setOptions({ ...options, mode })}
              options={RESIZE_MODES.map((value) => ({
                value,
                label: modeLabels[value],
              }))}
            />
          </div>

          {options.mode === 'dimensions' ? (
            <>
              <div className="flex w-32 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-width`}>{t.width}</Label>
                <Input
                  id={`${fieldId}-width`}
                  value={String(options.width)}
                  inputMode="numeric"
                  onChange={(event) =>
                    setOptions({ ...options, width: Number(event.target.value) || 1 })
                  }
                  className="text-right font-mono"
                />
              </div>

              <div className="flex w-32 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-height`}>{t.height}</Label>
                <Input
                  id={`${fieldId}-height`}
                  value={String(options.height)}
                  inputMode="numeric"
                  onChange={(event) =>
                    setOptions({ ...options, height: Number(event.target.value) || 1 })
                  }
                  className="text-right font-mono"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.lockAspect}
                  onChange={(event) =>
                    setOptions({ ...options, lockAspect: event.target.checked })
                  }
                />
                <span>{t.lockAspect}</span>
              </label>
            </>
          ) : null}

          {options.mode === 'percent' ? (
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-percent`}>
                {format(t.percent, { value: options.percent })}
              </Label>
              <input
                id={`${fieldId}-percent`}
                type="range"
                min={1}
                max={100}
                value={options.percent}
                onChange={(event) =>
                  setOptions({ ...options, percent: Number(event.target.value) })
                }
              />
            </div>
          ) : null}

          {options.mode === 'longest' ? (
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-longest`}>{t.longest}</Label>
              <Input
                id={`${fieldId}-longest`}
                value={String(options.longest)}
                inputMode="numeric"
                onChange={(event) =>
                  setOptions({ ...options, longest: Number(event.target.value) || 1 })
                }
                className="text-right font-mono"
              />
            </div>
          ) : null}

          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-format`}>{t.format}</Label>
            <Select
              id={`${fieldId}-format`}
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
            >
              {OUTPUT_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {formatLabels[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-quality`}>
              {format(t.quality, { value: Math.round(quality * PERCENT) })}
            </Label>
            <input
              id={`${fieldId}-quality`}
              type="range"
              min={MIN_QUALITY}
              max={MAX_QUALITY}
              step={QUALITY_STEP}
              value={quality}
              onChange={(event) => setQuality(clampQuality(Number(event.target.value)))}
            />
          </div>
        </div>

        <FieldHint>{t.noEnlarge}</FieldHint>
        {options.mode === 'dimensions' ? <FieldHint>{t.lockAspectHint}</FieldHint> : null}
        <FieldHint>{t.qualityHint}</FieldHint>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={items.length === 0 || progress !== null} onClick={() => void processAll()}>
          {progress === null
            ? t.process
            : format(t.processing, { done: progress.done, total: progress.total })}
        </Button>

        {readyCount > 0 ? (
          <Button variant="secondary" onClick={() => void downloadZip()}>
            {t.downloadAll}
          </Button>
        ) : null}

        {items.length > 0 ? (
          <Button variant="ghost" onClick={clearAll}>
            {t.clear}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const saved = item.output
              ? savedPercent(item.file.size, item.output.blob.size)
              : 0;

            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element --
                    a blob: URL from the reader's own file; next/image can
                    neither optimize nor even load one. */}
                <img
                  src={item.previewUrl}
                  alt=""
                  style={{ height: PREVIEW_HEIGHT }}
                  className="rounded-control border border-border object-contain"
                />

                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium break-all">{item.file.name}</span>
                  <span className="text-sm text-muted">
                    {t.original}: {formatBytes(item.file.size)}
                  </span>

                  {item.output ? (
                    <>
                      <span className="text-sm text-muted">
                        {t.resized}: {formatBytes(item.output.blob.size)} ·{' '}
                        {format(t.dimensions, {
                          width: item.output.width,
                          height: item.output.height,
                        })}
                      </span>
                      <Badge tone={saved > 0 ? 'success' : 'neutral'} className="w-fit">
                        {saved > 0 ? format(t.smaller, { percent: saved }) : t.larger}
                      </Badge>
                    </>
                  ) : null}

                  {item.failed ? (
                    <FieldError>{format(t.failed, { name: item.file.name })}</FieldError>
                  ) : null}
                </div>

                {item.output ? (
                  // eslint-disable-next-line @next/next/no-img-element -- as above
                  <img
                    src={item.output.previewUrl}
                    alt=""
                    style={{ height: PREVIEW_HEIGHT }}
                    className="rounded-control border border-border object-contain"
                  />
                ) : null}

                <div className="ml-auto flex gap-2">
                  {item.output ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const output = item.output;
                        if (output) downloadBlob(output.blob, output.name);
                      }}
                    >
                      {t.download}
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={format(t.remove, { name: item.file.name })}
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <FieldHint>{t.exifNote}</FieldHint>
        <FieldHint>{t.zipNote}</FieldHint>
      </div>
    </div>
  );
}
