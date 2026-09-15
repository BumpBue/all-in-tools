import { addDays, daysBetween, isDayKey, toDayKey } from '@/lib/day';
import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const SUBSCRIPTION_SCHEMA = 1;

export const CYCLES = ['monthly', 'yearly', 'weekly', 'custom'] as const;
export type Cycle = (typeof CYCLES)[number];

export const MAX_SUBSCRIPTIONS = 60;
export const MAX_NAME_LENGTH = 60;
export const SOON_DAYS = 7;
export const STALE_DAYS = 60;

const MONTHS_PER_YEAR = 12;
const WEEKS_PER_YEAR = 52;
const DAYS_PER_YEAR = 365;
export const SATANG_PER_BAHT = 100;

export function toSatang(baht: number): number {
  if (!Number.isFinite(baht)) return 0;
  return Math.round(baht * SATANG_PER_BAHT);
}

export function formatBaht(satang: number): string {
  return (satang / SATANG_PER_BAHT).toFixed(2);
}

export interface Subscription {
  id: string;
  name: string;
  /** Satang, per cycle. */
  price: number;
  cycle: Cycle;
  /** Days between charges; only meaningful when the cycle is custom. */
  customDays: number;
  nextCharge: string;
  category: string;
  startedOn: string;
  lastUsedOn: string;
}

export interface SubscriptionData {
  schema: number;
  subscriptions: Subscription[];
  nextId: number;
}

export const EMPTY_DATA: SubscriptionData = {
  schema: SUBSCRIPTION_SCHEMA,
  subscriptions: [],
  nextId: 1,
};

export function cycleDays(item: Subscription): number {
  if (item.cycle === 'weekly') return 7;
  if (item.cycle === 'monthly') return DAYS_PER_YEAR / MONTHS_PER_YEAR;
  if (item.cycle === 'yearly') return DAYS_PER_YEAR;

  return Math.max(1, Math.round(item.customDays));
}

/**
 * Everything is normalised to a month so a total means something. A yearly
 * plan is not a twelfth of the attention of a monthly one, but it is a twelfth
 * of the money, and the money is what is being added up.
 */
export function monthlySatang(item: Subscription): number {
  if (item.cycle === 'monthly') return item.price;
  if (item.cycle === 'yearly') return Math.round(item.price / MONTHS_PER_YEAR);
  if (item.cycle === 'weekly') return Math.round((item.price * WEEKS_PER_YEAR) / MONTHS_PER_YEAR);

  const perYear = (item.price * DAYS_PER_YEAR) / cycleDays(item);
  return Math.round(perYear / MONTHS_PER_YEAR);
}

export function yearlySatang(item: Subscription): number {
  return monthlySatang(item) * MONTHS_PER_YEAR;
}

export function totalMonthly(items: Subscription[]): number {
  return items.reduce((sum, item) => sum + monthlySatang(item), 0);
}

export function byCategory(items: Subscription[]): Array<{
  category: string;
  monthly: number;
  count: number;
}> {
  const totals = new Map<string, { monthly: number; count: number }>();

  for (const item of items) {
    const key = item.category.trim();
    const current = totals.get(key) ?? { monthly: 0, count: 0 };

    totals.set(key, {
      monthly: current.monthly + monthlySatang(item),
      count: current.count + 1,
    });
  }

  return [...totals.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((left, right) => right.monthly - left.monthly);
}

export function daysUntilCharge(item: Subscription, today: string): number | null {
  if (!isDayKey(item.nextCharge)) return null;
  return daysBetween(today, item.nextCharge);
}

export function isDueSoon(item: Subscription, today: string): boolean {
  const days = daysUntilCharge(item, today);
  return days !== null && days >= 0 && days <= SOON_DAYS;
}

export function isOverdue(item: Subscription, today: string): boolean {
  const days = daysUntilCharge(item, today);
  return days !== null && days < 0;
}

/**
 * What has gone out since the subscription started, counted in whole charges
 * that have actually happened. Estimating a fraction of a charge would invent
 * money nobody paid.
 */
export function paidSoFar(item: Subscription, today: string): number | null {
  if (!isDayKey(item.startedOn)) return null;

  const elapsed = daysBetween(item.startedOn, today);
  if (elapsed < 0) return 0;

  const charges = Math.floor(elapsed / cycleDays(item)) + 1;
  return charges * item.price;
}

export function daysSinceUsed(item: Subscription, today: string): number | null {
  if (!isDayKey(item.lastUsedOn)) return null;
  return daysBetween(item.lastUsedOn, today);
}

/** Only ever from what the reader said, never guessed from anything else. */
export function isStale(item: Subscription, today: string): boolean {
  const days = daysSinceUsed(item, today);
  return days !== null && days >= STALE_DAYS;
}

/** Moves the charge date forward by whole cycles until it is in the future. */
export function advanceCharge(item: Subscription, today: string): string {
  if (!isDayKey(item.nextCharge)) return item.nextCharge;

  const step = Math.max(1, Math.round(cycleDays(item)));
  let next = item.nextCharge;
  let guard = 0;

  while (daysBetween(today, next) < 0 && guard < 1_000) {
    next = addDays(next, step);
    guard += 1;
  }

  return next;
}

export type SubscriptionAction =
  | { type: 'add'; name: string; today: string }
  | { type: 'edit'; id: string; patch: Partial<Subscription> }
  | { type: 'remove'; id: string }
  | { type: 'mark-used'; id: string; today: string }
  | { type: 'advance'; id: string; today: string };

export function reduce(
  data: SubscriptionData,
  action: SubscriptionAction,
): SubscriptionData {
  switch (action.type) {
    case 'add': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || data.subscriptions.length >= MAX_SUBSCRIPTIONS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        subscriptions: [
          ...data.subscriptions,
          {
            id: `s${data.nextId}`,
            name,
            price: 0,
            cycle: 'monthly',
            customDays: 30,
            nextCharge: addDays(action.today, 30),
            category: '',
            startedOn: action.today,
            lastUsedOn: action.today,
          },
        ],
      };
    }

    case 'edit':
      return {
        ...data,
        subscriptions: data.subscriptions.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      };

    case 'remove':
      return {
        ...data,
        subscriptions: data.subscriptions.filter((item) => item.id !== action.id),
      };

    case 'mark-used':
      return {
        ...data,
        subscriptions: data.subscriptions.map((item) =>
          item.id === action.id ? { ...item, lastUsedOn: action.today } : item,
        ),
      };

    default:
      return {
        ...data,
        subscriptions: data.subscriptions.map((item) =>
          item.id === action.id
            ? { ...item, nextCharge: advanceCharge(item, action.today) }
            : item,
        ),
      };
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return Array.isArray(data.subscriptions) ? data.subscriptions.length : 0;
}

export function migrate(raw: unknown): SubscriptionData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > SUBSCRIPTION_SCHEMA) {
    return EMPTY_DATA;
  }

  const subscriptions = asArray(raw.subscriptions)
    .slice(0, MAX_SUBSCRIPTIONS)
    .filter(isRecord)
    .map((item, index) => {
      const dayOr = (value: unknown) => {
        const text = asString(value, '');
        return isDayKey(text) ? text : '';
      };

      return {
        id: asString(item.id, `s${index}`),
        name: asString(item.name).slice(0, MAX_NAME_LENGTH),
        price: Math.max(0, Math.round(asNumber(item.price, 0))),
        cycle: CYCLES.includes(asString(item.cycle) as Cycle)
          ? (item.cycle as Cycle)
          : 'monthly',
        customDays: Math.max(1, Math.round(asNumber(item.customDays, 30))),
        nextCharge: dayOr(item.nextCharge),
        category: asString(item.category).slice(0, MAX_NAME_LENGTH),
        startedOn: dayOr(item.startedOn),
        lastUsedOn: dayOr(item.lastUsedOn),
      };
    })
    .filter((item) => item.name.length > 0);

  const highest = subscriptions.reduce((top, item) => {
    const numeric = Number(item.id.replace(/\D/g, ''));
    return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
  }, 0);

  return {
    schema: SUBSCRIPTION_SCHEMA,
    subscriptions,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}

export function todayKey(now: number): string {
  return toDayKey(now);
}
