import { toDayKey } from '@/lib/day';
import { asArray, asBoolean, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const COUNTDOWN_SCHEMA = 1;

export const MAX_EVENTS = 30;
export const MAX_NAME_LENGTH = 80;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface CountdownEvent {
  id: string;
  name: string;
  /** The moment itself, in milliseconds. */
  at: number;
  pinned: boolean;
}

export interface CountdownData {
  schema: number;
  events: CountdownEvent[];
  nextId: number;
}

export const EMPTY_DATA: CountdownData = {
  schema: COUNTDOWN_SCHEMA,
  events: [],
  nextId: 1,
};

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the moment has been and gone. */
  past: boolean;
  totalMs: number;
}

/**
 * Split into units from the absolute gap, so a moment in the past reads as
 * "three days ago" rather than as a negative countdown.
 */
export function remainingFrom(at: number, now: number): Remaining {
  const difference = at - now;
  const gap = Math.abs(difference);

  return {
    days: Math.floor(gap / DAY_MS),
    hours: Math.floor((gap % DAY_MS) / HOUR_MS),
    minutes: Math.floor((gap % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((gap % MINUTE_MS) / SECOND_MS),
    past: difference < 0,
    totalMs: gap,
  };
}

/** Pinned first, then whatever happens soonest; past events sink to the end. */
export function sortEvents(events: CountdownEvent[], now: number): CountdownEvent[] {
  return [...events].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;

    const leftPast = left.at < now;
    const rightPast = right.at < now;
    if (leftPast !== rightPast) return leftPast ? 1 : -1;

    return leftPast ? right.at - left.at : left.at - right.at;
  });
}

export function pinnedEvent(
  events: CountdownEvent[],
  now: number,
): CountdownEvent | null {
  return sortEvents(events, now)[0] ?? null;
}

/** The value a datetime-local input wants, in the reader's own zone. */
export function toInputValue(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T');
}

export function fromInputValue(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function dayKeyOf(at: number): string {
  return toDayKey(at);
}

export type CountdownAction =
  | { type: 'add'; name: string; at: number }
  | { type: 'rename'; id: string; name: string }
  | { type: 'reschedule'; id: string; at: number }
  | { type: 'pin'; id: string }
  | { type: 'remove'; id: string };

export function reduce(data: CountdownData, action: CountdownAction): CountdownData {
  switch (action.type) {
    case 'add': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || data.events.length >= MAX_EVENTS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        events: [
          ...data.events,
          { id: `e${data.nextId}`, name, at: action.at, pinned: false },
        ],
      };
    }

    case 'rename':
      return {
        ...data,
        events: data.events.map((event) =>
          event.id === action.id
            ? { ...event, name: action.name.slice(0, MAX_NAME_LENGTH) }
            : event,
        ),
      };

    case 'reschedule':
      return {
        ...data,
        events: data.events.map((event) =>
          event.id === action.id ? { ...event, at: action.at } : event,
        ),
      };

    case 'pin':
      // Only one at a time: the point is a single thing at the top.
      return {
        ...data,
        events: data.events.map((event) => ({
          ...event,
          pinned: event.id === action.id ? !event.pinned : false,
        })),
      };

    default:
      return { ...data, events: data.events.filter((event) => event.id !== action.id) };
  }
}

export function scheduleOf(events: CountdownEvent[]): Record<string, number> {
  const schedule: Record<string, number> = {};
  for (const event of events) {
    const day = dayKeyOf(event.at);
    schedule[day] = (schedule[day] ?? 0) + 1;
  }

  return schedule;
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return Array.isArray(data.events) ? data.events.length : 0;
}

export function migrate(raw: unknown): CountdownData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > COUNTDOWN_SCHEMA) return EMPTY_DATA;

  const events = asArray(raw.events)
    .slice(0, MAX_EVENTS)
    .filter(isRecord)
    .map((event, index) => ({
      id: asString(event.id, `e${index}`),
      name: asString(event.name).slice(0, MAX_NAME_LENGTH),
      at: asNumber(event.at, 0),
      pinned: asBoolean(event.pinned),
    }))
    .filter((event) => event.name.length > 0 && event.at > 0);

  const highest = events.reduce((top, event) => {
    const numeric = Number(event.id.replace(/\D/g, ''));
    return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
  }, 0);

  // Only one pin can be honoured, whatever the file said.
  let seenPin = false;
  const single = events.map((event) => {
    if (!event.pinned) return event;
    if (seenPin) return { ...event, pinned: false };

    seenPin = true;
    return event;
  });

  return {
    schema: COUNTDOWN_SCHEMA,
    events: single,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}
