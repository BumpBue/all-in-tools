'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/unit-converter/i18n';
import {
  SIGNIFICANT_DIGITS,
  categoryOf,
  convert,
  convertToAll,
  findUnit,
  formatValue,
  parseValue,
  readDigits,
  unitsOf,
} from '@/tools/unit-converter/logic';
import {
  CATEGORIES,
  CATEGORY_DEFINITIONS,
  type Provenance,
  type UnitDefinition,
} from '@/tools/unit-converter/units';
import type { ToolComponentProps } from '@/tools/types';

const URL_CATEGORY_KEY = 'c';
const URL_FROM_KEY = 'f';
const URL_TO_KEY = 't';
const URL_VALUE_KEY = 'v';
const URL_DIGITS_KEY = 'd';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_FROM_INDEX = 0;
const DEFAULT_TO_INDEX = 1;

export default function UnitConverter({ searchParams }: ToolComponentProps) {
  const locale = useLocale();
  const t = messages(locale);

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_CATEGORY_KEY]: categoryOf(searchParams[URL_CATEGORY_KEY] ?? '') as string,
      [URL_FROM_KEY]: searchParams[URL_FROM_KEY] ?? '',
      [URL_TO_KEY]: searchParams[URL_TO_KEY] ?? '',
      [URL_VALUE_KEY]: searchParams[URL_VALUE_KEY] ?? '1',
      [URL_DIGITS_KEY]: String(readDigits(searchParams[URL_DIGITS_KEY])),
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const category = categoryOf(urlState[URL_CATEGORY_KEY]);
  const digits = readDigits(urlState[URL_DIGITS_KEY]);
  const sourceText = urlState[URL_VALUE_KEY];

  const from = findUnit(category, urlState[URL_FROM_KEY], DEFAULT_FROM_INDEX);
  const to = findUnit(category, urlState[URL_TO_KEY], DEFAULT_TO_INDEX);

  // Held only while the reader is typing on the right: the left box is the one
  // that is kept, and rewriting the right box under the cursor would fight them.
  const [targetDraft, setTargetDraft] = useState<string | null>(null);

  const categoryId = useId();
  const sourceId = useId();
  const targetId = useId();
  const digitsId = useId();

  const sourceValue = parseValue(sourceText);

  const rows =
    sourceValue === null ? [] : convertToAll(sourceValue, from, category, digits);

  const targetText =
    targetDraft ??
    (sourceValue === null ? '' : formatValue(convert(sourceValue, from, to), digits));

  const unitName = (unit: UnitDefinition) => (locale === 'th' ? unit.th : unit.en);
  const categoryName = (id: (typeof CATEGORIES)[number]) =>
    locale === 'th' ? CATEGORY_DEFINITIONS[id].th : CATEGORY_DEFINITIONS[id].en;

  const provenanceNotes: Record<Provenance, string> = {
    exact: '',
    legal: t.noteLegal,
    'gold-bar': t.noteGoldBar,
    'gold-jewelry': t.noteGoldJewelry,
    chinese: t.noteChinese,
    rice: t.noteRice,
    defined: t.noteDefined,
    us: t.noteUs,
  };

  const usedProvenances = [
    ...new Set(
      unitsOf(category)
        .map((unit) => unit.provenance)
        .filter((note): note is Provenance => note !== undefined && note !== 'exact'),
    ),
  ];

  function writeSource(text: string) {
    setTargetDraft(null);
    setUrlState({ [URL_VALUE_KEY]: text });
  }

  function writeTarget(text: string) {
    setTargetDraft(text);

    const parsed = parseValue(text);
    if (parsed === null) return;
    setUrlState({ [URL_VALUE_KEY]: formatValue(convert(parsed, to, from), digits) });
  }

  function setUnits(next: { from?: string; to?: string }) {
    setTargetDraft(null);
    setUrlState({
      ...(next.from === undefined ? {} : { [URL_FROM_KEY]: next.from }),
      ...(next.to === undefined ? {} : { [URL_TO_KEY]: next.to }),
    });
  }

  function changeCategory(next: string) {
    const units = unitsOf(categoryOf(next));
    setTargetDraft(null);
    setUrlState({
      [URL_CATEGORY_KEY]: next,
      [URL_FROM_KEY]: units[DEFAULT_FROM_INDEX]?.id ?? '',
      [URL_TO_KEY]: units[DEFAULT_TO_INDEX]?.id ?? '',
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={categoryId}>{t.category}</Label>
          <Select
            id={categoryId}
            value={category}
            onChange={(event) => changeCategory(event.target.value)}
          >
            {CATEGORIES.map((id) => (
              <option key={id} value={id}>
                {categoryName(id)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={digitsId}>{t.digits}</Label>
          <Select
            id={digitsId}
            value={String(digits)}
            onChange={(event) => setUrlState({ [URL_DIGITS_KEY]: event.target.value })}
          >
            {SIGNIFICANT_DIGITS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </div>

        <FieldHint>{t.digitsHint}</FieldHint>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={sourceId}>{t.from}</Label>
          <Input
            id={sourceId}
            value={sourceText}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={sourceText.length > 0 && sourceValue === null}
            onChange={(event) => writeSource(event.target.value)}
            className="text-right font-mono"
          />
          <Select
            aria-label={`${t.from} (${t.unitColumn})`}
            value={from.id}
            onChange={(event) => setUnits({ from: event.target.value })}
          >
            {unitsOf(category).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unitName(unit)} ({unit.symbol})
              </option>
            ))}
          </Select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="mb-1 self-center"
          onClick={() => setUnits({ from: to.id, to: from.id })}
        >
          {t.swap}
        </Button>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={targetId}>{t.to}</Label>
          <Input
            id={targetId}
            value={targetText}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={targetDraft !== null && parseValue(targetDraft) === null}
            onChange={(event) => writeTarget(event.target.value)}
            className="text-right font-mono"
          />
          <Select
            aria-label={`${t.to} (${t.unitColumn})`}
            value={to.id}
            onChange={(event) => setUnits({ to: event.target.value })}
          >
            {unitsOf(category).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unitName(unit)} ({unit.symbol})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {sourceText.length > 0 && sourceValue === null ? (
        <FieldError>{t.invalid}</FieldError>
      ) : null}

      {category === 'temperature' ? <FieldHint>{t.affineNote}</FieldHint> : null}
      {category === 'data' ? <FieldHint>{t.dataNote}</FieldHint> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.allUnits}</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.unitColumn}</th>
                  <th className="px-3 py-2 text-right font-medium">{t.valueColumn}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.unit.id}
                    className={`border-t border-border ${
                      row.unit.id === from.id || row.unit.id === to.id
                        ? 'bg-accent-subtle'
                        : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-label={format(t.useAsTarget, { unit: unitName(row.unit) })}
                        onClick={() => setUnits({ to: row.unit.id })}
                        className="text-left hover:underline"
                      >
                        {unitName(row.unit)}{' '}
                        <span className="text-muted">({row.unit.symbol})</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right font-mono break-all">
                      {row.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usedProvenances.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t.notes}</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {usedProvenances.map((note) => (
              <div key={note} className="flex flex-wrap items-baseline gap-2">
                <dt>
                  <Badge tone="neutral">
                    {unitsOf(category)
                      .filter((unit) => unit.provenance === note)
                      .map((unit) => unit.symbol)
                      .join(' · ')}
                  </Badge>
                </dt>
                <dd className="text-muted">{provenanceNotes[note]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
