'use client';

import { useId, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldHint, Input, Label, Select } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/css-generator/i18n';
import {
  DEFAULT_GRADIENT,
  DEFAULT_SHADOW,
  GRADIENT_KINDS,
  GRADIENT_PRESETS,
  MAX_LAYERS,
  MAX_STOPS,
  MIN_STOPS,
  SHADOW_PRESETS,
  TABS,
  clampAlpha,
  clampAngle,
  clampPercent,
  decodeGradient,
  decodeLayers,
  encodeGradient,
  encodeLayers,
  formatGradient,
  formatShadow,
  gradientCss,
  shadowCss,
  toArbitrary,
  type Gradient,
  type GradientKind,
  type ShadowLayer,
  type Tab,
} from '@/tools/css-generator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_TAB_KEY = 'tab';
const URL_LAYERS_KEY = 's';
const URL_GRADIENT_KEY = 'g';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 2_000;

const OFFSET_RANGE = 64;
const BLUR_MAX = 128;
const SPREAD_RANGE = 64;
const ALPHA_STEP = 0.01;
const ANGLE_MAX = 359;
const PREVIEW_HEIGHT = '12rem';

const FALLBACK_GRADIENT: Gradient = {
  ...DEFAULT_GRADIENT,
  stops: [
    { id: 'a', color: '#6366f1', position: 0 },
    { id: 'b', color: '#ec4899', position: 100 },
  ],
};

function readTab(raw: string | undefined): Tab {
  return TABS.includes(raw as Tab) ? (raw as Tab) : 'shadow';
}

export default function CssGenerator({ searchParams }: ToolComponentProps) {
  const locale = useLocale();
  const t = messages(locale);

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_TAB_KEY]: readTab(searchParams[URL_TAB_KEY]) as string,
      [URL_LAYERS_KEY]: searchParams[URL_LAYERS_KEY] ?? '',
      [URL_GRADIENT_KEY]: searchParams[URL_GRADIENT_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const tab = readTab(urlState[URL_TAB_KEY]);
  const fieldId = useId();

  const layers = useMemo(() => {
    const decoded = decodeLayers(urlState[URL_LAYERS_KEY]);
    if (decoded.length > 0) return decoded;

    return (SHADOW_PRESETS[1]?.value ?? [DEFAULT_SHADOW]).map((each, index) => ({
      id: `preset-${index}`,
      ...each,
    }));
  }, [urlState]);

  const gradient = useMemo(
    () => decodeGradient(urlState[URL_GRADIENT_KEY]) ?? FALLBACK_GRADIENT,
    [urlState],
  );

  const css = tab === 'shadow' ? shadowCss(layers) : gradientCss(gradient);
  const tailwind =
    tab === 'shadow'
      ? toArbitrary('shadow', formatShadow(layers))
      : toArbitrary('bg', formatGradient(gradient));

  const kindLabels: Record<GradientKind, string> = {
    linear: t.kindLinear,
    radial: t.kindRadial,
    conic: t.kindConic,
  };

  function writeLayers(next: ShadowLayer[]) {
    setUrlState({ [URL_LAYERS_KEY]: encodeLayers(next) });
  }

  function writeGradient(next: Gradient) {
    setUrlState({ [URL_GRADIENT_KEY]: encodeGradient(next) });
  }

  function updateLayer(id: string, patch: Partial<ShadowLayer>) {
    writeLayers(layers.map((each) => (each.id === id ? { ...each, ...patch } : each)));
  }

  function moveLayer(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;

    const next = [...layers];
    const moved = next[index];
    const other = next[target];
    if (!moved || !other) return;

    next[index] = other;
    next[target] = moved;
    writeLayers(next);
  }

  function updateStop(id: string, patch: Partial<{ color: string; position: number }>) {
    writeGradient({
      ...gradient,
      stops: gradient.stops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    });
  }

  const previewStyle =
    tab === 'shadow'
      ? { boxShadow: formatShadow(layers) }
      : { backgroundImage: formatGradient(gradient) };

  return (
    <div className="flex flex-col gap-6">
      <Toggle
        label={t.tab}
        value={tab}
        onChange={(next) => setUrlState({ [URL_TAB_KEY]: next })}
        options={[
          { value: 'shadow', label: t.tabShadow },
          { value: 'gradient', label: t.tabGradient },
        ]}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t.presets}</h2>
        <div className="flex flex-wrap gap-2">
          {tab === 'shadow'
            ? SHADOW_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    writeLayers(
                      preset.value.map((each, index) => ({
                        id: `${preset.id}-${index}`,
                        ...each,
                      })),
                    )
                  }
                >
                  {locale === 'th' ? preset.th : preset.en}
                </Button>
              ))
            : GRADIENT_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    writeGradient({
                      kind: preset.value.kind,
                      angle: preset.value.angle,
                      stops: preset.value.stops.map((stop, index) => ({
                        id: `${preset.id}-${index}`,
                        ...stop,
                      })),
                    })
                  }
                >
                  {locale === 'th' ? preset.th : preset.en}
                </Button>
              ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t.preview}</h2>
        <div className="rounded-card border border-border bg-surface-subtle p-8">
          <div
            style={{ ...previewStyle, minHeight: PREVIEW_HEIGHT }}
            className="flex items-center justify-center rounded-card bg-surface text-sm text-muted"
          >
            {tab === 'shadow' ? t.previewText : null}
          </div>
        </div>
      </section>

      {tab === 'shadow' ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t.layers}</h2>
            <span className="text-sm text-muted">
              {format(t.maxLayers, { count: MAX_LAYERS })}
            </span>
          </div>

          {layers.length === 0 ? (
            <p className="text-sm text-muted">{t.noLayers}</p>
          ) : null}

          <ul className="flex flex-col gap-4">
            {layers.map((each, index) => (
              <li
                key={each.id}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {format(t.layerName, { index: index + 1 })}
                  </span>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={each.inset}
                      onChange={(event) =>
                        updateLayer(each.id, { inset: event.target.checked })
                      }
                    />
                    <span>{t.inset}</span>
                  </label>

                  <div className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.moveUp, { index: index + 1 })}
                      disabled={index === 0}
                      onClick={() => moveLayer(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.moveDown, { index: index + 1 })}
                      disabled={index === layers.length - 1}
                      onClick={() => moveLayer(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.removeLayer, { index: index + 1 })}
                      onClick={() =>
                        writeLayers(layers.filter((other) => other.id !== each.id))
                      }
                    >
                      ×
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      ['x', t.offsetX, -OFFSET_RANGE, OFFSET_RANGE],
                      ['y', t.offsetY, -OFFSET_RANGE, OFFSET_RANGE],
                      ['blur', t.blur, 0, BLUR_MAX],
                      ['spread', t.spread, -SPREAD_RANGE, SPREAD_RANGE],
                    ] as Array<[keyof ShadowLayer, string, number, number]>
                  ).map(([field, label, min, max]) => (
                    <div key={String(field)} className="flex flex-col gap-1">
                      <Label htmlFor={`${fieldId}-${each.id}-${String(field)}`}>
                        {label}: {String(each[field])}px
                      </Label>
                      <input
                        id={`${fieldId}-${each.id}-${String(field)}`}
                        type="range"
                        min={min}
                        max={max}
                        value={Number(each[field])}
                        onChange={(event) =>
                          updateLayer(each.id, { [field]: Number(event.target.value) })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${fieldId}-${each.id}-color`}>{t.color}</Label>
                    <Input
                      id={`${fieldId}-${each.id}-color`}
                      type="color"
                      value={each.color}
                      onChange={(event) =>
                        updateLayer(each.id, { color: event.target.value })
                      }
                      className="h-10 w-20 p-1"
                    />
                  </div>

                  <div className="flex min-w-40 flex-1 flex-col gap-1">
                    <Label htmlFor={`${fieldId}-${each.id}-alpha`}>
                      {t.alpha}: {Math.round(each.alpha * 100)}%
                    </Label>
                    <input
                      id={`${fieldId}-${each.id}-alpha`}
                      type="range"
                      min={0}
                      max={1}
                      step={ALPHA_STEP}
                      value={each.alpha}
                      onChange={(event) =>
                        updateLayer(each.id, {
                          alpha: clampAlpha(Number(event.target.value)),
                        })
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={layers.length >= MAX_LAYERS}
              onClick={() =>
                writeLayers([
                  ...layers,
                  { id: `new-${layers.length}`, ...DEFAULT_SHADOW },
                ])
              }
            >
              {t.addLayer}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-kind`}>{t.kind}</Label>
              <Select
                id={`${fieldId}-kind`}
                value={gradient.kind}
                onChange={(event) =>
                  writeGradient({
                    ...gradient,
                    kind: event.target.value as GradientKind,
                  })
                }
              >
                {GRADIENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </Select>
            </div>

            {gradient.kind === 'radial' ? null : (
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Label htmlFor={`${fieldId}-angle`}>
                  {t.angle}: {gradient.angle}°
                </Label>
                <input
                  id={`${fieldId}-angle`}
                  type="range"
                  min={0}
                  max={ANGLE_MAX}
                  value={gradient.angle}
                  onChange={(event) =>
                    writeGradient({
                      ...gradient,
                      angle: clampAngle(Number(event.target.value)),
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t.stops}</h2>
            <span className="text-sm text-muted">
              {format(t.maxStops, { count: MAX_STOPS })}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {gradient.stops.map((stop, index) => (
              <li
                key={stop.id}
                className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${fieldId}-${stop.id}-color`}>
                    {format(t.stopName, { index: index + 1 })}
                  </Label>
                  <Input
                    id={`${fieldId}-${stop.id}-color`}
                    type="color"
                    value={stop.color}
                    onChange={(event) =>
                      updateStop(stop.id, { color: event.target.value })
                    }
                    className="h-10 w-20 p-1"
                  />
                </div>

                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <Label htmlFor={`${fieldId}-${stop.id}-position`}>
                    {t.position}: {stop.position}%
                  </Label>
                  <input
                    id={`${fieldId}-${stop.id}-position`}
                    type="range"
                    min={0}
                    max={100}
                    value={stop.position}
                    onChange={(event) =>
                      updateStop(stop.id, {
                        position: clampPercent(Number(event.target.value)),
                      })
                    }
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.removeStop, { index: index + 1 })}
                  disabled={gradient.stops.length <= MIN_STOPS}
                  onClick={() =>
                    writeGradient({
                      ...gradient,
                      stops: gradient.stops.filter((other) => other.id !== stop.id),
                    })
                  }
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={gradient.stops.length >= MAX_STOPS}
              onClick={() =>
                writeGradient({
                  ...gradient,
                  stops: [
                    ...gradient.stops,
                    {
                      id: `new-${gradient.stops.length}`,
                      color: '#ffffff',
                      position: 50,
                    },
                  ],
                })
              }
            >
              {t.addStop}
            </Button>
            <FieldHint>{format(t.minStops, { count: MIN_STOPS })}</FieldHint>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>{t.css}</Label>
            <CopyButton value={css} label={t.copyCss} variant="ghost" size="icon" />
          </div>
          <pre className="overflow-x-auto rounded-card border border-border bg-surface p-3 font-mono text-sm break-all whitespace-pre-wrap">
            {css}
          </pre>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>{t.tailwind}</Label>
            <CopyButton
              value={tailwind}
              label={t.copyTailwind}
              variant="ghost"
              size="icon"
            />
          </div>
          <pre className="overflow-x-auto rounded-card border border-border bg-surface p-3 font-mono text-sm break-all whitespace-pre-wrap">
            {tailwind}
          </pre>
          <FieldHint>{t.tailwindNote}</FieldHint>
        </div>

        <FieldHint>{t.shareNote}</FieldHint>
      </section>
    </div>
  );
}
