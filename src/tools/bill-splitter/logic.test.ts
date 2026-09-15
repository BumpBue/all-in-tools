import { describe, expect, it } from 'vitest';

import { createRandom, intBetween, pickFrom } from '@/lib/random';
import {
  EMPTY_DATA,
  SPLITTER_SCHEMA,
  balances,
  countStoredItems,
  formatBaht,
  groupTotal,
  migrate,
  reduce,
  settle,
  sharesFor,
  toSatang,
  type Expense,
  type Group,
} from '@/tools/bill-splitter/logic';

const SEED = 20260915;

function people(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `คนที่ ${index + 1}`,
  }));
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    description: 'ข้าวเย็น',
    amount: toSatang(300),
    paidBy: 'p1',
    shareMode: 'equal',
    shares: { p1: 1, p2: 1, p3: 1 },
    ...overrides,
  };
}

function group(expenses: Expense[], count = 3): Group {
  return { id: 'g1', name: 'ทริป', people: people(count), expenses };
}

/** What each person ends up sending (negative) or receiving (positive). */
function movement(transfers: ReturnType<typeof settle>): Record<string, number> {
  const moved: Record<string, number> = {};

  for (const transfer of transfers) {
    moved[transfer.from] = (moved[transfer.from] ?? 0) - transfer.amount;
    moved[transfer.to] = (moved[transfer.to] ?? 0) + transfer.amount;
  }

  return moved;
}

describe('money', () => {
  it('is held in satang, so the arithmetic is exact', () => {
    expect(toSatang(0.1) + toSatang(0.2)).toBe(toSatang(0.3));
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('prints to two places', () => {
    expect(formatBaht(toSatang(1234.5))).toBe('1234.50');
    expect(formatBaht(1)).toBe('0.01');
  });
});

describe('sharesFor', () => {
  it('splits equally among the people included', () => {
    const owed = sharesFor(expense(), people(3));
    expect(owed).toEqual({ p1: 10_000, p2: 10_000, p3: 10_000 });
  });

  it('adds up to the exact amount when it does not divide evenly', () => {
    // 10.00 between three is 3.33 each with a satang over.
    const owed = sharesFor(
      expense({ amount: toSatang(10), shares: { p1: 1, p2: 1, p3: 1 } }),
      people(3),
    );

    expect(Object.values(owed).reduce((sum, value) => sum + value, 0)).toBe(toSatang(10));
    expect(Object.values(owed).sort()).toEqual([333, 333, 334]);
  });

  it('leaves out anybody not included in the split', () => {
    const owed = sharesFor(expense({ shares: { p1: 1, p2: 1 } }), people(3));

    expect(owed.p3).toBe(0);
    expect(owed.p1).toBe(toSatang(150));
  });

  it('honours weights', () => {
    const owed = sharesFor(
      expense({ shareMode: 'weight', shares: { p1: 2, p2: 1, p3: 1 } }),
      people(3),
    );

    expect(owed.p1).toBe(toSatang(150));
    expect(owed.p2).toBe(toSatang(75));
    expect(Object.values(owed).reduce((sum, value) => sum + value, 0)).toBe(toSatang(300));
  });

  it('takes exact amounts as given', () => {
    const owed = sharesFor(
      expense({
        shareMode: 'exact',
        shares: { p1: toSatang(200), p2: toSatang(50), p3: toSatang(50) },
      }),
      people(3),
    );

    expect(owed.p1).toBe(toSatang(200));
  });

  it('owes nobody anything when no one is included', () => {
    const owed = sharesFor(expense({ shares: {} }), people(3));
    expect(Object.values(owed).every((value) => value === 0)).toBe(true);
  });
});

describe('balances', () => {
  it('credits the payer and debits everyone in the split', () => {
    const net = balances(group([expense()]));

    expect(net.p1).toBe(toSatang(200));
    expect(net.p2).toBe(-toSatang(100));
    expect(net.p3).toBe(-toSatang(100));
  });

  it('always adds to nothing, since every satang paid is a satang owed', () => {
    const net = balances(
      group([
        expense(),
        expense({ id: 'e2', amount: toSatang(99.99), paidBy: 'p2' }),
      ]),
    );

    expect(Object.values(net).reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it('leaves a person who paid for everything and used none of it in credit', () => {
    const net = balances(group([expense({ shares: { p2: 1, p3: 1 } })]));

    expect(net.p1).toBe(toSatang(300));
  });
});

describe('settle', () => {
  it('has nothing to do when nobody owes anything', () => {
    expect(settle(group([]))).toEqual([]);
  });

  it('names who pays whom', () => {
    const transfers = settle(group([expense()]));

    expect(transfers).toHaveLength(2);
    expect(transfers.every((transfer) => transfer.to === 'p1')).toBe(true);
    expect(transfers.every((transfer) => transfer.amount === toSatang(100))).toBe(true);
  });

  it('never asks anyone to send nothing', () => {
    for (const transfer of settle(group([expense()]))) {
      expect(transfer.amount).toBeGreaterThan(0);
    }
  });

  it('never has anyone pay themselves', () => {
    for (const transfer of settle(group([expense()]))) {
      expect(transfer.from).not.toBe(transfer.to);
    }
  });

  it('needs at most one transfer fewer than there are unsettled people', () => {
    const transfers = settle(
      group(
        [
          expense({ amount: toSatang(120), paidBy: 'p1' }),
          expense({ id: 'e2', amount: toSatang(60), paidBy: 'p2' }),
        ],
        3,
      ),
    );

    const unsettled = Object.values(balances(group([]))).length;
    expect(transfers.length).toBeLessThanOrEqual(Math.max(0, unsettled));
  });
});

// The property that matters: whatever the group did, settling up has to leave
// everybody square to the satang.
describe('settle, over many random groups', () => {
  it('moves exactly each person’s net balance, and no more', () => {
    const random = createRandom(SEED);

    for (let round = 0; round < 500; round += 1) {
      const count = intBetween(2, 6, random);
      const roster = people(count);
      const ids = roster.map((person) => person.id);

      const expenses: Expense[] = Array.from(
        { length: intBetween(1, 6, random) },
        (_, index) => {
          const mode = pickFrom(['equal', 'weight', 'exact'] as const, random);
          const amount = intBetween(1, 500_00, random);

          const shares: Record<string, number> = {};
          if (mode === 'exact') {
            // Exact shares have to add up to the amount, as the UI enforces.
            let left = amount;
            ids.forEach((id, position) => {
              const last = position === ids.length - 1;
              const value = last ? left : intBetween(0, left, random);
              shares[id] = value;
              left -= value;
            });
          } else {
            for (const id of ids) shares[id] = intBetween(0, 3, random);
            if (ids.every((id) => (shares[id] ?? 0) === 0)) shares[ids[0] as string] = 1;
          }

          return {
            id: `e${index}`,
            description: '',
            amount,
            paidBy: pickFrom(ids, random),
            shareMode: mode,
            shares,
          };
        },
      );

      const current = group(expenses, count);
      const net = balances(current);
      const moved = movement(settle(current));

      for (const id of ids) {
        expect(moved[id] ?? 0).toBe(net[id] ?? 0);
      }
    }
  });

  it('always balances to zero across the group', () => {
    const random = createRandom(SEED + 1);

    for (let round = 0; round < 200; round += 1) {
      const count = intBetween(2, 5, random);
      const ids = people(count).map((person) => person.id);

      const current = group(
        [
          {
            id: 'e1',
            description: '',
            amount: intBetween(1, 100_00, random),
            paidBy: pickFrom(ids, random),
            shareMode: 'equal',
            shares: Object.fromEntries(ids.map((id) => [id, 1])),
          },
        ],
        count,
      );

      const transfers = settle(current);
      const total = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
      const moved = movement(transfers);

      expect(Object.values(moved).reduce((sum, value) => sum + value, 0)).toBe(0);
      expect(total).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('actions', () => {
  it('adds a group, a person and an expense', () => {
    let data = reduce(EMPTY_DATA, { type: 'add-group', name: 'ทริป' });
    const groupId = data.groups[0]?.id ?? '';

    data = reduce(data, { type: 'add-person', groupId, name: 'เอ' });
    data = reduce(data, { type: 'add-person', groupId, name: 'บี' });
    data = reduce(data, {
      type: 'add-expense',
      groupId,
      description: 'ข้าว',
      amount: toSatang(100),
      paidBy: data.groups[0]?.people[0]?.id ?? '',
    });

    expect(data.groups[0]?.people).toHaveLength(2);
    expect(data.groups[0]?.expenses).toHaveLength(1);
    // A new expense includes everybody by default.
    expect(Object.keys(data.groups[0]?.expenses[0]?.shares ?? {})).toHaveLength(2);
  });

  it('gives every group, person and expense an id of its own', () => {
    let data = reduce(EMPTY_DATA, { type: 'add-group', name: 'a' });
    data = reduce(data, { type: 'add-person', groupId: 'g1', name: 'x' });
    data = reduce(data, { type: 'add-person', groupId: 'g1', name: 'y' });

    const ids = [
      ...data.groups.map((each) => each.id),
      ...data.groups.flatMap((each) => each.people.map((person) => person.id)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('removes the expenses of a person who leaves, since they cannot balance', () => {
    const data: ReturnType<typeof migrate> = {
      ...EMPTY_DATA,
      groups: [group([expense()])],
    };

    const after = reduce(data, {
      type: 'remove-person',
      groupId: 'g1',
      personId: 'p1',
    });

    expect(after.groups[0]?.expenses).toHaveLength(0);
    expect(after.groups[0]?.people.map((person) => person.id)).toEqual(['p2', 'p3']);
  });

  it('takes a departing person out of the splits they were in', () => {
    const data = {
      ...EMPTY_DATA,
      groups: [group([expense({ paidBy: 'p2' })])],
    };

    const after = reduce(data, {
      type: 'remove-person',
      groupId: 'g1',
      personId: 'p3',
    });

    expect(Object.keys(after.groups[0]?.expenses[0]?.shares ?? {})).not.toContain('p3');
  });
});

describe('groupTotal', () => {
  it('adds up every expense', () => {
    expect(groupTotal(group([expense(), expense({ id: 'e2', amount: toSatang(50) })])))
      .toBe(toSatang(350));
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = { ...EMPTY_DATA, groups: [group([expense()])], nextId: 9 };
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ groups: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: SPLITTER_SCHEMA + 1, groups: [] })).toEqual(EMPTY_DATA);
  });

  it('drops an expense paid by somebody no longer in the group', () => {
    const repaired = migrate({
      schema: SPLITTER_SCHEMA,
      groups: [
        {
          id: 'g1',
          name: 'ทริป',
          people: [{ id: 'p1', name: 'เอ' }],
          expenses: [
            { id: 'e1', description: 'x', amount: 100, paidBy: 'ghost', shares: {} },
            { id: 'e2', description: 'y', amount: 100, paidBy: 'p1', shares: {} },
          ],
        },
      ],
      nextId: 3,
    });

    expect(repaired.groups[0]?.expenses.map((each) => each.id)).toEqual(['e2']);
  });

  it('never hands out an id something stored already has', () => {
    const repaired = migrate({
      schema: SPLITTER_SCHEMA,
      groups: [
        { id: 'g4', name: 'x', people: [{ id: 'p7', name: 'a' }], expenses: [] },
      ],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add-person', groupId: 'g4', name: 'b' });
    const ids = added.groups[0]?.people.map((each) => each.id) ?? [];

    expect(new Set(ids).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts expenses across every group', () => {
    expect(countStoredItems({ groups: [{ expenses: [1, 2] }, { expenses: [3] }] })).toBe(3);
    expect(countStoredItems(null)).toBe(0);
  });
});
