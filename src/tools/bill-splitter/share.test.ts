import { describe, expect, it } from 'vitest';

import { toSatang, type Group } from '@/tools/bill-splitter/logic';
import { decodeGroup, encodeGroup, withFreshIds } from '@/tools/bill-splitter/share';

const GROUP: Group = {
  id: 'g1',
  name: 'ทริปเชียงใหม่',
  people: [
    { id: 'p1', name: 'เอ' },
    { id: 'p2', name: 'บี' },
  ],
  expenses: [
    {
      id: 'e1',
      description: 'ข้าวเย็น, ร้านริมน้ำ',
      amount: toSatang(480),
      paidBy: 'p1',
      shareMode: 'equal',
      shares: { p1: 1, p2: 1 },
    },
  ],
};

describe('a group in a link', () => {
  it('survives the round trip', () => {
    const back = decodeGroup(encodeGroup(GROUP), 'g9');

    expect(back?.name).toBe(GROUP.name);
    expect(back?.people.map((person) => person.name)).toEqual(['เอ', 'บี']);
    expect(back?.expenses[0]).toMatchObject({
      description: 'ข้าวเย็น, ร้านริมน้ำ',
      amount: toSatang(480),
      paidBy: 'p1',
    });
  });

  it('keeps a name holding a comma, which a separator would have split', () => {
    expect(decodeGroup(encodeGroup(GROUP), 'g9')?.expenses[0]?.description).toContain(',');
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeGroup('not json', 'g1')).toBeNull();
    expect(decodeGroup('[1,2,3]', 'g1')).toBeNull();
    expect(decodeGroup('["",[],[]]', 'g1')).toBeNull();
    expect(decodeGroup(undefined, 'g1')).toBeNull();
  });

  it('drops an expense paid by somebody the link does not name', () => {
    const tampered = JSON.stringify([
      'ทริป',
      [['p1', 'เอ']],
      [['x', 100, 'ghost', 'equal', [['p1', 1]]]],
    ]);

    expect(decodeGroup(tampered, 'g1')?.expenses).toHaveLength(0);
  });

  it('drops a share for somebody the link does not name', () => {
    const tampered = JSON.stringify([
      'ทริป',
      [['p1', 'เอ']],
      [['x', 100, 'p1', 'equal', [['p1', 1], ['ghost', 5]]]],
    ]);

    expect(Object.keys(decodeGroup(tampered, 'g1')?.expenses[0]?.shares ?? {})).toEqual([
      'p1',
    ]);
  });
});

// Opening a link and saving it must not disturb what is already saved.
describe('withFreshIds', () => {
  it('renames every id, so nothing collides with what is already stored', () => {
    const { group, nextId } = withFreshIds(GROUP, 50);

    expect(group.id).toBe('g50');
    expect(group.people.map((person) => person.id)).toEqual(['p51', 'p52']);
    expect(group.expenses[0]?.id).toBe('e53');
    expect(nextId).toBe(54);
  });

  it('keeps the expense pointing at the same person under their new id', () => {
    const { group } = withFreshIds(GROUP, 50);
    const payer = group.people.find((person) => person.name === 'เอ');

    expect(group.expenses[0]?.paidBy).toBe(payer?.id);
    expect(Object.keys(group.expenses[0]?.shares ?? {}).sort()).toEqual(
      group.people.map((person) => person.id).sort(),
    );
  });

  it('gives two saves of the same link two separate groups', () => {
    const first = withFreshIds(GROUP, 1);
    const second = withFreshIds(GROUP, first.nextId);

    const ids = [
      first.group.id,
      second.group.id,
      ...first.group.people.map((person) => person.id),
      ...second.group.people.map((person) => person.id),
      ...first.group.expenses.map((expense) => expense.id),
      ...second.group.expenses.map((expense) => expense.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves the balances unchanged, whatever the ids became', () => {
    const { group } = withFreshIds(GROUP, 99);
    const shares = Object.values(group.expenses[0]?.shares ?? {});

    expect(shares).toEqual([1, 1]);
    expect(group.expenses[0]?.amount).toBe(toSatang(480));
  });
});
