'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldHint, Input, Label } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { drawSeed } from '@/lib/random';
import { countWords } from '@/lib/text';
import { messages } from '@/tools/thai-lorem-ipsum/i18n';
import {
  DEFAULT_COUNTS,
  FORMATS,
  MAX_COUNTS,
  UNITS,
  clampCount,
  generate,
  type LoremFormat,
  type LoremUnit,
} from '@/tools/thai-lorem-ipsum/logic';
import { MODES, type LoremMode } from '@/tools/thai-lorem-ipsum/words';
import type { ToolComponentProps } from '@/tools/types';

const URL_MODE_KEY = 'm';
const URL_UNIT_KEY = 'u';
const URL_COUNT_KEY = 'n';
const URL_OPTIONS_KEY = 'o';
const URL_FORMAT_KEY = 'f';
const URL_SEED_KEY = 's';
const URL_DEBOUNCE_MS = 400;

const OPTION_SEPARATOR = ',';
const OPTION_IDS = ['opening', 'spacing', 'stop'] as const;
type OptionId = (typeof OPTION_IDS)[number];

const DEFAULT_ENABLED: readonly OptionId[] = ['opening', 'spacing'];
const SEED_CEILING = 4294967296;

function readMode(raw: string | undefined): LoremMode {
  return MODES.includes(raw as LoremMode) ? (raw as LoremMode) : 'general';
}

function readUnit(raw: string | undefined): LoremUnit {
  return UNITS.includes(raw as LoremUnit) ? (raw as LoremUnit) : 'paragraphs';
}

function readFormat(raw: string | undefined): LoremFormat {
  return FORMATS.includes(raw as LoremFormat) ? (raw as LoremFormat) : 'text';
}

function readEnabled(raw: string | undefined): Set<OptionId> {
  if (raw === undefined) return new Set(DEFAULT_ENABLED);
  return new Set(
    raw.split(OPTION_SEPARATOR).filter((id): id is OptionId =>
      OPTION_IDS.includes(id as OptionId),
    ),
  );
}

export default function ThaiLoremIpsum({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_MODE_KEY]: readMode(searchParams[URL_MODE_KEY]) as string,
      [URL_UNIT_KEY]: readUnit(searchParams[URL_UNIT_KEY]) as string,
      [URL_COUNT_KEY]: searchParams[URL_COUNT_KEY] ?? '',
      [URL_OPTIONS_KEY]: [...readEnabled(searchParams[URL_OPTIONS_KEY])].join(
        OPTION_SEPARATOR,
      ),
      [URL_FORMAT_KEY]: readFormat(searchParams[URL_FORMAT_KEY]) as string,
      [URL_SEED_KEY]: searchParams[URL_SEED_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const mode = readMode(urlState[URL_MODE_KEY]);
  const unit = readUnit(urlState[URL_UNIT_KEY]);
  const outputFormat = readFormat(urlState[URL_FORMAT_KEY]);
  const seedField = urlState[URL_SEED_KEY];
  const countField = urlState[URL_COUNT_KEY];

  const enabled = useMemo(
    () => readEnabled(urlState[URL_OPTIONS_KEY]),
    [urlState],
  );

  // Randomness cannot be drawn while rendering: the server would pick one
  // number and the browser another. The button draws the seed instead, and
  // every render after that is a pure function of the options.
  const [drawnSeed, setDrawnSeed] = useState<number | null>(null);

  const countId = useId();
  const seedId = useId();
  const outputId = useId();

  const typedSeed = Number(seedField.trim());
  const seed =
    seedField.trim().length > 0 && Number.isFinite(typedSeed)
      ? Math.abs(Math.floor(typedSeed)) % SEED_CEILING
      : drawnSeed;

  const count =
    countField.trim().length === 0
      ? DEFAULT_COUNTS[unit]
      : clampCount(unit, Number(countField));

  const output = useMemo(() => {
    if (seed === null) return '';

    return generate({
      mode,
      unit,
      count,
      standardOpening: enabled.has('opening'),
      thaiSpacing: enabled.has('spacing'),
      punctuation: enabled.has('stop'),
      format: outputFormat,
      seed,
    });
  }, [count, enabled, mode, outputFormat, seed, unit]);

  const modeLabels: Record<LoremMode, string> = {
    general: t.modeGeneral,
    news: t.modeNews,
    product: t.modeProduct,
  };

  const unitLabels: Record<LoremUnit, string> = {
    words: t.unitWords,
    sentences: t.unitSentences,
    paragraphs: t.unitParagraphs,
  };

  const optionLabels: Record<OptionId, string> = {
    opening: t.standardOpening,
    spacing: t.thaiSpacing,
    stop: t.punctuation,
  };

  const optionHints: Record<OptionId, string> = {
    opening: t.standardOpeningHint,
    spacing: t.thaiSpacingHint,
    stop: t.punctuationHint,
  };

  function setOption(id: OptionId, on: boolean) {
    const next = new Set(enabled);
    if (on) next.add(id);
    else next.delete(id);
    setUrlState({ [URL_OPTIONS_KEY]: [...next].join(OPTION_SEPARATOR) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.mode}</span>
          <Toggle
            label={t.mode}
            value={mode}
            onChange={(next) => setUrlState({ [URL_MODE_KEY]: next })}
            options={MODES.map((value) => ({ value, label: modeLabels[value] }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.unit}</span>
          <Toggle
            label={t.unit}
            value={unit}
            onChange={(next) => setUrlState({ [URL_UNIT_KEY]: next })}
            options={UNITS.map((value) => ({ value, label: unitLabels[value] }))}
          />
        </div>

        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor={countId}>{t.count}</Label>
          <Input
            id={countId}
            value={countField}
            inputMode="numeric"
            autoComplete="off"
            placeholder={String(DEFAULT_COUNTS[unit])}
            onChange={(event) => setUrlState({ [URL_COUNT_KEY]: event.target.value })}
            className="text-right font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.format}</span>
          <Toggle
            label={t.format}
            value={outputFormat}
            onChange={(next) => setUrlState({ [URL_FORMAT_KEY]: next })}
            options={[
              { value: 'text', label: t.formatText },
              { value: 'html', label: t.formatHtml },
            ]}
          />
        </div>
      </div>

      <FieldHint>
        {format(t.countHint, { max: MAX_COUNTS[unit], unit: unitLabels[unit] })}
      </FieldHint>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.options}</legend>
        {OPTION_IDS.map((id) => (
          <label key={id} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled.has(id)}
              onChange={(event) => setOption(id, event.target.checked)}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span>{optionLabels[id]}</span>
              <span className="text-muted">{optionHints[id]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor={seedId}>{t.seed}</Label>
          <Input
            id={seedId}
            value={seedField}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t.seedPlaceholder}
            onChange={(event) => setUrlState({ [URL_SEED_KEY]: event.target.value })}
            className="font-mono"
          />
        </div>

        <Button onClick={() => setDrawnSeed(drawSeed())}>{t.generate}</Button>
      </div>

      <FieldHint>{t.seedHint}</FieldHint>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={outputId}>{t.result}</Label>
          {output.length > 0 ? (
            <Badge tone="neutral">
              {format(t.stats, {
                words: countWords(output),
                characters: output.length,
              })}
            </Badge>
          ) : null}
          <CopyButton
            value={output}
            variant="secondary"
            size="icon"
            className="ml-auto"
          />
        </div>

        <textarea
          id={outputId}
          value={output}
          readOnly
          spellCheck={false}
          placeholder={t.waiting}
          className="min-h-64 w-full rounded-control border border-border bg-surface-subtle px-3 py-2 leading-loose text-foreground placeholder:text-muted"
        />
      </section>
    </div>
  );
}
