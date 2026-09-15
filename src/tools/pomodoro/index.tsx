'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Heatmap } from '@/components/tool/heatmap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { toDayKey } from '@/lib/day';
import { messages } from '@/tools/pomodoro/i18n';
import {
  DEFAULT_SETTINGS,
  EMPTY_DATA,
  MAX_ROUNDS,
  MIN_ROUNDS,
  clampMinutes,
  clampRounds,
  formatClock,
  isPaused,
  isRunning,
  migrate,
  phaseMs,
  reduce,
  remainingMs,
  roundsByDay,
  totalRounds,
  type Phase,
  type PomodoroAction,
  type PomodoroData,
  type PomodoroSettings,
} from '@/tools/pomodoro/logic';
import type { ToolComponentProps } from '@/tools/types';

const STORAGE_KEY = buildToolStorageKey('pomodoro');
const URL_TASK_KEY = 'task';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const TONE_FREQUENCY = 660;
const TONE_SECONDS = 0.25;
const TONE_GAIN = 0.08;
const RING_SIZE = 200;
const RING_STROKE = 10;

function playTone(): void {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = TONE_FREQUENCY;
  gain.gain.value = TONE_GAIN;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + TONE_SECONDS);
  oscillator.onended = () => void context.close();
}

function notify(title: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  new Notification(title);
}

export default function Pomodoro({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<PomodoroData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);
  const { session, settings } = data;

  const nowSeconds = useNowSeconds();
  const now = nowSeconds * MILLISECONDS_PER_SECOND;

  const [permission, setPermission] = useState<string | null>(null);
  const handedOver = useRef(false);

  const taskId = useId();
  const fieldId = useId();

  // A task can arrive from the Eisenhower matrix as a plain query parameter.
  // Deliberately one-way and loose: no shared state between tools, just a link.
  const handedTask = searchParams[URL_TASK_KEY] ?? '';

  useEffect(() => {
    if (handedTask.length === 0 || handedOver.current) return;
    handedOver.current = true;

    setStored((previous) =>
      reduce(migrate(previous), { type: 'set-task', task: handedTask }),
    );
  }, [handedTask, setStored]);

  function send(action: PomodoroAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  const left = remainingMs(session, now, settings);
  const total = phaseMs(session.phase, settings);
  const running = isRunning(session);
  const expired = running && nowSeconds !== NO_TIME && left <= 0;

  // Finishing a phase is an event, not a render: the countdown is drawn from
  // the clock, but the model only moves when the timer fires.
  //
  // The delay comes from the ticking clock rather than from Date.now(), which
  // is impure even here. That means this re-schedules once a second, which is
  // a clearTimeout and a setTimeout — and it is what makes a throttled tab
  // correct on return, since the delay is nothing by the time it renders again.
  //
  // The completed round is recorded against endsAt, the moment the phase
  // actually ended, not the moment the browser got round to telling us.
  const endsAt = session.endsAt;

  useEffect(() => {
    if (endsAt === null || now === NO_TIME) return;

    const finished = session.phase;
    const timer = window.setTimeout(
      () => {
        setStored((previous) =>
          reduce(migrate(previous), { type: 'complete', now: endsAt }),
        );

        if (settings.sound) playTone();
        if (settings.notifications) {
          notify(finished === 'focus' ? t.notifyFocusDone : t.notifyBreakDone);
        }
      },
      Math.max(0, endsAt - now),
    );

    return () => window.clearTimeout(timer);
  }, [
    endsAt,
    now,
    session.phase,
    setStored,
    settings.notifications,
    settings.sound,
    t.notifyBreakDone,
    t.notifyFocusDone,
  ]);

  function updateSettings(patch: Partial<PomodoroSettings>) {
    send({ type: 'settings', settings: { ...settings, ...patch } });
  }

  async function askPermission() {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    updateSettings({ notifications: result === 'granted' });
  }

  const phaseLabels: Record<Phase, string> = {
    focus: t.phaseFocus,
    break: t.phaseBreak,
    'long-break': t.phaseLongBreak,
  };

  const today = nowSeconds === NO_TIME ? '' : toDayKey(now);
  const todayStat = data.days[today] ?? { rounds: 0, focusSeconds: 0 };

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total <= 0 ? 0 : 1 - left / total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone={session.phase === 'focus' ? 'accent' : 'success'}>
            {phaseLabels[session.phase]}
          </Badge>
          <Badge tone="muted">{format(t.round, { round: session.round + 1 })}</Badge>
        </div>

        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            aria-hidden
            className="-rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              fill="none"
              strokeWidth={RING_STROKE}
              className="stroke-border"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="stroke-accent transition-[stroke-dashoffset] duration-500"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <p role="timer" aria-live="off" className="font-mono text-display">
              {nowSeconds === NO_TIME && running ? '--:--' : formatClock(left)}
            </p>
            {expired ? <span className="text-sm text-muted">…</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {running ? (
            <Button onClick={() => send({ type: 'pause', now })}>{t.pause}</Button>
          ) : (
            <Button onClick={() => send({ type: isPaused(session) ? 'resume' : 'start', now })}>
              {isPaused(session) ? t.resume : t.start}
            </Button>
          )}

          <Button variant="secondary" onClick={() => send({ type: 'skip', now })}>
            {t.skip}
          </Button>
          <Button variant="ghost" onClick={() => send({ type: 'stop' })}>
            {t.stop}
          </Button>
        </div>

        <FieldHint>{t.clockNote}</FieldHint>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={taskId}>{t.task}</Label>
        <Input
          id={taskId}
          value={session.task}
          placeholder={t.taskPlaceholder}
          spellCheck={false}
          onChange={(event) => send({ type: 'set-task', task: event.target.value })}
        />
        {handedTask.length > 0 ? <FieldHint>{t.taskFromMatrix}</FieldHint> : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.settings}</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['focusMinutes', t.focusMinutes],
              ['breakMinutes', t.breakMinutes],
              ['longBreakMinutes', t.longBreakMinutes],
            ] as Array<[keyof PomodoroSettings, string]>
          ).map(([field, label]) => (
            <div key={String(field)} className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-${String(field)}`}>{label}</Label>
              <Input
                id={`${fieldId}-${String(field)}`}
                value={String(settings[field])}
                inputMode="numeric"
                onChange={(event) =>
                  updateSettings({
                    [field]: clampMinutes(
                      Number(event.target.value),
                      DEFAULT_SETTINGS[field] as number,
                    ),
                  })
                }
                className="text-right font-mono"
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-rounds`}>{t.roundsBeforeLongBreak}</Label>
            <Input
              id={`${fieldId}-rounds`}
              value={String(settings.roundsBeforeLongBreak)}
              inputMode="numeric"
              min={MIN_ROUNDS}
              max={MAX_ROUNDS}
              onChange={(event) =>
                updateSettings({ roundsBeforeLongBreak: clampRounds(Number(event.target.value)) })
              }
              className="text-right font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(event) => updateSettings({ sound: event.target.checked })}
            />
            <span>{t.sound}</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(event) => {
                  if (event.target.checked) void askPermission();
                  else updateSettings({ notifications: false });
                }}
              />
              <span>{t.notifications}</span>
            </label>

            {permission === 'denied' ? (
              <FieldHint>{t.notificationsDenied}</FieldHint>
            ) : null}
            {permission === 'unsupported' ? (
              <FieldHint>{t.notificationsUnsupported}</FieldHint>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.stats}</h2>

        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">
            {format(t.todayRounds, { count: todayStat.rounds })}
          </Badge>
          <Badge tone="neutral">
            {format(t.todayMinutes, {
              count: Math.round(todayStat.focusSeconds / SECONDS_PER_MINUTE),
            })}
          </Badge>
          <Badge tone="muted">
            {format(t.totalRounds, { count: totalRounds(data.days) })}
          </Badge>
        </div>

        {nowSeconds === NO_TIME ? (
          <p className="text-sm text-muted">{t.waiting}</p>
        ) : (
          <Heatmap
            values={roundsByDay(data.days)}
            today={today}
            label={t.heatmap}
            formatTitle={(date, count) => format(t.heatmapDay, { date, count })}
          />
        )}

        {status.error !== null ? (
          <FieldError>
            {format(t.storageError, { message: status.error.message })}
          </FieldError>
        ) : null}

        <FieldHint>{t.storageNote}</FieldHint>
      </section>
    </div>
  );
}
