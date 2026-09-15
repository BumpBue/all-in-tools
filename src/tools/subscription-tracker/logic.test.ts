import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/day';
import {
  EMPTY_DATA,
  MAX_SUBSCRIPTIONS,
  SOON_DAYS,
  STALE_DAYS,
  SUBSCRIPTION_SCHEMA,
  advanceCharge,
  byCategory,
  countStoredItems,
  cycleDays,
  daysSinceUsed,
  daysUntilCharge,
  formatBaht,
  isDueSoon,
  isOverdue,
  isStale,
  migrate,
  monthlySatang,
  paidSoFar,
  reduce,
  toSatang,
  totalMonthly,
  yearlySatang,
  type Subscription,
} from '@/tools/subscription-tracker/logic';

const TODAY = '2026-09-15';

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    name: 'Netflix',
    price: toSatang(419),
    cycle: 'monthly',
    customDays: 30,
    nextCharge: addDays(TODAY, 10),
    category: 'สตรีมมิง',
    startedOn: TODAY,
    lastUsedOn: TODAY,
    ...overrides,
  };
}

describe('normalising to a month', () => {
  it('leaves a monthly plan alone', () => {
    expect(monthlySatang(sub())).toBe(toSatang(419));
  });

  it('spreads a yearly plan over twelve months', () => {
    expect(monthlySatang(sub({ cycle: 'yearly', price: toSatang(1200) }))).toBe(
      toSatang(100),
    );
  });

  it('turns a weekly plan into its monthly share', () => {
    // 52 weeks a year over 12 months.
    const monthly = monthlySatang(sub({ cycle: 'weekly', price: toSatang(30) }));
    expect(monthly).toBe(Math.round((toSatang(30) * 52) / 12));
  });

  it('handles a custom cycle in days', () => {
    const every90 = sub({ cycle: 'custom', customDays: 90, price: toSatang(300) });
    // Four charges a year, so a hundred a month.
    expect(monthlySatang(every90)).toBeCloseTo(toSatang(101.39), -1);
  });

  it('shows the yearly figure beside it', () => {
    expect(yearlySatang(sub())).toBe(monthlySatang(sub()) * 12);
  });

  it('adds up across everything', () => {
    const total = totalMonthly([
      sub(),
      sub({ id: 's2', cycle: 'yearly', price: toSatang(1200) }),
    ]);

    expect(total).toBe(toSatang(519));
  });

  it('knows the length of each cycle', () => {
    expect(cycleDays(sub({ cycle: 'weekly' }))).toBe(7);
    expect(cycleDays(sub({ cycle: 'yearly' }))).toBe(365);
    expect(cycleDays(sub({ cycle: 'custom', customDays: 45 }))).toBe(45);
  });
});

describe('the next charge', () => {
  it('counts the days to it', () => {
    expect(daysUntilCharge(sub({ nextCharge: addDays(TODAY, 3) }), TODAY)).toBe(3);
    expect(daysUntilCharge(sub({ nextCharge: TODAY }), TODAY)).toBe(0);
  });

  it('flags anything inside the week ahead', () => {
    expect(isDueSoon(sub({ nextCharge: addDays(TODAY, SOON_DAYS) }), TODAY)).toBe(true);
    expect(isDueSoon(sub({ nextCharge: addDays(TODAY, SOON_DAYS + 1) }), TODAY)).toBe(
      false,
    );
    expect(isDueSoon(sub({ nextCharge: TODAY }), TODAY)).toBe(true);
  });

  it('tells a charge already past from one coming up', () => {
    expect(isOverdue(sub({ nextCharge: addDays(TODAY, -1) }), TODAY)).toBe(true);
    expect(isDueSoon(sub({ nextCharge: addDays(TODAY, -1) }), TODAY)).toBe(false);
  });

  it('says nothing about a subscription with no date', () => {
    expect(daysUntilCharge(sub({ nextCharge: '' }), TODAY)).toBeNull();
    expect(isDueSoon(sub({ nextCharge: '' }), TODAY)).toBe(false);
  });

  it('moves a missed charge forward by whole cycles', () => {
    const late = sub({ cycle: 'weekly', nextCharge: addDays(TODAY, -20) });
    const moved = advanceCharge(late, TODAY);

    expect(moved > TODAY || moved === TODAY).toBe(true);
    // Still lands on the same weekday the cycle started on.
    expect((new Date(moved).getTime() - new Date(late.nextCharge).getTime()) % (7 * 86_400_000))
      .toBe(0);
  });

  it('leaves a future charge where it is', () => {
    const upcoming = sub({ nextCharge: addDays(TODAY, 5) });
    expect(advanceCharge(upcoming, TODAY)).toBe(upcoming.nextCharge);
  });
});

describe('what has been paid', () => {
  it('counts the charges that have actually happened', () => {
    const started = sub({ startedOn: addDays(TODAY, -90), cycle: 'monthly' });

    // A month averages 30.44 days, so in 90 days the charges fall on day 0,
    // 30.4 and 60.8 — three of them. The fourth is still five days away, and
    // counting it would claim money that has not left anyone's account.
    expect(paidSoFar(started, TODAY)).toBe(3 * toSatang(419));
    expect(paidSoFar(sub({ startedOn: addDays(TODAY, -92) }), TODAY)).toBe(
      4 * toSatang(419),
    );
  });

  it('counts the first charge on the day it started', () => {
    expect(paidSoFar(sub({ startedOn: TODAY }), TODAY)).toBe(toSatang(419));
  });

  it('counts nothing before it started', () => {
    expect(paidSoFar(sub({ startedOn: addDays(TODAY, 10) }), TODAY)).toBe(0);
  });

  it('says nothing when no start date was given', () => {
    expect(paidSoFar(sub({ startedOn: '' }), TODAY)).toBeNull();
  });

  it('never invents a fraction of a charge', () => {
    const paid = paidSoFar(sub({ startedOn: addDays(TODAY, -45) }), TODAY);
    expect((paid ?? 0) % toSatang(419)).toBe(0);
  });
});

describe('what has gone unused', () => {
  it('counts from the day the reader said, never from a guess', () => {
    expect(daysSinceUsed(sub({ lastUsedOn: addDays(TODAY, -10) }), TODAY)).toBe(10);
  });

  it('flags one left alone for long enough', () => {
    expect(isStale(sub({ lastUsedOn: addDays(TODAY, -STALE_DAYS) }), TODAY)).toBe(true);
    expect(isStale(sub({ lastUsedOn: addDays(TODAY, -1) }), TODAY)).toBe(false);
  });

  it('says nothing at all when the reader never said', () => {
    expect(isStale(sub({ lastUsedOn: '' }), TODAY)).toBe(false);
    expect(daysSinceUsed(sub({ lastUsedOn: '' }), TODAY)).toBeNull();
  });
});

describe('byCategory', () => {
  it('adds up each category and puts the dearest first', () => {
    const groups = byCategory([
      sub({ category: 'สตรีมมิง', price: toSatang(419) }),
      sub({ id: 's2', category: 'ซอฟต์แวร์', price: toSatang(1000) }),
      sub({ id: 's3', category: 'สตรีมมิง', price: toSatang(99) }),
    ]);

    expect(groups[0]).toMatchObject({ category: 'ซอฟต์แวร์', count: 1 });
    expect(groups[1]).toMatchObject({ category: 'สตรีมมิง', count: 2 });
    expect(groups[1]?.monthly).toBe(toSatang(518));
  });

  it('keeps uncategorised ones together', () => {
    const groups = byCategory([sub({ category: '' }), sub({ id: 's2', category: '  ' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
  });
});

describe('money', () => {
  it('is held in satang', () => {
    expect(toSatang(0.1) + toSatang(0.2)).toBe(toSatang(0.3));
    expect(formatBaht(toSatang(419))).toBe('419.00');
  });
});

describe('actions', () => {
  it('adds one with sensible dates', () => {
    const data = reduce(EMPTY_DATA, { type: 'add', name: 'Spotify', today: TODAY });

    expect(data.subscriptions).toHaveLength(1);
    expect(data.subscriptions[0]?.startedOn).toBe(TODAY);
    expect(data.subscriptions[0]?.nextCharge > TODAY).toBe(true);
  });

  it('ignores one with no name', () => {
    expect(reduce(EMPTY_DATA, { type: 'add', name: ' ', today: TODAY })).toBe(EMPTY_DATA);
  });

  it('stops at the number it will track', () => {
    let data = EMPTY_DATA;
    for (let index = 0; index < MAX_SUBSCRIPTIONS + 3; index += 1) {
      data = reduce(data, { type: 'add', name: `s${index}`, today: TODAY });
    }

    expect(data.subscriptions).toHaveLength(MAX_SUBSCRIPTIONS);
  });

  it('marks one as used today', () => {
    const data = reduce(
      { ...EMPTY_DATA, subscriptions: [sub({ lastUsedOn: addDays(TODAY, -90) })] },
      { type: 'mark-used', id: 's1', today: TODAY },
    );

    expect(data.subscriptions[0]?.lastUsedOn).toBe(TODAY);
    expect(isStale(data.subscriptions[0]!, TODAY)).toBe(false);
  });

  it('advances a missed charge', () => {
    const data = reduce(
      { ...EMPTY_DATA, subscriptions: [sub({ nextCharge: addDays(TODAY, -40) })] },
      { type: 'advance', id: 's1', today: TODAY },
    );

    expect(isOverdue(data.subscriptions[0]!, TODAY)).toBe(false);
  });

  it('edits and removes', () => {
    const data = { ...EMPTY_DATA, subscriptions: [sub()] };

    expect(
      reduce(data, { type: 'edit', id: 's1', patch: { price: toSatang(99) } })
        .subscriptions[0]?.price,
    ).toBe(toSatang(99));
    expect(reduce(data, { type: 'remove', id: 's1' }).subscriptions).toHaveLength(0);
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = { ...EMPTY_DATA, subscriptions: [sub()], nextId: 2 };
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ subscriptions: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: SUBSCRIPTION_SCHEMA + 1, subscriptions: [] })).toEqual(
      EMPTY_DATA,
    );
  });

  it('throws away a date that is not a date', () => {
    const repaired = migrate({
      schema: SUBSCRIPTION_SCHEMA,
      subscriptions: [
        { id: 's1', name: 'x', price: 100, nextCharge: 'soon', lastUsedOn: '2026-09-01' },
      ],
      nextId: 2,
    });

    expect(repaired.subscriptions[0]?.nextCharge).toBe('');
    expect(repaired.subscriptions[0]?.lastUsedOn).toBe('2026-09-01');
  });

  it('reads an unknown cycle as monthly', () => {
    const repaired = migrate({
      schema: SUBSCRIPTION_SCHEMA,
      subscriptions: [{ id: 's1', name: 'x', price: 100, cycle: 'fortnightly' }],
      nextId: 2,
    });

    expect(repaired.subscriptions[0]?.cycle).toBe('monthly');
  });

  it('never hands out an id something stored already has', () => {
    const repaired = migrate({
      schema: SUBSCRIPTION_SCHEMA,
      subscriptions: [{ id: 's12', name: 'x', price: 1 }],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add', name: 'new', today: TODAY });
    expect(new Set(added.subscriptions.map((each) => each.id)).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts the subscriptions', () => {
    expect(countStoredItems({ subscriptions: [1, 2, 3] })).toBe(3);
    expect(countStoredItems(null)).toBe(0);
  });
});
