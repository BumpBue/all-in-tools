'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLocale } from '@/hooks/use-t';
import { messages } from '@/tools/eisenhower-matrix/i18n';
import {
  EMPTY_DATA,
  MAX_TASKS,
  QUADRANTS,
  countByQuadrant,
  migrate,
  reduce,
  tasksIn,
  timerLink,
  type MatrixAction,
  type MatrixData,
  type Quadrant,
} from '@/tools/eisenhower-matrix/logic';

const STORAGE_KEY = buildToolStorageKey('eisenhower-matrix');
const DRAG_TYPE = 'text/plain';

export default function EisenhowerMatrix() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<MatrixData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<Quadrant | null>(null);
  const fieldId = useId();

  const quadrantLabels: Record<Quadrant, string> = {
    do: t.quadrantDo,
    plan: t.quadrantPlan,
    delegate: t.quadrantDelegate,
    drop: t.quadrantDrop,
  };

  const quadrantHints: Record<Quadrant, string> = {
    do: t.quadrantDoHint,
    plan: t.quadrantPlanHint,
    delegate: t.quadrantDelegateHint,
    drop: t.quadrantDropHint,
  };

  const quadrantTones: Record<Quadrant, string> = {
    do: 'border-danger/40',
    plan: 'border-accent/40',
    delegate: 'border-border-strong',
    drop: 'border-border',
  };

  function send(action: MatrixAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function addFrom(quadrant: Quadrant) {
    const title = drafts[quadrant] ?? '';
    if (title.trim().length === 0) return;

    send({ type: 'add', title, quadrant });
    setDrafts((previous) => ({ ...previous, [quadrant]: '' }));
  }

  const counts = countByQuadrant(data);
  const doneCount = data.tasks.filter((task) => task.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="muted">{format(t.maxTasks, { count: MAX_TASKS })}</Badge>
        {doneCount > 0 ? (
          <>
            <Badge tone="success">{format(t.totalDone, { count: doneCount })}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => send({ type: 'clear-done' })}
            >
              {t.clearDone}
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUADRANTS.map((quadrant) => (
          <section
            key={quadrant}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(quadrant);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(null);

              const id = event.dataTransfer.getData(DRAG_TYPE);
              if (id.length > 0) send({ type: 'move', id, quadrant });
            }}
            className={`flex flex-col gap-3 rounded-card border-2 bg-surface p-4 ${
              dragOver === quadrant ? 'border-accent bg-accent-subtle' : quadrantTones[quadrant]
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-base font-semibold">{quadrantLabels[quadrant]}</h2>
              <span className="text-sm text-muted">{quadrantHints[quadrant]}</span>
              <Badge tone="neutral" className="ml-auto">
                {format(t.count, { count: counts[quadrant] })}
              </Badge>
            </div>

            <ul className="flex flex-col gap-2">
              {tasksIn(data, quadrant).map((task) => (
                <li
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, task.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-subtle px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label={format(t.toggle, { title: task.title })}
                    onChange={() => send({ type: 'toggle', id: task.id })}
                  />

                  <input
                    value={task.title}
                    aria-label={task.title}
                    spellCheck={false}
                    onChange={(event) =>
                      send({ type: 'edit', id: task.id, title: event.target.value })
                    }
                    className={`min-w-32 flex-1 bg-transparent text-sm outline-none ${
                      task.done ? 'text-muted line-through' : ''
                    }`}
                  />

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.moveUp, { title: task.title })}
                      onClick={() => send({ type: 'reorder', id: task.id, direction: -1 })}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.moveDown, { title: task.title })}
                      onClick={() => send({ type: 'reorder', id: task.id, direction: 1 })}
                    >
                      ↓
                    </Button>

                    <Select
                      value={quadrant}
                      aria-label={format(t.moveTo, { title: task.title })}
                      onChange={(event) =>
                        send({
                          type: 'move',
                          id: task.id,
                          quadrant: event.target.value as Quadrant,
                        })
                      }
                      className="h-8 w-28 text-xs"
                    >
                      {QUADRANTS.map((option) => (
                        <option key={option} value={option}>
                          {quadrantLabels[option]}
                        </option>
                      ))}
                    </Select>

                    <Link
                      href={timerLink(task)}
                      aria-label={format(t.timerFor, { title: task.title })}
                      className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                    >
                      {t.timer}
                    </Link>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.remove, { title: task.title })}
                      onClick={() => send({ type: 'remove', id: task.id })}
                    >
                      ×
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {counts[quadrant] === 0 ? (
              <p className="text-sm text-muted">
                {dragOver === quadrant ? t.dropHere : t.empty}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-${quadrant}`} className="sr-only">
                {format(t.addTo, { quadrant: quadrantLabels[quadrant] })}
              </Label>
              <Input
                id={`${fieldId}-${quadrant}`}
                value={drafts[quadrant] ?? ''}
                placeholder={t.addPlaceholder}
                spellCheck={false}
                onChange={(event) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [quadrant]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addFrom(quadrant);
                }}
              />
            </div>
          </section>
        ))}
      </div>

      <FieldHint>{t.keyboardNote}</FieldHint>

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}
