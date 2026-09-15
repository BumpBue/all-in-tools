import { describe, expect, it } from 'vitest';

import {
  COUNTDOWN_SCHEMA,
  EMPTY_DATA,
  MAX_EVENTS,
  countStoredItems,
  fromInputValue,
  migrate,
  pinnedEvent,
  reduce,
  remainingFrom,
  scheduleOf,
  sortEvents,
  toInputValue,
  type CountdownData,
  type CountdownEvent,
} from '@/tools/countdown/logic';

const NOW = Date.UTC(2026, 8, 15, 5, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function event(overrides: Partial<CountdownEvent> = {}): CountdownEvent {
  return { id: 'e1', name: 'สอบปลายภาค', at: NOW + DAY, pinned: false, ...overrides };
}

function dataWith(...events: CountdownEvent[]): CountdownData {
  return { ...EMPTY_DATA, events, nextId: events.length + 1 };
}

describe('remainingFrom', () => {
  it('splits the gap into days, hours, minutes and seconds', () => {
    const left = remainingFrom(NOW + 2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND, NOW);

    expect(left).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, past: false });
  });

  it('reads a moment gone by as time since, never as a negative', () => {
    const left = remainingFrom(NOW - 3 * DAY, NOW);

    expect(left.past).toBe(true);
    expect(left.days).toBe(3);
    expect(left.hours).toBeGreaterThanOrEqual(0);
  });

  it('is all zeros at the moment itself', () => {
    expect(remainingFrom(NOW, NOW)).toMatchObject({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      past: false,
    });
  });

  it('counts a whole year without losing the hours', () => {
    const left = remainingFrom(NOW + 365 * DAY + 5 * HOUR, NOW);

    expect(left.days).toBe(365);
    expect(left.hours).toBe(5);
  });

  it('never reports sixty of anything', () => {
    for (let offset = 0; offset < 200; offset += 1) {
      const left = remainingFrom(NOW + offset * 997 * SECOND, NOW);

      expect(left.seconds).toBeLessThan(60);
      expect(left.minutes).toBeLessThan(60);
      expect(left.hours).toBeLessThan(24);
    }
  });
});

describe('sorting', () => {
  it('puts the soonest first', () => {
    const sorted = sortEvents(
      [
        event({ id: 'far', at: NOW + 10 * DAY }),
        event({ id: 'soon', at: NOW + DAY }),
      ],
      NOW,
    );

    expect(sorted.map((each) => each.id)).toEqual(['soon', 'far']);
  });

  it('sinks anything already past below what is still coming', () => {
    const sorted = sortEvents(
      [event({ id: 'gone', at: NOW - DAY }), event({ id: 'coming', at: NOW + 5 * DAY })],
      NOW,
    );

    expect(sorted.map((each) => each.id)).toEqual(['coming', 'gone']);
  });

  it('orders past events by how recent they were', () => {
    const sorted = sortEvents(
      [event({ id: 'older', at: NOW - 10 * DAY }), event({ id: 'newer', at: NOW - DAY })],
      NOW,
    );

    expect(sorted.map((each) => each.id)).toEqual(['newer', 'older']);
  });

  it('puts the pinned one first whatever its date', () => {
    const sorted = sortEvents(
      [
        event({ id: 'soon', at: NOW + DAY }),
        event({ id: 'pinned', at: NOW + 100 * DAY, pinned: true }),
      ],
      NOW,
    );

    expect(sorted[0]?.id).toBe('pinned');
    expect(pinnedEvent(sorted, NOW)?.id).toBe('pinned');
  });

  it('shows the soonest at the top when nothing is pinned', () => {
    expect(
      pinnedEvent([event({ id: 'a', at: NOW + 3 * DAY }), event({ id: 'b', at: NOW + DAY })], NOW)
        ?.id,
    ).toBe('b');
  });

  it('has nothing to show for an empty list', () => {
    expect(pinnedEvent([], NOW)).toBeNull();
  });
});

describe('the datetime input', () => {
  it('round-trips a moment through the field', () => {
    const at = new Date(2026, 8, 15, 14, 30).getTime();
    expect(fromInputValue(toInputValue(at))).toBe(at);
  });

  it('writes the value the field expects', () => {
    expect(toInputValue(new Date(2026, 0, 5, 9, 7).getTime())).toBe('2026-01-05T09:07');
  });

  it('refuses something that is not a date', () => {
    expect(fromInputValue('not a date')).toBeNull();
    expect(fromInputValue('')).toBeNull();
  });
});

describe('actions', () => {
  it('adds an event', () => {
    const data = reduce(EMPTY_DATA, { type: 'add', name: 'สอบ', at: NOW + DAY });

    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({ name: 'สอบ', at: NOW + DAY, pinned: false });
  });

  it('ignores an event with no name', () => {
    expect(reduce(EMPTY_DATA, { type: 'add', name: '  ', at: NOW })).toBe(EMPTY_DATA);
  });

  it('stops at the number of events it will show', () => {
    let data = EMPTY_DATA;
    for (let index = 0; index < MAX_EVENTS + 5; index += 1) {
      data = reduce(data, { type: 'add', name: `e${index}`, at: NOW });
    }

    expect(data.events).toHaveLength(MAX_EVENTS);
  });

  it('pins one and unpins whatever was pinned before', () => {
    const data = dataWith(event({ id: 'a' }), event({ id: 'b' }));

    const first = reduce(data, { type: 'pin', id: 'a' });
    expect(first.events.filter((each) => each.pinned).map((each) => each.id)).toEqual(['a']);

    const second = reduce(first, { type: 'pin', id: 'b' });
    expect(second.events.filter((each) => each.pinned).map((each) => each.id)).toEqual(['b']);
  });

  it('unpins when the pinned one is pinned again', () => {
    const data = reduce(dataWith(event({ id: 'a' })), { type: 'pin', id: 'a' });
    expect(reduce(data, { type: 'pin', id: 'a' }).events[0]?.pinned).toBe(false);
  });

  it('renames, reschedules and removes', () => {
    const data = dataWith(event({ id: 'a' }));

    expect(reduce(data, { type: 'rename', id: 'a', name: 'ใหม่' }).events[0]?.name).toBe(
      'ใหม่',
    );
    expect(reduce(data, { type: 'reschedule', id: 'a', at: NOW + 9 }).events[0]?.at).toBe(
      NOW + 9,
    );
    expect(reduce(data, { type: 'remove', id: 'a' }).events).toHaveLength(0);
  });
});

describe('scheduleOf', () => {
  it('groups events by the day they land on', () => {
    const schedule = scheduleOf([
      event({ id: 'a', at: NOW }),
      event({ id: 'b', at: NOW + HOUR }),
      event({ id: 'c', at: NOW + 5 * DAY }),
    ]);

    expect(Object.values(schedule).reduce((sum, count) => sum + count, 0)).toBe(3);
    expect(Object.keys(schedule)).toHaveLength(2);
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = dataWith(event());
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ events: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: COUNTDOWN_SCHEMA + 1, events: [] })).toEqual(EMPTY_DATA);
  });

  it('drops an event with no name or no moment', () => {
    const repaired = migrate({
      schema: COUNTDOWN_SCHEMA,
      events: [
        { id: 'a', name: '', at: 1 },
        { id: 'b', name: 'kept', at: 0 },
        { id: 'c', name: 'also kept', at: 5 },
      ],
      nextId: 4,
    });

    expect(repaired.events.map((each) => each.name)).toEqual(['also kept']);
  });

  it('honours only one pin, whatever the file said', () => {
    const repaired = migrate({
      schema: COUNTDOWN_SCHEMA,
      events: [
        { id: 'a', name: 'a', at: 1, pinned: true },
        { id: 'b', name: 'b', at: 2, pinned: true },
      ],
      nextId: 3,
    });

    expect(repaired.events.filter((each) => each.pinned)).toHaveLength(1);
  });

  it('never hands out an id a stored event already has', () => {
    const repaired = migrate({
      schema: COUNTDOWN_SCHEMA,
      events: [{ id: 'e8', name: 'x', at: 1 }],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add', name: 'new', at: 2 });
    expect(new Set(added.events.map((each) => each.id)).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts the events', () => {
    expect(countStoredItems({ events: [1, 2] })).toBe(2);
    expect(countStoredItems(null)).toBe(0);
  });
});
