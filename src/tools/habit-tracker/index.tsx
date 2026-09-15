'use client';

import { useId, useState } from 'react';

import { Heatmap } from '@/components/tool/heatmap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { addDays, toDayKey } from '@/lib/day';
import { messages } from '@/tools/habit-tracker/i18n';
import {
  DAILY_TARGET,
  EMPTY_DATA,
  MAX_HABITS,
  allTicksByDay,
  completionRate,
  currentStreak,
  isDaily,
  isTicked,
  longestStreak,
  migrate,
  reduce,
  ticksByDay,
  ticksInWeek,
  weekStart,
  type HabitAction,
  type HabitData,
} from '@/tools/habit-tracker/logic';

const STORAGE_KEY = buildToolStorageKey('habit-tracker');
const MILLISECONDS_PER_SECOND = 1000;
const RECENT_DAYS = 7;
const RATE_WINDOW = 30;
const TARGETS = [1, 2, 3, 4, 5, 6, 7];

export default function HabitTracker() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<HabitData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);
  const nowSeconds = useNowSeconds();
  const today =
    nowSeconds === NO_TIME ? '' : toDayKey(nowSeconds * MILLISECONDS_PER_SECOND);

  const [name, setName] = useState('');
  const [target, setTarget] = useState(DAILY_TARGET);
  const [openId, setOpenId] = useState<string | null>(null);

  const fieldId = useId();

  function send(action: HabitAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function addHabit() {
    if (name.trim().length === 0) return;
    send({ type: 'add', name, targetPerWeek: target });
    setName('');
  }

  if (nowSeconds === NO_TIME) {
    return <p className="text-sm text-muted">{t.waiting}</p>;
  }

  const recentDays = Array.from({ length: RECENT_DAYS }, (_, index) =>
    addDays(today, index - RECENT_DAYS + 1),
  );

  const targetLabel = (count: number) =>
    count >= DAILY_TARGET ? t.targetDaily : format(t.targetPerWeek, { count });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.habits}</h2>
          <span className="text-sm text-muted">
            {format(t.maxHabits, { count: MAX_HABITS })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-name`}>{t.newHabit}</Label>
            <Input
              id={`${fieldId}-name`}
              value={name}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addHabit();
              }}
            />
          </div>

          <div className="flex w-44 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-target`}>{t.target}</Label>
            <Select
              id={`${fieldId}-target`}
              value={String(target)}
              onChange={(event) => setTarget(Number(event.target.value))}
            >
              {TARGETS.map((count) => (
                <option key={count} value={count}>
                  {targetLabel(count)}
                </option>
              ))}
            </Select>
          </div>

          <Button onClick={addHabit}>{t.addHabit}</Button>
        </div>

        {data.habits.length === 0 ? (
          <p className="text-sm text-muted">{t.noHabits}</p>
        ) : null}
      </section>

      <ul className="flex flex-col gap-4">
        {data.habits.map((habit) => {
          const streak = currentStreak(habit, today);
          const best = longestStreak(habit, today);
          const weekDone = ticksInWeek(habit, weekStart(today));

          return (
            <li
              key={habit.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={habit.name}
                  aria-label={t.rename}
                  spellCheck={false}
                  onChange={(event) =>
                    send({ type: 'rename', id: habit.id, name: event.target.value })
                  }
                  className="min-w-40 flex-1"
                />

                <Select
                  value={String(habit.targetPerWeek)}
                  aria-label={t.target}
                  onChange={(event) =>
                    send({
                      type: 'retarget',
                      id: habit.id,
                      targetPerWeek: Number(event.target.value),
                    })
                  }
                  className="w-40"
                >
                  {TARGETS.map((count) => (
                    <option key={count} value={count}>
                      {targetLabel(count)}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.remove, { name: habit.name })}
                  onClick={() => send({ type: 'remove', id: habit.id })}
                >
                  ×
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">
                  {t.streak}:{' '}
                  {isDaily(habit)
                    ? format(t.streakDays, { count: streak })
                    : format(t.streakWeeks, { count: streak })}
                </Badge>
                <Badge tone="muted">
                  {t.best}:{' '}
                  {isDaily(habit)
                    ? format(t.streakDays, { count: best })
                    : format(t.streakWeeks, { count: best })}
                </Badge>
                {isDaily(habit) ? null : (
                  <Badge tone="neutral">
                    {format(t.thisWeek, {
                      done: weekDone,
                      target: habit.targetPerWeek,
                    })}
                  </Badge>
                )}
                <Badge tone="neutral">
                  {format(t.rate, {
                    percent: completionRate(habit, today, RATE_WINDOW),
                  })}
                </Badge>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t.lastWeek}</span>
                <div className="flex flex-wrap gap-2">
                  {recentDays.map((day) => (
                    <label
                      key={day}
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-control border px-2 py-1 text-xs ${
                        isTicked(habit, day)
                          ? 'border-accent bg-accent-subtle text-accent'
                          : 'border-border text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isTicked(habit, day)}
                        aria-label={format(t.toggleDay, { name: habit.name, date: day })}
                        onChange={() => send({ type: 'toggle', id: habit.id, day })}
                        className="sr-only"
                      />
                      <span>{day.slice(-2)}</span>
                      <span>{day === today ? t.today : day.slice(5, 7)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => setOpenId(openId === habit.id ? null : habit.id)}
                >
                  {format(t.heatmap, { name: habit.name })}
                </Button>

                {openId === habit.id ? (
                  <Heatmap
                    values={ticksByDay(habit)}
                    today={today}
                    label={format(t.heatmap, { name: habit.name })}
                    formatTitle={(date, count) => format(t.heatmapDay, { date, count })}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {data.habits.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t.heatmapAll}</h2>
          <Heatmap
            values={allTicksByDay(data)}
            today={today}
            label={t.heatmapAll}
            formatTitle={(date, count) => format(t.heatmapDay, { date, count })}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 className="text-base font-semibold">{t.streakRules}</h2>
        <FieldHint>{t.streakRuleDaily}</FieldHint>
        <FieldHint>{t.streakRuleWeekly}</FieldHint>
        <FieldHint>{t.weekStartNote}</FieldHint>
      </section>

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}
