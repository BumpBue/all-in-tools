import { toDayKey } from '@/lib/day';
import { asBoolean, asNumber, isRecord, storedSchema } from '@/lib/schema';

export const POMODORO_SCHEMA = 1;

export const PHASES = ['focus', 'break', 'long-break'] as const;
export type Phase = (typeof PHASES)[number];

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;
export const MIN_ROUNDS = 2;
export const MAX_ROUNDS = 12;
export const MAX_TASK_LENGTH = 80;

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
  sound: boolean;
  notifications: boolean;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  sound: true,
  notifications: false,
};

export interface Session {
  phase: Phase;
  /** Completed focus rounds since the last long break. */
  round: number;
  /**
   * When the current phase ends, as a wall-clock instant. Counting down from
   * an end time rather than adding up ticks is what makes a backgrounded tab
   * come back with the right answer: browsers throttle timers, but they cannot
   * move the clock.
   */
  endsAt: number | null;
  /** Set instead of endsAt while paused. */
  remainingMs: number | null;
  task: string;
}

export const IDLE_SESSION: Session = {
  phase: 'focus',
  round: 0,
  endsAt: null,
  remainingMs: null,
  task: '',
};

export interface DayStat {
  rounds: number;
  focusSeconds: number;
}

export interface PomodoroData {
  schema: number;
  settings: PomodoroSettings;
  days: Record<string, DayStat>;
  session: Session;
}

export const EMPTY_DATA: PomodoroData = {
  schema: POMODORO_SCHEMA,
  settings: DEFAULT_SETTINGS,
  days: {},
  session: IDLE_SESSION,
};

export function phaseMinutes(phase: Phase, settings: PomodoroSettings): number {
  if (phase === 'focus') return settings.focusMinutes;
  if (phase === 'break') return settings.breakMinutes;
  return settings.longBreakMinutes;
}

export function phaseMs(phase: Phase, settings: PomodoroSettings): number {
  return phaseMinutes(phase, settings) * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
}

export function isRunning(session: Session): boolean {
  return session.endsAt !== null;
}

export function isPaused(session: Session): boolean {
  return session.remainingMs !== null;
}

export function remainingMs(session: Session, now: number, settings: PomodoroSettings): number {
  if (session.endsAt !== null) return Math.max(0, session.endsAt - now);
  if (session.remainingMs !== null) return session.remainingMs;

  return phaseMs(session.phase, settings);
}

/** focus → break, or → long break once enough rounds are behind it. */
export function nextPhase(session: Session, settings: PomodoroSettings): Phase {
  if (session.phase !== 'focus') return 'focus';

  const completed = session.round + 1;
  return completed % Math.max(MIN_ROUNDS, settings.roundsBeforeLongBreak) === 0
    ? 'long-break'
    : 'break';
}

export type PomodoroAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'stop' }
  | { type: 'complete'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'set-task'; task: string }
  | { type: 'settings'; settings: PomodoroSettings };

function addStat(
  days: Record<string, DayStat>,
  now: number,
  focusSeconds: number,
): Record<string, DayStat> {
  const key = toDayKey(now);
  const current = days[key] ?? { rounds: 0, focusSeconds: 0 };

  return {
    ...days,
    [key]: {
      rounds: current.rounds + 1,
      focusSeconds: current.focusSeconds + focusSeconds,
    },
  };
}

/**
 * Every action carries the time it happened rather than reading a clock, which
 * keeps this a pure function and makes the whole timer testable without
 * waiting for anything.
 */
export function reduce(data: PomodoroData, action: PomodoroAction): PomodoroData {
  const { session, settings } = data;

  switch (action.type) {
    case 'start': {
      if (isRunning(session)) return data;

      const duration =
        session.remainingMs ?? phaseMs(session.phase, settings);

      return {
        ...data,
        session: { ...session, endsAt: action.now + duration, remainingMs: null },
      };
    }

    case 'pause': {
      if (!isRunning(session)) return data;

      return {
        ...data,
        session: {
          ...session,
          endsAt: null,
          remainingMs: Math.max(0, (session.endsAt ?? action.now) - action.now),
        },
      };
    }

    case 'resume': {
      if (session.remainingMs === null) return data;

      return {
        ...data,
        session: {
          ...session,
          endsAt: action.now + session.remainingMs,
          remainingMs: null,
        },
      };
    }

    case 'stop':
      return { ...data, session: { ...IDLE_SESSION, task: session.task } };

    case 'complete':
    case 'skip': {
      const wasFocus = session.phase === 'focus';
      const counts = wasFocus && action.type === 'complete';

      const phase = nextPhase(session, settings);
      const round = wasFocus ? session.round + 1 : session.round;

      return {
        ...data,
        days: counts
          ? addStat(data.days, action.now, settings.focusMinutes * SECONDS_PER_MINUTE)
          : data.days,
        session: {
          ...session,
          phase,
          round: phase === 'focus' && session.phase === 'long-break' ? 0 : round,
          endsAt: null,
          remainingMs: null,
        },
      };
    }

    case 'set-task':
      return {
        ...data,
        session: { ...session, task: action.task.slice(0, MAX_TASK_LENGTH) },
      };

    default:
      return { ...data, settings: action.settings };
  }
}

export function clampMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

export function clampRounds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.roundsBeforeLongBreak;
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(value)));
}

export function formatClock(milliseconds: number): string {
  const total = Math.ceil(Math.max(0, milliseconds) / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function totalRounds(days: Record<string, DayStat>): number {
  return Object.values(days).reduce((sum, day) => sum + day.rounds, 0);
}

export function roundsByDay(days: Record<string, DayStat>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(days).map(([key, stat]) => [key, stat.rounds]),
  );
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return isRecord(data.days) ? Object.keys(data.days).length : 0;
}

function migrateSettings(value: unknown): PomodoroSettings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;

  return {
    focusMinutes: clampMinutes(
      asNumber(value.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
      DEFAULT_SETTINGS.focusMinutes,
    ),
    breakMinutes: clampMinutes(
      asNumber(value.breakMinutes, DEFAULT_SETTINGS.breakMinutes),
      DEFAULT_SETTINGS.breakMinutes,
    ),
    longBreakMinutes: clampMinutes(
      asNumber(value.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes),
      DEFAULT_SETTINGS.longBreakMinutes,
    ),
    roundsBeforeLongBreak: clampRounds(
      asNumber(value.roundsBeforeLongBreak, DEFAULT_SETTINGS.roundsBeforeLongBreak),
    ),
    sound: asBoolean(value.sound, DEFAULT_SETTINGS.sound),
    notifications: asBoolean(value.notifications, DEFAULT_SETTINGS.notifications),
  };
}

function migrateSession(value: unknown): Session {
  if (!isRecord(value)) return IDLE_SESSION;

  const phase = PHASES.includes(value.phase as Phase) ? (value.phase as Phase) : 'focus';

  return {
    phase,
    round: Math.max(0, asNumber(value.round, 0)),
    endsAt: typeof value.endsAt === 'number' ? value.endsAt : null,
    remainingMs: typeof value.remainingMs === 'number' ? value.remainingMs : null,
    task: String(value.task ?? '').slice(0, MAX_TASK_LENGTH),
  };
}

function migrateDays(value: unknown): Record<string, DayStat> {
  if (!isRecord(value)) return {};

  const days: Record<string, DayStat> = {};
  for (const [key, stat] of Object.entries(value)) {
    if (!isRecord(stat)) continue;

    days[key] = {
      rounds: Math.max(0, asNumber(stat.rounds, 0)),
      focusSeconds: Math.max(0, asNumber(stat.focusSeconds, 0)),
    };
  }

  return days;
}

/**
 * Turns whatever was in storage into something this version can use. There is
 * only one schema so far, so the older branches are empty — but the shape is
 * here, because the first person to change the schema should not also have to
 * invent the place to put the change.
 */
export function migrate(raw: unknown): PomodoroData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw)) return EMPTY_DATA;

  if (version > POMODORO_SCHEMA) return EMPTY_DATA;

  return {
    schema: POMODORO_SCHEMA,
    settings: migrateSettings(raw.settings),
    days: migrateDays(raw.days),
    session: migrateSession(raw.session),
  };
}
