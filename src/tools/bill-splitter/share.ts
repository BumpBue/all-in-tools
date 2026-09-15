import {
  MAX_EXPENSES,
  MAX_NAME_LENGTH,
  MAX_PEOPLE,
  SHARE_MODES,
  type Expense,
  type Group,
  type ShareMode,
} from '@/tools/bill-splitter/logic';

/**
 * One group, small enough to travel in a link.
 *
 * Shared as JSON rather than a separator format: a name may hold anything a
 * reader types. Ids are rewritten on the way in, so a shared group can be
 * saved beside groups that already exist without two of them claiming the
 * same id.
 */
export function encodeGroup(group: Group): string {
  return JSON.stringify([
    group.name,
    group.people.map((person) => [person.id, person.name]),
    group.expenses.map((expense) => [
      expense.description,
      expense.amount,
      expense.paidBy,
      expense.shareMode,
      Object.entries(expense.shares),
    ]),
  ]);
}

function asPairs(value: unknown): Array<[string, unknown]> {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (pair): pair is [string, unknown] =>
      Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string',
  );
}

export function decodeGroup(raw: string | undefined, id: string): Group | null {
  if (raw === undefined || raw.trim().length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) return null;

  const [name, rawPeople, rawExpenses] = parsed;
  if (typeof name !== 'string' || name.trim().length === 0) return null;

  const people = asPairs(rawPeople)
    .slice(0, MAX_PEOPLE)
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string')
    .map(([personId, personName]) => ({
      id: personId,
      name: personName.slice(0, MAX_NAME_LENGTH),
    }))
    .filter((person) => person.name.length > 0);

  const known = new Set(people.map((person) => person.id));

  const expenses: Expense[] = (Array.isArray(rawExpenses) ? rawExpenses : [])
    .slice(0, MAX_EXPENSES)
    .filter(
      (entry): entry is [string, number, string, string, Array<[string, number]>] =>
        Array.isArray(entry) &&
        entry.length === 5 &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'number' &&
        typeof entry[2] === 'string',
    )
    .map((entry, index) => ({
      id: `s${index}`,
      description: entry[0].slice(0, MAX_NAME_LENGTH),
      amount: Math.max(0, Math.round(entry[1])),
      paidBy: entry[2],
      shareMode: SHARE_MODES.includes(entry[3] as ShareMode)
        ? (entry[3] as ShareMode)
        : 'equal',
      shares: Object.fromEntries(
        asPairs(entry[4])
          .filter((pair): pair is [string, number] => typeof pair[1] === 'number')
          .filter(([personId]) => known.has(personId)),
      ),
    }))
    .filter((expense) => known.has(expense.paidBy));

  return { id, name: name.slice(0, MAX_NAME_LENGTH), people, expenses };
}

/**
 * Rewrites every id so a shared group can sit beside saved ones. Without this,
 * saving a link twice would produce two groups whose people share ids, and
 * editing one would move the other.
 */
export function withFreshIds(group: Group, startId: number): { group: Group; nextId: number } {
  let next = startId;

  const groupId = `g${next}`;
  next += 1;

  const personIds = new Map<string, string>();
  const people = group.people.map((person) => {
    const id = `p${next}`;
    next += 1;
    personIds.set(person.id, id);
    return { ...person, id };
  });

  const expenses = group.expenses.map((expense) => {
    const id = `e${next}`;
    next += 1;

    return {
      ...expense,
      id,
      paidBy: personIds.get(expense.paidBy) ?? expense.paidBy,
      shares: Object.fromEntries(
        Object.entries(expense.shares).map(([personId, value]) => [
          personIds.get(personId) ?? personId,
          value,
        ]),
      ),
    };
  });

  return { group: { id: groupId, name: group.name, people, expenses }, nextId: next };
}
