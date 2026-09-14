'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import {
  formatCmyk,
  formatHsl,
  formatHsv,
  formatOklch,
  formatRgb,
  nearestColorName,
  parseColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  type Rgb,
} from '@/lib/color';
import { messages } from '@/tools/color-converter/i18n';
import {
  PALETTE_KINDS,
  buildPalette,
  paletteToCss,
  type PaletteKind,
} from '@/tools/color-converter/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_COLOR_KEY = 'c';
const URL_NAME_KEY = 'name';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_COLOR = '#4682b4';
const DEFAULT_NAME = 'brand';
const MAX_CHANNEL = 255;
const ALPHA_STEP = 0.01;

export default function ColorConverter({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_COLOR_KEY]: searchParams[URL_COLOR_KEY] ?? DEFAULT_COLOR,
      [URL_NAME_KEY]: searchParams[URL_NAME_KEY] ?? DEFAULT_NAME,
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const raw = urlState[URL_COLOR_KEY];
  const variableName = urlState[URL_NAME_KEY];

  const colorId = useId();
  const pickerId = useId();
  const nameId = useId();

  const rgb = parseColor(raw);
  const error = rgb === null && raw.trim().length > 0 ? t.errorColor : null;

  function setColor(next: Rgb) {
    setUrlState({ [URL_COLOR_KEY]: rgbToHex(next, true) });
  }

  const notations: Array<[string, string]> = rgb
    ? [
        [t.hex, rgbToHex(rgb, true)],
        [t.rgb, formatRgb(rgb)],
        [t.hsl, formatHsl(rgbToHsl(rgb))],
        [t.hsv, formatHsv(rgbToHsv(rgb))],
        [t.oklch, formatOklch(rgbToOklch(rgb))],
        [t.cmyk, formatCmyk(rgbToCmyk(rgb))],
      ]
    : [];

  const paletteLabels: Record<PaletteKind, string> = {
    tints: t.paletteTints,
    shades: t.paletteShades,
    complementary: t.paletteComplementary,
    analogous: t.paletteAnalogous,
    triadic: t.paletteTriadic,
  };

  const channels: Array<[string, 'r' | 'g' | 'b']> = [
    [t.red, 'r'],
    [t.green, 'g'],
    [t.blue, 'b'],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={colorId}>{t.color}</Label>
          <Input
            id={colorId}
            value={raw}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            onChange={(event) => setUrlState({ [URL_COLOR_KEY]: event.target.value })}
            className="font-mono"
          />
          <FieldError>{error ?? undefined}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={pickerId}>{t.picker}</Label>
          <input
            id={pickerId}
            type="color"
            value={rgb ? rgbToHex(rgb) : DEFAULT_COLOR}
            onChange={(event) => setUrlState({ [URL_COLOR_KEY]: event.target.value })}
            className="h-10 w-16 cursor-pointer rounded-control border border-border bg-surface"
          />
        </div>
      </div>

      {rgb ? (
        <>
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div
              aria-label={t.preview}
              style={{ backgroundColor: rgbToHex(rgb, true) }}
              className="h-24 w-full rounded-card border border-border sm:w-40"
            />
            <Badge tone="muted">
              {format(t.nearest, { name: nearestColorName(rgb) })}
            </Badge>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.formats}</h2>
            <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
              {notations.map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <dt className="w-20 text-sm text-muted">{label}</dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-sm">{value}</dd>
                  <CopyButton value={value} variant="ghost" size="icon" />
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted">{t.cmykNote}</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.channels}</h2>
            {channels.map(([label, key]) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <span className="w-16">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={MAX_CHANNEL}
                  value={rgb[key]}
                  onChange={(event) =>
                    setColor({ ...rgb, [key]: Number(event.target.value) })
                  }
                  className="min-w-0 flex-1"
                />
                <span className="w-10 text-right font-mono">{rgb[key]}</span>
              </label>
            ))}

            <label className="flex items-center gap-3 text-sm">
              <span className="w-16">{t.alpha}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={ALPHA_STEP}
                value={rgb.a}
                onChange={(event) =>
                  setColor({ ...rgb, a: Number(event.target.value) })
                }
                className="min-w-0 flex-1"
              />
              <span className="w-10 text-right font-mono">{rgb.a.toFixed(2)}</span>
            </label>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">{t.palette}</h2>
              <p className="text-sm text-muted">{t.paletteNote}</p>
            </div>

            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor={nameId}>{t.cssName}</Label>
              <Input
                id={nameId}
                value={variableName}
                spellCheck={false}
                onChange={(event) => setUrlState({ [URL_NAME_KEY]: event.target.value })}
                className="font-mono"
              />
            </div>

            {PALETTE_KINDS.map((kind) => {
              const swatches = buildPalette(rgb, kind);
              const css = paletteToCss(swatches, `${variableName}-${kind}`);

              return (
                <div key={kind} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{paletteLabels[kind]}</h3>
                    <CopyButton
                      value={css}
                      label={t.copyCss}
                      variant="secondary"
                      size="sm"
                    />
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {swatches.map((entry, index) => (
                      <li key={`${kind}-${index}`} className="flex flex-col gap-1">
                        <button
                          type="button"
                          aria-label={entry.hex}
                          title={entry.hex}
                          onClick={() => setColor(entry.rgb)}
                          style={{ backgroundColor: entry.hex }}
                          className="size-14 rounded-control border border-border"
                        />
                        <span className="font-mono text-xs text-muted">{entry.hex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      ) : null}

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setUrlState({ [URL_COLOR_KEY]: DEFAULT_COLOR })}
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
