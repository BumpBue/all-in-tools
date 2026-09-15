'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { ICT_TIME_ZONE, formatInZone } from '@/lib/datetime';
import { describeCron, hasDayAmbiguity } from '@/tools/cron-generator/describe';
import { messages } from '@/tools/cron-generator/i18n';
import {
  CRON_FIELDS,
  FIELD_RANGES,
  NEXT_RUN_COUNT,
  PRESETS,
  nextRuns,
  parseCron,
  type CronField,
} from '@/tools/cron-generator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_EXPRESSION_KEY = 'e';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_EXPRESSION = '30 8 * * 1-5';
const MILLISECONDS_PER_SECOND = 1000;

const MODES = ['every', 'step', 'specific'] as const;
type Mode = (typeof MODES)[number];

const FIELD_UNITS: Record<CronField, 'unitMinute' | 'unitHour' | 'unitDay' | 'unitMonth'> =
  {
    minute: 'unitMinute',
    hour: 'unitHour',
    dayOfMonth: 'unitDay',
    month: 'unitMonth',
    dayOfWeek: 'unitDay',
  };

function modeOf(part: string): Mode {
  if (part === '*') return 'every';
  if (part.startsWith('*/')) return 'step';
  return 'specific';
}

export default function CronGenerator({ searchParams }: ToolComponentProps) {
  const locale = useLocale();
  const t = messages(locale);

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_EXPRESSION_KEY]: searchParams[URL_EXPRESSION_KEY] ?? DEFAULT_EXPRESSION,
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const expression = urlState[URL_EXPRESSION_KEY];
  const parsed = parseCron(expression);
  const parts = expression.trim().split(/\s+/);

  const nowSeconds = useNowSeconds();
  const fieldId = useId();
  const expressionId = useId();

  const runs =
    parsed.ok && nowSeconds !== NO_TIME
      ? nextRuns(parsed, nowSeconds * MILLISECONDS_PER_SECOND, NEXT_RUN_COUNT)
      : [];

  const fieldLabels: Record<CronField, string> = {
    minute: t.fieldMinute,
    hour: t.fieldHour,
    dayOfMonth: t.fieldDayOfMonth,
    month: t.fieldMonth,
    dayOfWeek: t.fieldDayOfWeek,
  };

  const modeLabels: Record<Mode, string> = {
    every: t.modeEvery,
    step: t.modeStep,
    specific: t.modeSpecific,
  };

  function writePart(index: number, value: string) {
    const next = [...parts];
    while (next.length < CRON_FIELDS.length) next.push('*');
    next[index] = value.trim().length === 0 ? '*' : value.trim();

    setUrlState({ [URL_EXPRESSION_KEY]: next.slice(0, CRON_FIELDS.length).join(' ') });
  }

  function setMode(index: number, field: CronField, mode: Mode) {
    if (mode === 'every') return writePart(index, '*');
    if (mode === 'step') return writePart(index, '*/2');

    return writePart(index, String(FIELD_RANGES[field].min));
  }

  function errorMessage(): string {
    if (parsed.ok) return '';

    const field = parsed.field === null ? '' : fieldLabels[parsed.field];
    const values = { field, detail: parsed.detail, count: parsed.detail };

    if (parsed.code === 'wrong-field-count') return format(t.errorFieldCount, values);
    if (parsed.code === 'out-of-range') return format(t.errorRange, values);
    if (parsed.code === 'bad-range') return format(t.errorBadRange, values);
    if (parsed.code === 'bad-step') return format(t.errorBadStep, values);

    return format(t.errorUnknown, values);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={expressionId}>{t.expression}</Label>
          <CopyButton value={expression} label={t.copy} variant="ghost" size="icon" />
        </div>
        <Input
          id={expressionId}
          value={expression}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={!parsed.ok}
          onChange={(event) =>
            setUrlState({ [URL_EXPRESSION_KEY]: event.target.value })
          }
          className="font-mono text-base"
        />
        <FieldHint>{t.expressionHint}</FieldHint>
      </div>

      {parsed.ok ? null : <FieldError>{errorMessage()}</FieldError>}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t.presets}</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="secondary"
              size="sm"
              onClick={() =>
                setUrlState({ [URL_EXPRESSION_KEY]: preset.expression })
              }
            >
              {locale === 'th' ? preset.th : preset.en}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.builder}</h2>

        <ul className="flex flex-col gap-3">
          {CRON_FIELDS.map((field, index) => {
            const part = parts[index] ?? '*';
            const mode = modeOf(part);
            const range = FIELD_RANGES[field];

            return (
              <li
                key={field}
                className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3"
              >
                <div className="flex min-w-36 flex-col gap-1.5">
                  <Label htmlFor={`${fieldId}-${field}-mode`}>{fieldLabels[field]}</Label>
                  <Select
                    id={`${fieldId}-${field}-mode`}
                    value={mode}
                    onChange={(event) =>
                      setMode(index, field, event.target.value as Mode)
                    }
                  >
                    {MODES.map((each) => (
                      <option key={each} value={each}>
                        {modeLabels[each]}
                      </option>
                    ))}
                  </Select>
                </div>

                {mode === 'step' ? (
                  <div className="flex w-32 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${field}-step`}>
                      {format(t.stepLabel, { unit: t[FIELD_UNITS[field]] })}
                    </Label>
                    <Input
                      id={`${fieldId}-${field}-step`}
                      value={part.slice(2)}
                      inputMode="numeric"
                      autoComplete="off"
                      onChange={(event) => writePart(index, `*/${event.target.value}`)}
                      className="text-right font-mono"
                    />
                  </div>
                ) : null}

                {mode === 'specific' ? (
                  <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${field}-values`}>
                      {t.specificLabel}
                    </Label>
                    <Input
                      id={`${fieldId}-${field}-values`}
                      value={part}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(event) => writePart(index, event.target.value)}
                      className="font-mono"
                    />
                    <FieldHint>
                      {format(t.rangeHint, { min: range.min, max: range.max })}
                    </FieldHint>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {parsed.ok ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{t.meaning}</h2>
            <p role="status" className="text-title">
              {describeCron(parsed, locale)}
            </p>

            {hasDayAmbiguity(parsed) ? (
              <p className="text-sm text-danger">{t.ambiguity}</p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">
              {format(t.nextRuns, { count: NEXT_RUN_COUNT })}
            </h2>

            {nowSeconds === NO_TIME ? null : runs.length === 0 ? (
              <Badge tone="neutral">{t.noRuns}</Badge>
            ) : (
              <ol className="flex flex-col gap-1">
                {runs.map((run) => (
                  <li key={run} className="font-mono text-sm">
                    {formatInZone(run, ICT_TIME_ZONE, locale)}
                  </li>
                ))}
              </ol>
            )}

            <FieldHint>{t.ictNote}</FieldHint>
          </section>
        </>
      ) : null}
    </div>
  );
}
