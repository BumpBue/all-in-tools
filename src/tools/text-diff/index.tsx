'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Label, Textarea } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/text-diff/i18n';
import {
  GRANULARITIES,
  MAX_DIFFERENCES,
  MAX_INPUT_CHARS,
  MAX_TOKENS,
  buildRows,
  diffTexts,
  mergeOps,
  summarize,
  type DiffOptions,
  type DiffView,
  type Granularity,
  type RowType,
} from '@/tools/text-diff/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_GRANULARITY_KEY = 'by';
const URL_VIEW_KEY = 'view';
const URL_OPTIONS_KEY = 'o';
const URL_DEBOUNCE_MS = 400;

const OPTION_SEPARATOR = ',';
const OPTION_IDS = ['case', 'space', 'blank'] as const;
type OptionId = (typeof OPTION_IDS)[number];

const ROW_TONES: Record<RowType, string> = {
  equal: '',
  insert: 'bg-success/10',
  delete: 'bg-danger/10',
  change: 'bg-accent-subtle',
};

const CELL_TONES: Record<'left' | 'right', string> = {
  left: 'bg-danger/10',
  right: 'bg-success/10',
};

function readGranularity(raw: string | undefined): Granularity {
  return GRANULARITIES.includes(raw as Granularity) ? (raw as Granularity) : 'line';
}

function readView(raw: string | undefined): DiffView {
  return raw === 'unified' ? 'unified' : 'split';
}

function readOptions(raw: string | undefined): DiffOptions {
  const enabled = new Set((raw ?? '').split(OPTION_SEPARATOR));

  return {
    ignoreCase: enabled.has('case'),
    ignoreWhitespace: enabled.has('space'),
    ignoreBlankLines: enabled.has('blank'),
  };
}

function writeOptions(options: DiffOptions): string {
  const enabled: OptionId[] = [];
  if (options.ignoreCase) enabled.push('case');
  if (options.ignoreWhitespace) enabled.push('space');
  if (options.ignoreBlankLines) enabled.push('blank');
  return enabled.join(OPTION_SEPARATOR);
}

export default function TextDiff({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // Only how to compare travels in the link; the two texts are the reader's.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_GRANULARITY_KEY]: readGranularity(searchParams[URL_GRANULARITY_KEY]) as string,
      [URL_VIEW_KEY]: readView(searchParams[URL_VIEW_KEY]) as string,
      [URL_OPTIONS_KEY]: writeOptions(readOptions(searchParams[URL_OPTIONS_KEY])),
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const granularity = readGranularity(urlState[URL_GRANULARITY_KEY]);
  const view = readView(urlState[URL_VIEW_KEY]);
  const options = useMemo(
    () => readOptions(urlState[URL_OPTIONS_KEY]),
    [urlState],
  );

  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');

  const leftId = useId();
  const rightId = useId();

  const outcome = useMemo(
    () => diffTexts(left, right, granularity, options),
    [granularity, left, options, right],
  );

  const stats = useMemo(
    () => (outcome.ok ? summarize(outcome.ops) : null),
    [outcome],
  );

  const rows = useMemo(
    () => (outcome.ok && view === 'split' ? buildRows(outcome.ops) : []),
    [outcome, view],
  );

  // Lines keep their own rows in the unified view; words and characters are
  // joined into runs so the text still reads as a sentence.
  const inline = useMemo(
    () =>
      outcome.ok && view === 'unified' && granularity !== 'line'
        ? mergeOps(outcome.ops)
        : [],
    [granularity, outcome, view],
  );

  const unifiedLines = useMemo(
    () => (outcome.ok && view === 'unified' && granularity === 'line' ? outcome.ops : []),
    [granularity, outcome, view],
  );

  const granularityLabels: Record<Granularity, string> = {
    line: t.granularityLine,
    word: t.granularityWord,
    character: t.granularityCharacter,
  };

  const unitLabels: Record<Granularity, string> = {
    line: t.unitLine,
    word: t.unitWord,
    character: t.unitCharacter,
  };

  const optionLabels: Record<OptionId, string> = {
    case: t.ignoreCase,
    space: t.ignoreWhitespace,
    blank: t.ignoreBlankLines,
  };

  const optionValues: Record<OptionId, boolean> = {
    case: options.ignoreCase,
    space: options.ignoreWhitespace,
    blank: options.ignoreBlankLines,
  };

  function setOption(id: OptionId, on: boolean) {
    const next: DiffOptions = {
      ...options,
      ...(id === 'case' ? { ignoreCase: on } : {}),
      ...(id === 'space' ? { ignoreWhitespace: on } : {}),
      ...(id === 'blank' ? { ignoreBlankLines: on } : {}),
    };
    setUrlState({ [URL_OPTIONS_KEY]: writeOptions(next) });
  }

  function swap() {
    setLeft(right);
    setRight(left);
  }

  function clearAll() {
    setLeft('');
    setRight('');
  }

  function errorMessage(code: 'too-long' | 'too-many-tokens' | 'too-different'): string {
    if (code === 'too-long') return format(t.errorTooLong, { limit: MAX_INPUT_CHARS });
    if (code === 'too-many-tokens') {
      return format(t.errorTooManyTokens, { limit: MAX_TOKENS });
    }
    return format(t.errorTooDifferent, { limit: MAX_DIFFERENCES });
  }

  const bothEmpty = left.length === 0 && right.length === 0;
  const unit = unitLabels[granularity];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={leftId}>{t.left}</Label>
          <Textarea
            id={leftId}
            value={left}
            placeholder={t.placeholderLeft}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setLeft(event.target.value)}
            className="min-h-48 font-mono text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={rightId}>{t.right}</Label>
          <Textarea
            id={rightId}
            value={right}
            placeholder={t.placeholderRight}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setRight(event.target.value)}
            className="min-h-48 font-mono text-sm"
          />
        </div>
      </div>

      <FieldHint>{t.privacy}</FieldHint>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.granularity}</span>
          <Toggle
            label={t.granularity}
            value={granularity}
            onChange={(next) => setUrlState({ [URL_GRANULARITY_KEY]: next })}
            options={GRANULARITIES.map((value) => ({
              value,
              label: granularityLabels[value],
            }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.view}</span>
          <Toggle
            label={t.view}
            value={view}
            onChange={(next) => setUrlState({ [URL_VIEW_KEY]: next })}
            options={[
              { value: 'split', label: t.viewSplit },
              { value: 'unified', label: t.viewUnified },
            ]}
          />
        </div>

        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="mb-1 text-sm font-medium">{t.options}</legend>
          {OPTION_IDS.map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionValues[id]}
                onChange={(event) => setOption(id, event.target.checked)}
              />
              <span>{optionLabels[id]}</span>
            </label>
          ))}
        </fieldset>

        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={swap}>
            {t.swap}
          </Button>
          <Button variant="secondary" size="sm" onClick={clearAll}>
            {t.clear}
          </Button>
        </div>
      </div>

      {granularity === 'word' ? <FieldHint>{t.thaiWordNote}</FieldHint> : null}
      {options.ignoreBlankLines ? <FieldHint>{t.ignoreBlankLinesHint}</FieldHint> : null}

      {!outcome.ok ? <FieldError>{errorMessage(outcome.code)}</FieldError> : null}

      {bothEmpty ? <p className="text-sm text-muted">{t.empty}</p> : null}

      {outcome.ok && stats !== null && !bothEmpty ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.result}</h2>
            <div role="status" className="flex flex-wrap gap-2">
              {stats.added + stats.removed + stats.changed === 0 ? (
                <Badge tone="success">{t.identical}</Badge>
              ) : (
                <>
                  {stats.added > 0 ? (
                    <Badge tone="success">
                      {format(t.added, { count: stats.added })} {unit}
                    </Badge>
                  ) : null}
                  {stats.removed > 0 ? (
                    <Badge tone="neutral">
                      {format(t.removed, { count: stats.removed })} {unit}
                    </Badge>
                  ) : null}
                  {stats.changed > 0 ? (
                    <Badge tone="accent">
                      {format(t.changed, { count: stats.changed })} {unit}
                    </Badge>
                  ) : null}
                </>
              )}
              <Badge tone="muted">
                {format(t.unchanged, { count: stats.unchanged })} {unit}
              </Badge>
            </div>
          </div>

          {view === 'split' ? (
            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full table-fixed text-left font-mono text-sm">
                <thead className="bg-surface-subtle">
                  <tr>
                    <th className="w-12 px-2 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">{t.columnLeft}</th>
                    <th className="w-12 px-2 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">{t.columnRight}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={index}
                      className={`border-t border-border align-top ${ROW_TONES[row.type]}`}
                    >
                      <td className="px-2 py-1 text-muted">{row.leftNumber}</td>
                      <td
                        className={`px-3 py-1 break-all whitespace-pre-wrap ${
                          row.type === 'equal' ? '' : CELL_TONES.left
                        }`}
                      >
                        {row.left}
                      </td>
                      <td className="px-2 py-1 text-muted">{row.rightNumber}</td>
                      <td
                        className={`px-3 py-1 break-all whitespace-pre-wrap ${
                          row.type === 'equal' ? '' : CELL_TONES.right
                        }`}
                      >
                        {row.right}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : granularity === 'line' ? (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              {unifiedLines.map((op, index) => (
                <div
                  key={index}
                  className={`flex gap-2 px-3 py-1 font-mono text-sm ${
                    op.type === 'insert'
                      ? 'bg-success/10'
                      : op.type === 'delete'
                        ? 'bg-danger/10'
                        : ''
                  }`}
                >
                  <span aria-hidden className="w-3 shrink-0 text-muted">
                    {op.type === 'insert' ? '+' : op.type === 'delete' ? '-' : ' '}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{op.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm whitespace-pre-wrap">
              {inline.map((op, index) =>
                op.type === 'equal' ? (
                  <span key={index}>{op.value}</span>
                ) : (
                  <span
                    key={index}
                    className={
                      op.type === 'insert'
                        ? 'bg-success/20 text-success'
                        : 'bg-danger/20 text-danger line-through'
                    }
                  >
                    {op.value}
                  </span>
                ),
              )}
            </pre>
          )}
        </section>
      ) : null}
    </div>
  );
}
