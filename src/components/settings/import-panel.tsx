'use client';

import { CircleAlert, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { format } from '@/config/i18n';
import { getTool } from '@/config/tools';
import { useLocale, useT } from '@/hooks/use-t';
import { invalidateStoredData } from '@/hooks/use-stored-data';
import { importAll, inspectImport, type ImportMode, type ImportPreview } from '@/lib/storage';
import { cn } from '@/lib/utils';

const ICON_SIZE = 18;
const ACCEPT = 'application/json,.json';

interface Staged {
  preview: ImportPreview;
  json: string;
}

export function ImportPanel() {
  const t = useT().settings;
  const locale = useLocale();

  const [staged, setStaged] = useState<Staged | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [done, setDone] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modeName = useId();

  async function accept(file: File | undefined) {
    if (!file) return;
    setDone(null);

    const json = await file.text();
    setStaged({ preview: inspectImport(json), json });
  }

  function apply() {
    if (!staged?.preview.ok) return;

    const result = importAll(staged.json, mode);
    if (!result.ok) {
      setStaged({
        json: staged.json,
        preview: { ok: false, errors: result.errors, tools: [] },
      });
      return;
    }

    invalidateStoredData();
    setDone(result.imported);
    setStaged(null);
  }

  function reset() {
    setStaged(null);
    setDone(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const modes: Array<{ value: ImportMode; label: string; hint: string }> = [
    { value: 'merge', label: t.importModeMerge, hint: t.importModeMergeHint },
    { value: 'replace', label: t.importModeReplace, hint: t.importModeReplaceHint },
  ];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-card border border-dashed px-4 py-8 text-sm transition-colors',
          dragging
            ? 'border-accent bg-accent-subtle text-foreground'
            : 'border-border text-muted hover:border-border-strong',
        )}
      >
        <Upload size={ICON_SIZE} aria-hidden />
        {t.importDrop}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={t.import}
        onChange={(event) => void accept(event.target.files?.[0])}
      />

      {done !== null ? (
        <p role="status" className="text-sm text-success">
          {format(t.importDone, { count: done })}
        </p>
      ) : null}

      {staged && !staged.preview.ok ? (
        <div className="flex flex-col gap-2 rounded-card border border-danger/40 bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <CircleAlert size={ICON_SIZE} aria-hidden />
            {t.importFailed}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {staged.preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" size="sm" onClick={reset}>
              {t.importCancel}
            </Button>
          </div>
        </div>
      ) : null}

      {staged?.preview.ok ? (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t.importReview}</p>
            <p className="text-sm text-muted">
              {format(t.importWillTouch, { count: staged.preview.tools.length })}
            </p>
          </div>

          <ul className="flex flex-col gap-1.5">
            {staged.preview.tools.map((entry) => (
              <li
                key={entry.slug}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{getTool(entry.slug)?.name[locale] ?? entry.slug}</span>
                <Badge tone="muted">
                  {format(t.itemCount, { count: entry.itemCount })}
                </Badge>
              </li>
            ))}
          </ul>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t.importReview}</legend>
            {modes.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <input
                  type="radio"
                  name={modeName}
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="mt-1"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={mode === 'replace' ? 'danger' : 'primary'}
              onClick={apply}
            >
              {t.importConfirm}
            </Button>
            <Button variant="secondary" size="sm" onClick={reset}>
              {t.importCancel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
