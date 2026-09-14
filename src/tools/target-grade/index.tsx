'use client';

import { useId, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/target-grade/i18n';
import {
  DEFAULT_CUTOFFS,
  GRADES,
  MAX_ITEMS,
  cutoffsDescend,
  decodeCutoffs,
  decodeItems,
  emptyItem,
  encodeCutoffs,
  encodeItems,
  itemIssue,
  requirementsFor,
  roundScore,
  standingOf,
  weightWarning,
  type Grade,
  type ItemIssue,
  type RawItem,
  type RequirementState,
} from '@/tools/target-grade/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_ITEMS_KEY = 'it';
const URL_FINAL_KEY = 'fw';
const URL_CUTOFFS_KEY = 'cut';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 2_000;

const STATE_TONES: Record<RequirementState, 'success' | 'accent' | 'neutral' | 'muted'> = {
  secured: 'success',
  possible: 'accent',
  impossible: 'neutral',
  'no-final': 'muted',
};

export default function TargetGrade({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // Nothing here is private and a classmate may well want to see it, so all of
  // it travels in the link.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_ITEMS_KEY]: searchParams[URL_ITEMS_KEY] ?? '',
      [URL_FINAL_KEY]: searchParams[URL_FINAL_KEY] ?? '',
      [URL_CUTOFFS_KEY]: encodeCutoffs(decodeCutoffs(searchParams[URL_CUTOFFS_KEY])),
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const fieldId = useId();
  const finalId = useId();

  const items = useMemo(() => decodeItems(urlState[URL_ITEMS_KEY]), [urlState]);
  const cutoffs = useMemo(() => decodeCutoffs(urlState[URL_CUTOFFS_KEY]), [urlState]);
  const finalWeight = urlState[URL_FINAL_KEY];

  const standing = useMemo(
    () => standingOf(items, finalWeight),
    [finalWeight, items],
  );
  const requirements = useMemo(
    () => requirementsFor(standing, cutoffs),
    [cutoffs, standing],
  );

  const issueLabels: Record<ItemIssue, string> = {
    'max-not-positive': t.issueMax,
    'score-negative': t.issueNegative,
    'score-above-max': t.issueAboveMax,
    'weight-negative': t.issueWeight,
  };

  const stateLabels: Record<RequirementState, string> = {
    secured: t.secured,
    possible: '',
    impossible: t.impossible,
    'no-final': t.noFinal,
  };

  function writeItems(next: RawItem[]) {
    setUrlState({ [URL_ITEMS_KEY]: encodeItems(next) });
  }

  function updateItem(id: string, field: keyof Omit<RawItem, 'id'>, value: string) {
    writeItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    writeItems([...items, emptyItem(`new-${items.length}`)]);
  }

  function removeItem(id: string) {
    writeItems(items.filter((item) => item.id !== id));
  }

  function setCutoff(grade: Grade, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setUrlState({ [URL_CUTOFFS_KEY]: encodeCutoffs({ ...cutoffs, [grade]: parsed }) });
  }

  function clearAll() {
    setUrlState({
      [URL_ITEMS_KEY]: '',
      [URL_FINAL_KEY]: '',
      [URL_CUTOFFS_KEY]: encodeCutoffs(DEFAULT_CUTOFFS),
    });
  }

  const warning = weightWarning(standing);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.items}</h2>
          <span className="text-sm text-muted">
            {format(t.maxItems, { count: MAX_ITEMS })}
          </span>
        </div>

        <div className="hidden gap-2 px-1 text-sm font-medium text-muted sm:grid sm:grid-cols-[1fr_5rem_5rem_6rem_2rem]">
          <span>{t.itemName}</span>
          <span>{t.itemScore}</span>
          <span>{t.itemMax}</span>
          <span>{t.itemWeight}</span>
          <span />
        </div>

        {items.length === 0 ? <p className="text-sm text-muted">{t.noItems}</p> : null}

        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const issue = itemIssue(item);
            const rowId = `${fieldId}-${item.id}`;

            return (
              <li key={item.id} className="flex flex-col gap-1">
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_6rem_2rem]">
                  <div>
                    <Label htmlFor={`${rowId}-name`} className="sr-only">
                      {t.itemName}
                    </Label>
                    <Input
                      id={`${rowId}-name`}
                      value={item.name}
                      placeholder={t.itemNamePlaceholder}
                      spellCheck={false}
                      onChange={(event) => updateItem(item.id, 'name', event.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`${rowId}-score`} className="sr-only">
                      {t.itemScore}
                    </Label>
                    <Input
                      id={`${rowId}-score`}
                      value={item.score}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={issue === 'score-negative' || issue === 'score-above-max'}
                      onChange={(event) =>
                        updateItem(item.id, 'score', event.target.value)
                      }
                      className="text-right font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`${rowId}-max`} className="sr-only">
                      {t.itemMax}
                    </Label>
                    <Input
                      id={`${rowId}-max`}
                      value={item.max}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={issue === 'max-not-positive'}
                      onChange={(event) => updateItem(item.id, 'max', event.target.value)}
                      className="text-right font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`${rowId}-weight`} className="sr-only">
                      {t.itemWeight}
                    </Label>
                    <Input
                      id={`${rowId}-weight`}
                      value={item.weight}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={issue === 'weight-negative'}
                      onChange={(event) =>
                        updateItem(item.id, 'weight', event.target.value)
                      }
                      className="text-right font-mono"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={format(t.removeItem, { name: item.name || t.itemName })}
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </Button>
                </div>

                {issue !== null ? <FieldError>{issueLabels[issue]}</FieldError> : null}
              </li>
            );
          })}
        </ul>

        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={items.length >= MAX_ITEMS}
            onClick={addItem}
          >
            {t.addItem}
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor={finalId}>{t.finalWeight}</Label>
        <Input
          id={finalId}
          value={finalWeight}
          inputMode="decimal"
          autoComplete="off"
          onChange={(event) => setUrlState({ [URL_FINAL_KEY]: event.target.value })}
          className="text-right font-mono"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.standing}</h2>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [t.earned, format(t.ofHundred, { value: roundScore(standing.earned) })],
              [
                t.completedWeight,
                format(t.percent, { value: roundScore(standing.completedWeight) }),
              ],
              [
                t.remainingWeight,
                format(t.percent, { value: roundScore(standing.finalWeight) }),
              ],
              [t.ceiling, format(t.ofHundred, { value: roundScore(standing.ceiling) })],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2"
            >
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-mono text-title">{value}</dd>
            </div>
          ))}
        </dl>

        {warning !== null ? (
          <p role="status" className="text-sm text-danger">
            {format(warning === 'under' ? t.warningUnder : t.warningOver, {
              total: roundScore(standing.totalWeight),
            })}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.requirements}</h2>

        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">{t.grade}</th>
                <th className="px-3 py-2 font-medium">{t.cutoff}</th>
                <th className="px-3 py-2 font-medium">{t.needed}</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((requirement) => (
                <tr key={requirement.grade} className="border-t border-border">
                  <td className="px-3 py-2 font-mono font-medium">{requirement.grade}</td>
                  <td className="px-3 py-2 font-mono text-muted">
                    {format(t.percent, { value: requirement.cutoff })}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATE_TONES[requirement.state]}>
                      {requirement.state === 'possible' && requirement.needed !== null
                        ? format(t.neededValue, {
                            value: roundScore(requirement.needed),
                          })
                        : stateLabels[requirement.state]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.cutoffs}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setUrlState({ [URL_CUTOFFS_KEY]: encodeCutoffs(DEFAULT_CUTOFFS) })
            }
          >
            {t.resetCutoffs}
          </Button>
        </div>

        <FieldHint>{t.cutoffsHint}</FieldHint>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {GRADES.map((grade) => (
            <div key={grade} className="flex flex-col gap-1">
              <Label htmlFor={`${fieldId}-cut-${grade}`}>{grade}</Label>
              <Input
                id={`${fieldId}-cut-${grade}`}
                value={String(cutoffs[grade])}
                inputMode="decimal"
                autoComplete="off"
                onChange={(event) => setCutoff(grade, event.target.value)}
                className="text-right font-mono"
              />
            </div>
          ))}
        </div>

        {cutoffsDescend(cutoffs) ? null : (
          <p role="status" className="text-sm text-danger">
            {t.warningCutoffs}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted">{t.shareNote}</p>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
