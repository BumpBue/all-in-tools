'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/aspect-ratio/i18n';
import {
  PRESETS,
  formatRatio,
  heightFor,
  parseDimension,
  parseRatio,
  roundingDrift,
  simplifyRatio,
  widthFor,
  type Preset,
} from '@/tools/aspect-ratio/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_WIDTH_KEY = 'w';
const URL_HEIGHT_KEY = 'h';
const URL_LOCK_KEY = 'lock';
const URL_TARGET_KEY = 'ar';
const URL_DEBOUNCE_MS = 400;

const ON = '1';
const OFF = '0';
const DEFAULT_WIDTH = '1920';
const DEFAULT_HEIGHT = '1080';
const PREVIEW_MAX_PX = 220;
const DRIFT_DECIMALS = 3;

export default function AspectRatio({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());
  const locale = useLocale();

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_WIDTH_KEY]: searchParams[URL_WIDTH_KEY] ?? DEFAULT_WIDTH,
      [URL_HEIGHT_KEY]: searchParams[URL_HEIGHT_KEY] ?? DEFAULT_HEIGHT,
      [URL_LOCK_KEY]: searchParams[URL_LOCK_KEY] === ON ? ON : OFF,
      [URL_TARGET_KEY]: searchParams[URL_TARGET_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const widthRaw = urlState[URL_WIDTH_KEY];
  const heightRaw = urlState[URL_HEIGHT_KEY];
  const locked = urlState[URL_LOCK_KEY] === ON;

  const widthId = useId();
  const heightId = useId();

  const width = parseDimension(widthRaw);
  const height = parseDimension(heightRaw);

  const widthError = width === null && widthRaw.trim().length > 0 ? t.errorWidth : null;
  const heightError =
    height === null && heightRaw.trim().length > 0 ? t.errorHeight : null;

  const ratio = width !== null && height !== null ? simplifyRatio(width, height) : null;

  // Drift is only meaningful against a ratio the reader asked for. Measured
  // against the ratio the current numbers make, it is exact by definition.
  const target = parseRatio(urlState[URL_TARGET_KEY]);
  const drift =
    width !== null && height !== null && target !== null
      ? roundingDrift(width, height, target)
      : null;

  // With the ratio locked, the side not being edited follows the one that is.
  const held = target ?? ratio;

  function editWidth(value: string) {
    const next = parseDimension(value);
    if (locked && next !== null && held !== null) {
      setUrlState({
        [URL_WIDTH_KEY]: value,
        [URL_HEIGHT_KEY]: String(Math.round(heightFor(next, held))),
      });
      return;
    }
    setUrlState({ [URL_WIDTH_KEY]: value });
  }

  function editHeight(value: string) {
    const next = parseDimension(value);
    if (locked && next !== null && held !== null) {
      setUrlState({
        [URL_HEIGHT_KEY]: value,
        [URL_WIDTH_KEY]: String(Math.round(widthFor(next, held))),
      });
      return;
    }
    setUrlState({ [URL_HEIGHT_KEY]: value });
  }

  // Locking remembers the ratio in force at that moment, so later edits are
  // measured against it rather than against whatever the numbers drifted to.
  function toggleLock(on: boolean) {
    setUrlState({
      [URL_LOCK_KEY]: on ? ON : OFF,
      [URL_TARGET_KEY]: on && ratio !== null ? formatRatio(ratio) : '',
    });
  }

  function applyPreset(preset: Preset) {
    const size = preset.pixels ?? {
      width: preset.width,
      height: preset.height,
    };

    setUrlState({
      [URL_WIDTH_KEY]: String(size.width),
      [URL_HEIGHT_KEY]: String(size.height),
      [URL_TARGET_KEY]: formatRatio({ width: preset.width, height: preset.height }),
    });
  }

  const previewStyle =
    ratio === null
      ? undefined
      : ratio.width >= ratio.height
        ? { width: PREVIEW_MAX_PX, height: (PREVIEW_MAX_PX * ratio.height) / ratio.width }
        : { height: PREVIEW_MAX_PX, width: (PREVIEW_MAX_PX * ratio.width) / ratio.height };

  const groups: Array<['common' | 'social', string]> = [
    ['common', t.presetsCommon],
    ['social', t.presetsSocial],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={widthId}>{t.width}</Label>
          <Input
            id={widthId}
            inputMode="decimal"
            value={widthRaw}
            aria-invalid={widthError ? true : undefined}
            onChange={(event) => editWidth(event.target.value)}
            className="font-mono"
          />
          <FieldError>{widthError ?? undefined}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={heightId}>{t.height}</Label>
          <Input
            id={heightId}
            inputMode="decimal"
            value={heightRaw}
            aria-invalid={heightError ? true : undefined}
            onChange={(event) => editHeight(event.target.value)}
            className="font-mono"
          />
          <FieldError>{heightError ?? undefined}</FieldError>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => toggleLock(event.target.checked)}
          />
          {t.lock}
        </label>
        <p className="text-sm text-muted">{t.lockHint}</p>
      </div>

      {ratio !== null ? (
        <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted">{t.ratioResult}</h2>
            <div className="flex items-center gap-2">
              <p className="font-mono text-display">{formatRatio(ratio)}</p>
              <CopyButton value={formatRatio(ratio)} variant="ghost" size="icon" />
            </div>

            {drift !== null ? (
              drift.exact ? (
                <Badge tone="success" className="w-fit">
                  {t.exact}
                </Badge>
              ) : (
                <div className="flex flex-col gap-1">
                  <Badge tone="muted" className="w-fit">
                    {format(t.drift, {
                      percent: drift.driftPercent.toFixed(DRIFT_DECIMALS),
                    })}
                  </Badge>
                  <p className="text-sm text-muted">
                    {format(t.driftActual, { ratio: formatRatio(drift.actual) })}
                  </p>
                </div>
              )
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted">{t.preview}</h2>
            <div
              aria-hidden
              style={previewStyle}
              className="rounded-control border border-border-strong bg-accent-subtle"
            />
          </div>
        </section>
      ) : null}

      {groups.map(([group, label]) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{label}</h2>
          <ul className="flex flex-wrap gap-2">
            {PRESETS.filter((preset) => preset.group === group).map((preset) => (
              <li key={preset.id}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  title={
                    preset.pixels
                      ? `${preset.pixels.width} × ${preset.pixels.height}`
                      : undefined
                  }
                >
                  {preset.name[locale]}
                  {preset.pixels ? (
                    <span className="font-mono text-xs text-muted">
                      {preset.pixels.width}×{preset.pixels.height}
                    </span>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setUrlState({
              [URL_WIDTH_KEY]: DEFAULT_WIDTH,
              [URL_HEIGHT_KEY]: DEFAULT_HEIGHT,
              [URL_TARGET_KEY]: '',
            })
          }
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
