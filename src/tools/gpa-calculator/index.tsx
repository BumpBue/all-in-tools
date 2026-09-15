'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLocale } from '@/hooks/use-t';
import { messages } from '@/tools/gpa-calculator/i18n';
import {
  EMPTY_DATA,
  GRADES,
  MAX_TERMS,
  clampCredits,
  cumulativeThrough,
  cumulativeTotals,
  migrate,
  reduce,
  requiredNextTerm,
  termTotals,
  type GpaAction,
  type GpaData,
  type Grade,
} from '@/tools/gpa-calculator/logic';

const STORAGE_KEY = buildToolStorageKey('gpa-calculator');
const DEFAULT_TARGET = '3.00';
const DEFAULT_PLANNED = '18';

export default function GpaCalculator() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<GpaData>(STORAGE_KEY, EMPTY_DATA);
  const data = migrate(stored);

  const [termName, setTermName] = useState('');
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [planned, setPlanned] = useState(DEFAULT_PLANNED);

  const fieldId = useId();

  function send(action: GpaAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function addTerm() {
    if (termName.trim().length === 0) return;
    send({ type: 'add-term', name: termName });
    setTermName('');
  }

  const overall = cumulativeTotals(data);
  const plan = requiredNextTerm(overall, Number(planned), Number(target));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.terms}</h2>
          <span className="text-sm text-muted">
            {format(t.maxTerms, { count: MAX_TERMS })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-term`}>{t.newTerm}</Label>
            <Input
              id={`${fieldId}-term`}
              value={termName}
              placeholder={t.newTermPlaceholder}
              spellCheck={false}
              onChange={(event) => setTermName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTerm();
              }}
            />
          </div>
          <Button onClick={addTerm}>{t.addTerm}</Button>
        </div>

        {data.terms.length === 0 ? (
          <p className="text-sm text-muted">{t.noTerms}</p>
        ) : null}
      </section>

      {data.terms.map((term) => {
        const totals = termTotals(term);
        const running = cumulativeThrough(data, term.id);

        return (
          <section
            key={term.id}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={term.name}
                aria-label={t.renameTerm}
                spellCheck={false}
                onChange={(event) =>
                  send({ type: 'rename-term', termId: term.id, name: event.target.value })
                }
                className="min-w-40 flex-1"
              />

              <Badge tone="accent">
                {t.termGpa}: {totals.gpa.toFixed(2)}
              </Badge>
              <Badge tone="neutral">
                {format(t.termCredits, { count: totals.credits })}
              </Badge>
              <Badge tone="muted">
                {t.runningGpax}: {running.gpa.toFixed(2)}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                aria-label={format(t.removeTerm, { name: term.name })}
                onClick={() => send({ type: 'remove-term', termId: term.id })}
              >
                ×
              </Button>
            </div>

            {term.courses.length === 0 ? (
              <p className="text-sm text-muted">{t.noCourses}</p>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.courseName}</th>
                      <th className="w-28 px-3 py-2 font-medium">{t.credits}</th>
                      <th className="w-28 px-3 py-2 font-medium">{t.grade}</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {term.courses.map((course) => (
                      <tr key={course.id} className="border-t border-border">
                        <td className="px-3 py-1">
                          <input
                            value={course.name}
                            aria-label={t.courseName}
                            spellCheck={false}
                            onChange={(event) =>
                              send({
                                type: 'edit-course',
                                termId: term.id,
                                courseId: course.id,
                                patch: { name: event.target.value },
                              })
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            value={String(course.credits)}
                            aria-label={t.credits}
                            inputMode="decimal"
                            onChange={(event) =>
                              send({
                                type: 'edit-course',
                                termId: term.id,
                                courseId: course.id,
                                patch: { credits: clampCredits(Number(event.target.value)) },
                              })
                            }
                            className="w-full bg-transparent text-right font-mono outline-none"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <Select
                            value={course.grade}
                            aria-label={t.grade}
                            onChange={(event) =>
                              send({
                                type: 'edit-course',
                                termId: term.id,
                                courseId: course.id,
                                patch: { grade: event.target.value as Grade },
                              })
                            }
                            className="h-8 text-sm"
                          >
                            {GRADES.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={format(t.removeCourse, {
                              name: course.name || t.unnamed,
                            })}
                            onClick={() =>
                              send({
                                type: 'remove-course',
                                termId: term.id,
                                courseId: course.id,
                              })
                            }
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

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => send({ type: 'add-course', termId: term.id })}
              >
                {t.addCourse}
              </Button>
            </div>
          </section>
        );
      })}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.summary}</h2>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{t.gpax}</dt>
            <dd className="font-mono text-display">{overall.gpa.toFixed(2)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{t.totalCredits}</dt>
            <dd className="font-mono text-title">{overall.credits}</dd>
          </div>
        </dl>

        <FieldHint>{t.recomputeNote}</FieldHint>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.target}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-target`}>{t.targetGpax}</Label>
            <Input
              id={`${fieldId}-target`}
              value={target}
              inputMode="decimal"
              onChange={(event) => setTarget(event.target.value)}
              className="text-right font-mono"
            />
          </div>

          <div className="flex w-44 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-planned`}>{t.plannedCredits}</Label>
            <Input
              id={`${fieldId}-planned`}
              value={planned}
              inputMode="decimal"
              onChange={(event) => setPlanned(event.target.value)}
              className="text-right font-mono"
            />
          </div>
        </div>

        <p role="status" className="text-title">
          {plan.state === 'reached'
            ? t.reached
            : plan.state === 'no-credits'
              ? t.noCredits
              : plan.state === 'impossible'
                ? format(t.impossible, { value: plan.needed?.toFixed(2) ?? '' })
                : format(t.needed, { value: plan.needed?.toFixed(2) ?? '' })}
        </p>
      </section>

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.backupNote}</FieldHint>
    </div>
  );
}
