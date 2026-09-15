import { describe, expect, it } from 'vitest';

import { toDayKey } from '@/lib/day';
import {
  DEFAULT_SETTINGS,
  EMPTY_DATA,
  IDLE_SESSION,
  MAX_MINUTES,
  MAX_ROUNDS,
  MIN_MINUTES,
  MIN_ROUNDS,
  POMODORO_SCHEMA,
  clampMinutes,
  clampRounds,
  countStoredItems,
  formatClock,
  isPaused,
  isRunning,
  migrate,
  nextPhase,
  phaseMs,
  reduce,
  remainingMs,
  roundsByDay,
  totalRounds,
  type PomodoroData,
} from '@/tools/pomodoro/logic';

const NOW = Date.UTC(2026, 8, 15, 5, 0);
const MINUTE = 60_000;

function fresh(): PomodoroData {
  return { ...EMPTY_DATA, days: {}, session: { ...IDLE_SESSION } };
}

function started(now = NOW): PomodoroData {
  return reduce(fresh(), { type: 'start', now });
}

describe('starting and stopping', () => {
  it('sets an end time rather than counting ticks', () => {
    const data = started();

    expect(data.session.endsAt).toBe(NOW + 25 * MINUTE);
    expect(isRunning(data.session)).toBe(true);
  });

  it('is not running before it is started', () => {
    expect(isRunning(fresh().session)).toBe(false);
    expect(remainingMs(fresh().session, NOW, DEFAULT_SETTINGS)).toBe(25 * MINUTE);
  });

  it('ignores a second start', () => {
    const once = started();
    expect(reduce(once, { type: 'start', now: NOW + 5000 })).toBe(once);
  });

  it('counts down from the end time, so a throttled tab still reads true', () => {
    const data = started();
    // The tab slept for ten minutes; nothing ticked, but the clock moved.
    expect(remainingMs(data.session, NOW + 10 * MINUTE, DEFAULT_SETTINGS)).toBe(
      15 * MINUTE,
    );
  });

  it('never counts below zero', () => {
    const data = started();
    expect(remainingMs(data.session, NOW + 60 * MINUTE, DEFAULT_SETTINGS)).toBe(0);
  });

  it('stops back to the beginning but keeps the task', () => {
    const working = reduce(started(), { type: 'set-task', task: 'เขียนรายงาน' });
    const stopped = reduce(working, { type: 'stop' });

    expect(stopped.session.endsAt).toBeNull();
    expect(stopped.session.round).toBe(0);
    expect(stopped.session.task).toBe('เขียนรายงาน');
  });
});

describe('pausing', () => {
  it('keeps what was left rather than the end time', () => {
    const paused = reduce(started(), { type: 'pause', now: NOW + 10 * MINUTE });

    expect(paused.session.endsAt).toBeNull();
    expect(paused.session.remainingMs).toBe(15 * MINUTE);
    expect(isPaused(paused.session)).toBe(true);
  });

  it('resumes from where it stopped, however long the pause was', () => {
    const paused = reduce(started(), { type: 'pause', now: NOW + 10 * MINUTE });
    const resumed = reduce(paused, { type: 'resume', now: NOW + 60 * MINUTE });

    expect(resumed.session.endsAt).toBe(NOW + 75 * MINUTE);
    expect(remainingMs(resumed.session, NOW + 60 * MINUTE, DEFAULT_SETTINGS)).toBe(
      15 * MINUTE,
    );
  });

  it('does nothing when there is nothing to pause or resume', () => {
    const idle = fresh();
    expect(reduce(idle, { type: 'pause', now: NOW })).toBe(idle);
    expect(reduce(idle, { type: 'resume', now: NOW })).toBe(idle);
  });
});

describe('phases', () => {
  it('goes from focus to a short break', () => {
    const done = reduce(started(), { type: 'complete', now: NOW + 25 * MINUTE });
    expect(done.session.phase).toBe('break');
  });

  it('goes to a long break after the set number of rounds', () => {
    let data = fresh();

    for (let round = 0; round < 4; round += 1) {
      data = reduce(data, { type: 'start', now: NOW });
      data = reduce(data, { type: 'complete', now: NOW + 25 * MINUTE });
      if (data.session.phase !== 'long-break') {
        data = reduce(data, { type: 'complete', now: NOW });
      }
    }

    expect(data.session.phase).toBe('long-break');
  });

  it('starts counting again after the long break', () => {
    const afterLong = reduce(
      { ...fresh(), session: { ...IDLE_SESSION, phase: 'long-break', round: 4 } },
      { type: 'complete', now: NOW },
    );

    expect(afterLong.session.phase).toBe('focus');
    expect(afterLong.session.round).toBe(0);
  });

  it('works out the next phase without changing anything', () => {
    expect(nextPhase({ ...IDLE_SESSION, round: 0 }, DEFAULT_SETTINGS)).toBe('break');
    expect(nextPhase({ ...IDLE_SESSION, round: 3 }, DEFAULT_SETTINGS)).toBe('long-break');
    expect(nextPhase({ ...IDLE_SESSION, phase: 'break' }, DEFAULT_SETTINGS)).toBe('focus');
  });

  it('uses the right length for each phase', () => {
    expect(phaseMs('focus', DEFAULT_SETTINGS)).toBe(25 * MINUTE);
    expect(phaseMs('break', DEFAULT_SETTINGS)).toBe(5 * MINUTE);
    expect(phaseMs('long-break', DEFAULT_SETTINGS)).toBe(15 * MINUTE);
  });
});

describe('statistics', () => {
  it('records a finished focus round against the day it finished', () => {
    const done = reduce(started(), { type: 'complete', now: NOW + 25 * MINUTE });
    const key = toDayKey(NOW + 25 * MINUTE);

    expect(done.days[key]).toEqual({ rounds: 1, focusSeconds: 25 * 60 });
  });

  it('does not record a skipped round, which was not worked', () => {
    const skipped = reduce(started(), { type: 'skip', now: NOW + MINUTE });
    expect(Object.keys(skipped.days)).toHaveLength(0);
  });

  it('does not record a finished break as work', () => {
    const afterFocus = reduce(started(), { type: 'complete', now: NOW });
    const afterBreak = reduce(
      reduce(afterFocus, { type: 'start', now: NOW }),
      { type: 'complete', now: NOW },
    );

    expect(totalRounds(afterBreak.days)).toBe(1);
  });

  it('adds up rounds across a day', () => {
    let data = fresh();
    for (let round = 0; round < 3; round += 1) {
      data = reduce(data, { type: 'start', now: NOW });
      data = reduce(data, { type: 'complete', now: NOW });
      data = reduce(data, { type: 'skip', now: NOW });
    }

    expect(totalRounds(data.days)).toBe(3);
    expect(roundsByDay(data.days)[toDayKey(NOW)]).toBe(3);
  });

  it('keeps days apart', () => {
    const later = NOW + 3 * 86_400_000;

    // Finish a focus round today, skip past the break, finish one in three
    // days' time. Only focus rounds are recorded, so the break is stepped over.
    const today = reduce(started(), { type: 'complete', now: NOW });
    const pastBreak = reduce(today, { type: 'skip', now: NOW });
    const another = reduce(pastBreak, { type: 'start', now: later });
    const second = reduce(another, { type: 'complete', now: later });

    expect(Object.keys(second.days).sort()).toEqual([toDayKey(NOW), toDayKey(later)]);
  });
});

describe('the task it is timing', () => {
  it('remembers one', () => {
    expect(reduce(fresh(), { type: 'set-task', task: 'อ่านหนังสือ' }).session.task).toBe(
      'อ่านหนังสือ',
    );
  });

  it('cuts one too long to show', () => {
    const long = 'ก'.repeat(500);
    expect(
      reduce(fresh(), { type: 'set-task', task: long }).session.task.length,
    ).toBeLessThanOrEqual(80);
  });
});

describe('formatClock', () => {
  it('writes minutes and seconds', () => {
    expect(formatClock(25 * MINUTE)).toBe('25:00');
    expect(formatClock(61_000)).toBe('01:01');
  });

  it('rounds up, so a timer never shows 00:00 while it is still running', () => {
    expect(formatClock(500)).toBe('00:01');
  });

  it('shows nothing left as zero', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('settings', () => {
  it('holds minutes inside what a timer can mean', () => {
    expect(clampMinutes(0, 25)).toBe(MIN_MINUTES);
    expect(clampMinutes(9999, 25)).toBe(MAX_MINUTES);
    expect(clampMinutes(Number.NaN, 25)).toBe(25);
  });

  it('holds the round count inside range', () => {
    expect(clampRounds(1)).toBe(MIN_ROUNDS);
    expect(clampRounds(99)).toBe(MAX_ROUNDS);
  });

  it('changes the length of the next phase', () => {
    const data = reduce(fresh(), {
      type: 'settings',
      settings: { ...DEFAULT_SETTINGS, focusMinutes: 50 },
    });

    expect(phaseMs('focus', data.settings)).toBe(50 * MINUTE);
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = reduce(started(), { type: 'complete', now: NOW });
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything that is not this tool', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate('text')).toEqual(EMPTY_DATA);
    expect(migrate({})).toEqual(EMPTY_DATA);
    expect(migrate([])).toEqual(EMPTY_DATA);
  });

  it('starts fresh rather than guessing at a schema from the future', () => {
    expect(migrate({ schema: POMODORO_SCHEMA + 1, days: { x: 1 } })).toEqual(EMPTY_DATA);
  });

  it('repairs a field that is the wrong type instead of throwing', () => {
    const repaired = migrate({
      schema: POMODORO_SCHEMA,
      settings: { focusMinutes: 'twenty five', sound: 'yes' },
      days: { '2026-09-15': { rounds: 'three' } },
      session: { phase: 'nap', round: -5 },
    });

    expect(repaired.settings.focusMinutes).toBe(DEFAULT_SETTINGS.focusMinutes);
    expect(repaired.settings.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(repaired.days['2026-09-15']).toEqual({ rounds: 0, focusSeconds: 0 });
    expect(repaired.session.phase).toBe('focus');
    expect(repaired.session.round).toBe(0);
  });

  it('keeps a session that was running, so a reload carries on', () => {
    const running = migrate({
      schema: POMODORO_SCHEMA,
      settings: DEFAULT_SETTINGS,
      days: {},
      session: { phase: 'focus', round: 1, endsAt: NOW + MINUTE, remainingMs: null, task: '' },
    });

    expect(running.session.endsAt).toBe(NOW + MINUTE);
    expect(isRunning(running.session)).toBe(true);
  });
});

describe('countStoredItems', () => {
  it('counts the days recorded', () => {
    expect(countStoredItems({ days: { a: {}, b: {} } })).toBe(2);
  });

  it('counts nothing for a shape it does not know', () => {
    expect(countStoredItems(null)).toBe(0);
    expect(countStoredItems({ days: 'none' })).toBe(0);
  });
});
