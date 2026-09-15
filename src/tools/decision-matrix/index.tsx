'use client';

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/decision-matrix/i18n';
import {
  EMPTY_DATA,
  MAX_SAVED,
  MAX_SCORE,
  clampScore,
  clampWeight,
  decodeDecision,
  emptyDecision,
  encodeDecision,
  migrate,
  ranking,
  reduceDecision,
  totalWeight,
  weightWarning,
  withFreshIds,
  type Decision,
  type MatrixAction,
  type MatrixData,
} from '@/tools/decision-matrix/logic';
import type { ToolComponentProps } from '@/tools/types';

const STORAGE_KEY = buildToolStorageKey('decision-matrix');
const URL_DECISION_KEY = 'd';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 4_000;
const SHARED_ID = 'shared';
const SCORE_STEP = 0.5;
const BAR_PERCENT = 100;

export default function DecisionMatrix({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<MatrixData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);

  const [urlState] = useUrlState(
    { [URL_DECISION_KEY]: searchParams[URL_DECISION_KEY] ?? '' },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  // A decision opened from a link is held here, not in storage, until it is
  // saved — and saving it takes fresh ids so it lands beside what is stored
  // rather than on top of it.
  const fromLink = decodeDecision(urlState[URL_DECISION_KEY], SHARED_ID);
  const [draft, setDraft] = useState<Decision | null>(fromLink);
  const [savedLink, setSavedLink] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [optionName, setOptionName] = useState('');
  const [criterionName, setCriterionName] = useState('');

  const fieldId = useId();
  const draftIdRef = useRef(1_000);

  const editingShared = draft !== null && openId === null;
  const current = editingShared
    ? draft
    : data.decisions.find((decision) => decision.id === openId) ?? null;

  function send(action: MatrixAction) {
    if (editingShared && draft) {
      // The draft is not stored yet, so its ids only have to be unique within
      // it; they are rewritten from the stored counter when it is saved.
      draftIdRef.current += 1;
      setDraft(reduceDecision(draft, action, draftIdRef.current).decision);
      return;
    }

    if (!current) return;

    setStored((previous) => {
      const model = migrate(previous);
      const { decision, used } = reduceDecision(
        model.decisions.find((each) => each.id === current.id) ?? current,
        action,
        model.nextId,
      );

      return {
        ...model,
        nextId: used ? model.nextId + 1 : model.nextId,
        decisions: model.decisions.map((each) =>
          each.id === decision.id ? decision : each,
        ),
      };
    });
  }

  // The id is worked out here rather than inside the updater: React may call an
  // updater twice, and setting other state from inside one would then fire
  // twice too. The updater below only computes the next value.
  function createDecision(name: string) {
    const id = `d${data.nextId}`;

    setStored((previous) => {
      const model = migrate(previous);

      return {
        ...model,
        nextId: Math.max(model.nextId + 1, data.nextId + 1),
        decisions: [...model.decisions, emptyDecision(id, name)],
      };
    });

    setOpenId(id);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft) return;

    setStored((previous) => {
      const model = migrate(previous);
      const { decision, nextId } = withFreshIds(draft, model.nextId);

      return { ...model, nextId, decisions: [...model.decisions, decision] };
    });

    setSavedLink(true);
  }

  const warning = current ? weightWarning(current) : null;
  const ranked = current ? ranking(current) : [];
  const best = ranked[0]?.score ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {fromLink ? (
        <section className="flex flex-col gap-2 rounded-card border border-accent bg-accent-subtle p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.sharedTitle}</h2>
            <Badge tone="neutral">{fromLink.name}</Badge>

            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft(fromLink);
                  setOpenId(null);
                }}
              >
                {format(t.open, { name: fromLink.name })}
              </Button>
              <Button size="sm" disabled={savedLink} onClick={saveDraft}>
                {savedLink ? t.savedAlready : t.save}
              </Button>
            </div>
          </div>
          <FieldHint>{t.sharedNote}</FieldHint>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.saved}</h2>
          <span className="text-sm text-muted">
            {format(t.maxSaved, { count: MAX_SAVED })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-new`}>{t.decisionName}</Label>
            <Input
              id={`${fieldId}-new`}
              value={newName}
              placeholder={t.decisionPlaceholder}
              spellCheck={false}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <Button
            disabled={newName.trim().length === 0}
            onClick={() => {
              createDecision(newName.trim());
              setNewName('');
            }}
          >
            {t.save}
          </Button>
        </div>

        {data.decisions.length === 0 ? (
          <p className="text-sm text-muted">{t.noSaved}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.decisions.map((decision) => (
              <li key={decision.id} className="flex items-center gap-1">
                <Button
                  variant={decision.id === openId ? 'primary' : 'secondary'}
                  size="sm"
                  aria-label={format(t.open, { name: decision.name })}
                  onClick={() => {
                    setOpenId(decision.id === openId ? null : decision.id);
                    setDraft(null);
                  }}
                >
                  {decision.name}
                </Button>

                <CopyButton
                  value={
                    typeof window === 'undefined'
                      ? ''
                      : `${window.location.origin}${window.location.pathname}?${URL_DECISION_KEY}=${encodeURIComponent(encodeDecision(decision))}`
                  }
                  label={t.share}
                  variant="ghost"
                  size="icon"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.removeSaved, { name: decision.name })}
                  onClick={() => {
                    setStored((previous) => {
                      const model = migrate(previous);
                      return {
                        ...model,
                        decisions: model.decisions.filter(
                          (each) => each.id !== decision.id,
                        ),
                      };
                    });
                    if (decision.id === openId) setOpenId(null);
                  }}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current ? (
        <>
          <Badge tone={editingShared ? 'accent' : 'muted'} className="w-fit">
            {editingShared ? t.editingShared : t.editingSaved}
          </Badge>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.criteria}</h2>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-criterion`}>{t.newCriterion}</Label>
                <Input
                  id={`${fieldId}-criterion`}
                  value={criterionName}
                  spellCheck={false}
                  onChange={(event) => setCriterionName(event.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  send({ type: 'add-criterion', name: criterionName });
                  setCriterionName('');
                }}
              >
                {t.addCriterion}
              </Button>
            </div>

            {current.criteria.length === 0 ? (
              <p className="text-sm text-muted">{t.noCriteria}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {current.criteria.map((criterion) => (
                  <li key={criterion.id} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={criterion.name}
                      aria-label={t.newCriterion}
                      spellCheck={false}
                      onChange={(event) =>
                        send({
                          type: 'rename-criterion',
                          id: criterion.id,
                          name: event.target.value,
                        })
                      }
                      className="min-w-40 flex-1"
                    />

                    <Input
                      value={String(criterion.weight)}
                      aria-label={format(t.weightOf, { name: criterion.name })}
                      inputMode="numeric"
                      onChange={(event) =>
                        send({
                          type: 'reweight',
                          id: criterion.id,
                          weight: clampWeight(Number(event.target.value)),
                        })
                      }
                      className="w-20 text-right font-mono"
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.removeCriterion, { name: criterion.name })}
                      onClick={() => send({ type: 'remove-criterion', id: criterion.id })}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {warning !== null ? (
              <div className="flex flex-col gap-2">
                <p role="status" className="text-sm text-danger">
                  {format(warning === 'under' ? t.warningUnder : t.warningOver, {
                    total: totalWeight(current),
                  })}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={() => send({ type: 'normalize' })}
                >
                  {t.normalize}
                </Button>
                <FieldHint>{t.normalizeNote}</FieldHint>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.options}</h2>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-option`}>{t.newOption}</Label>
                <Input
                  id={`${fieldId}-option`}
                  value={optionName}
                  spellCheck={false}
                  onChange={(event) => setOptionName(event.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  send({ type: 'add-option', name: optionName });
                  setOptionName('');
                }}
              >
                {t.addOption}
              </Button>
            </div>

            {current.options.length === 0 ? (
              <p className="text-sm text-muted">{t.noOptions}</p>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.options}</th>
                      {current.criteria.map((criterion) => (
                        <th key={criterion.id} className="px-3 py-2 font-medium">
                          {criterion.name}
                          <span className="ml-1 text-muted">{criterion.weight}%</span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium">{t.result}</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {current.options.map((option) => (
                      <tr key={option.id} className="border-t border-border">
                        <td className="px-3 py-1">
                          <input
                            value={option.name}
                            aria-label={t.newOption}
                            spellCheck={false}
                            onChange={(event) =>
                              send({
                                type: 'rename-option',
                                id: option.id,
                                name: event.target.value,
                              })
                            }
                            className="w-full min-w-24 bg-transparent outline-none"
                          />
                        </td>

                        {current.criteria.map((criterion) => (
                          <td key={criterion.id} className="px-3 py-1">
                            <input
                              type="number"
                              min={0}
                              max={MAX_SCORE}
                              step={SCORE_STEP}
                              value={option.scores[criterion.id] ?? 0}
                              aria-label={format(t.scoreOf, {
                                option: option.name,
                                criterion: criterion.name,
                              })}
                              onChange={(event) =>
                                send({
                                  type: 'score',
                                  optionId: option.id,
                                  criterionId: criterion.id,
                                  score: clampScore(Number(event.target.value)),
                                })
                              }
                              className="w-16 bg-transparent text-right font-mono outline-none"
                            />
                          </td>
                        ))}

                        <td className="px-3 py-1 text-right font-mono font-medium">
                          {ranked.find((entry) => entry.option.id === option.id)?.score ?? 0}
                        </td>
                        <td className="px-3 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={format(t.removeOption, { name: option.name })}
                            onClick={() => send({ type: 'remove-option', id: option.id })}
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <FieldHint>{t.scoreRange}</FieldHint>
          </section>

          {ranked.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t.result}</h2>

              <ul className="flex flex-col gap-2">
                {ranked.map((entry) => (
                  <li key={entry.option.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {entry.option.name}
                        <Badge tone={entry.rank === 1 ? 'accent' : 'muted'} className="ml-2">
                          {format(t.rank, { rank: entry.rank })}
                        </Badge>
                      </span>
                      <span className="font-mono">{entry.score.toFixed(2)}</span>
                    </div>
                    <div
                      className={`h-2 rounded-full ${entry.rank === 1 ? 'bg-accent' : 'bg-border-strong'}`}
                      style={{
                        width: `${best <= 0 ? 2 : Math.max(2, (entry.score / best) * BAR_PERCENT)}%`,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}
