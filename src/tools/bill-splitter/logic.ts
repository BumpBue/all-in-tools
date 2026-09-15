import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const SPLITTER_SCHEMA = 1;

export const SHARE_MODES = ['equal', 'weight', 'exact'] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const MAX_GROUPS = 20;
export const MAX_PEOPLE = 30;
export const MAX_EXPENSES = 200;
export const MAX_NAME_LENGTH = 60;

/**
 * Money is held in satang, never in baht as a float. 0.1 + 0.2 is not 0.3, and
 * a bill that does not add up to the penny is a bill nobody trusts.
 */
export const SATANG_PER_BAHT = 100;

export function toSatang(baht: number): number {
  if (!Number.isFinite(baht)) return 0;
  return Math.round(baht * SATANG_PER_BAHT);
}

export function toBaht(satang: number): number {
  return satang / SATANG_PER_BAHT;
}

export function formatBaht(satang: number): string {
  return (satang / SATANG_PER_BAHT).toFixed(2);
}

export interface Person {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  /** Satang. */
  amount: number;
  paidBy: string;
  shareMode: ShareMode;
  /** Person id to weight, or to satang when the mode is exact. */
  shares: Record<string, number>;
}

export interface Group {
  id: string;
  name: string;
  people: Person[];
  expenses: Expense[];
}

export interface SplitterData {
  schema: number;
  groups: Group[];
  nextId: number;
}

export const EMPTY_DATA: SplitterData = {
  schema: SPLITTER_SCHEMA,
  groups: [],
  nextId: 1,
};

/**
 * What each person owes for one expense, in satang, adding up to exactly the
 * amount. The remainder from an uneven division goes to the first people in
 * order rather than being dropped, so three people splitting 10.00 owe 3.34,
 * 3.33 and 3.33 — not 3.33 each with a satang missing.
 */
export function sharesFor(expense: Expense, people: Person[]): Record<string, number> {
  const ids = people.map((person) => person.id);
  const owed: Record<string, number> = {};

  if (expense.shareMode === 'exact') {
    for (const id of ids) owed[id] = Math.max(0, Math.round(expense.shares[id] ?? 0));
    return owed;
  }

  const weights = new Map<string, number>();
  for (const id of ids) {
    const weight =
      expense.shareMode === 'equal'
        ? (expense.shares[id] ?? 0) > 0
          ? 1
          : 0
        : Math.max(0, expense.shares[id] ?? 0);

    if (weight > 0) weights.set(id, weight);
  }

  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    for (const id of ids) owed[id] = 0;
    return owed;
  }

  let assigned = 0;
  const entries = [...weights.entries()];

  entries.forEach(([id, weight], index) => {
    const isLast = index === entries.length - 1;
    const share = isLast
      ? expense.amount - assigned
      : Math.floor((expense.amount * weight) / total);

    owed[id] = share;
    assigned += share;
  });

  for (const id of ids) owed[id] ??= 0;
  return owed;
}

/** Positive means the group owes them; negative means they owe the group. */
export function balances(group: Group): Record<string, number> {
  const net: Record<string, number> = {};
  for (const person of group.people) net[person.id] = 0;

  for (const expense of group.expenses) {
    if (net[expense.paidBy] !== undefined) {
      net[expense.paidBy] = (net[expense.paidBy] ?? 0) + expense.amount;
    }

    const owed = sharesFor(expense, group.people);
    for (const [id, share] of Object.entries(owed)) {
      if (net[id] !== undefined) net[id] = (net[id] ?? 0) - share;
    }
  }

  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Who pays whom, taking the largest debt to the largest credit each time.
 *
 * This is the greedy settle-up, which never needs more than one transfer fewer
 * than there are people with a balance — good enough that nobody in a group
 * chat argues, and far cheaper than searching for a provably minimal set, which
 * is NP-hard. It always settles everyone exactly: what each person sends or
 * receives equals their net balance to the satang.
 */
export function settle(group: Group): Transfer[] {
  const net = balances(group);

  const creditors = Object.entries(net)
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, amount }))
    .sort((left, right) => right.amount - left.amount);

  const debtors = Object.entries(net)
    .filter(([, amount]) => amount < 0)
    .map(([id, amount]) => ({ id, amount: -amount }))
    .sort((left, right) => right.amount - left.amount);

  const transfers: Transfer[] = [];
  let creditIndex = 0;
  let debtIndex = 0;

  while (creditIndex < creditors.length && debtIndex < debtors.length) {
    const credit = creditors[creditIndex];
    const debt = debtors[debtIndex];
    if (!credit || !debt) break;

    const amount = Math.min(credit.amount, debt.amount);
    if (amount > 0) transfers.push({ from: debt.id, to: credit.id, amount });

    credit.amount -= amount;
    debt.amount -= amount;

    if (credit.amount === 0) creditIndex += 1;
    if (debt.amount === 0) debtIndex += 1;
  }

  return transfers;
}

export function groupTotal(group: Group): number {
  return group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function personName(group: Group, id: string): string {
  return group.people.find((person) => person.id === id)?.name ?? id;
}

export type SplitterAction =
  | { type: 'add-group'; name: string }
  | { type: 'rename-group'; groupId: string; name: string }
  | { type: 'remove-group'; groupId: string }
  | { type: 'add-person'; groupId: string; name: string }
  | { type: 'rename-person'; groupId: string; personId: string; name: string }
  | { type: 'remove-person'; groupId: string; personId: string }
  | { type: 'add-expense'; groupId: string; description: string; amount: number; paidBy: string }
  | { type: 'edit-expense'; groupId: string; expenseId: string; patch: Partial<Expense> }
  | { type: 'remove-expense'; groupId: string; expenseId: string };

function mapGroup(
  data: SplitterData,
  groupId: string,
  change: (group: Group) => Group,
): SplitterData {
  return {
    ...data,
    groups: data.groups.map((group) => (group.id === groupId ? change(group) : group)),
  };
}

export function reduce(data: SplitterData, action: SplitterAction): SplitterData {
  switch (action.type) {
    case 'add-group': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || data.groups.length >= MAX_GROUPS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        groups: [
          ...data.groups,
          { id: `g${data.nextId}`, name, people: [], expenses: [] },
        ],
      };
    }

    case 'rename-group':
      return mapGroup(data, action.groupId, (group) => ({ ...group, name: action.name }));

    case 'remove-group':
      return { ...data, groups: data.groups.filter((group) => group.id !== action.groupId) };

    case 'add-person': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0) return data;

      const id = `p${data.nextId}`;
      const withPerson = mapGroup(data, action.groupId, (group) =>
        group.people.length >= MAX_PEOPLE
          ? group
          : { ...group, people: [...group.people, { id, name }] },
      );

      return { ...withPerson, nextId: data.nextId + 1 };
    }

    case 'rename-person':
      return mapGroup(data, action.groupId, (group) => ({
        ...group,
        people: group.people.map((person) =>
          person.id === action.personId ? { ...person, name: action.name } : person,
        ),
      }));

    case 'remove-person':
      // Expenses they paid for go too: an expense with no payer cannot balance.
      return mapGroup(data, action.groupId, (group) => ({
        ...group,
        people: group.people.filter((person) => person.id !== action.personId),
        expenses: group.expenses
          .filter((expense) => expense.paidBy !== action.personId)
          .map((expense) => {
            const shares = { ...expense.shares };
            delete shares[action.personId];
            return { ...expense, shares };
          }),
      }));

    case 'add-expense': {
      const id = `e${data.nextId}`;
      const withExpense = mapGroup(data, action.groupId, (group) => {
        if (group.expenses.length >= MAX_EXPENSES) return group;

        return {
          ...group,
          expenses: [
            ...group.expenses,
            {
              id,
              description: action.description.slice(0, MAX_NAME_LENGTH),
              amount: Math.max(0, Math.round(action.amount)),
              paidBy: action.paidBy,
              shareMode: 'equal' as ShareMode,
              shares: Object.fromEntries(group.people.map((person) => [person.id, 1])),
            },
          ],
        };
      });

      return { ...withExpense, nextId: data.nextId + 1 };
    }

    case 'edit-expense':
      return mapGroup(data, action.groupId, (group) => ({
        ...group,
        expenses: group.expenses.map((expense) =>
          expense.id === action.expenseId ? { ...expense, ...action.patch } : expense,
        ),
      }));

    default:
      return mapGroup(data, action.groupId, (group) => ({
        ...group,
        expenses: group.expenses.filter((expense) => expense.id !== action.expenseId),
      }));
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data) || !Array.isArray(data.groups)) return 0;

  return data.groups.reduce((sum: number, group: unknown) => {
    if (!isRecord(group) || !Array.isArray(group.expenses)) return sum;
    return sum + group.expenses.length;
  }, 0);
}

function migrateShares(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};

  const shares: Record<string, number> = {};
  for (const [id, value] of Object.entries(raw)) shares[id] = asNumber(value, 0);
  return shares;
}

export function migrate(raw: unknown): SplitterData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > SPLITTER_SCHEMA) return EMPTY_DATA;

  const groups = asArray(raw.groups)
    .slice(0, MAX_GROUPS)
    .filter(isRecord)
    .map((group, index) => {
      const people = asArray(group.people)
        .slice(0, MAX_PEOPLE)
        .filter(isRecord)
        .map((person, position) => ({
          id: asString(person.id, `p${position}`),
          name: asString(person.name).slice(0, MAX_NAME_LENGTH),
        }))
        .filter((person) => person.name.length > 0);

      const known = new Set(people.map((person) => person.id));

      return {
        id: asString(group.id, `g${index}`),
        name: asString(group.name).slice(0, MAX_NAME_LENGTH),
        people,
        expenses: asArray(group.expenses)
          .slice(0, MAX_EXPENSES)
          .filter(isRecord)
          .map((expense, position) => ({
            id: asString(expense.id, `e${position}`),
            description: asString(expense.description).slice(0, MAX_NAME_LENGTH),
            amount: Math.max(0, Math.round(asNumber(expense.amount, 0))),
            paidBy: asString(expense.paidBy),
            shareMode: SHARE_MODES.includes(asString(expense.shareMode) as ShareMode)
              ? (expense.shareMode as ShareMode)
              : 'equal',
            shares: migrateShares(expense.shares),
          }))
          // An expense paid by somebody no longer in the group cannot balance.
          .filter((expense) => known.has(expense.paidBy)),
      };
    })
    .filter((group) => group.name.length > 0);

  const highest = groups
    .flatMap((group) => [
      group.id,
      ...group.people.map((person) => person.id),
      ...group.expenses.map((expense) => expense.id),
    ])
    .reduce((top, id) => {
      const numeric = Number(id.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
    }, 0);

  return {
    schema: SPLITTER_SCHEMA,
    groups,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}
