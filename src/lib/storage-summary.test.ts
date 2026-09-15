import { afterEach, describe, expect, it } from 'vitest';

import { TOOLS } from '@/config/tools';
import {
  ITEM_COUNTERS,
  countItemsByShape,
  countStoredItems,
} from '@/lib/storage-summary';

const FAKE_SLUG = 'habit-tracker';

/** The nested shape the default counter gets wrong. */
const NESTED = {
  habits: [{ id: 'read' }, { id: 'water' }, { id: 'walk' }],
  logs: { '2026-09-01': ['read'], '2026-09-02': ['read', 'water'] },
};

afterEach(() => {
  delete ITEM_COUNTERS[FAKE_SLUG];
});

describe('countItemsByShape', () => {
  it('counts array members', () => {
    expect(countItemsByShape([1, 2, 3])).toBe(3);
  });

  it('counts object keys', () => {
    expect(countItemsByShape({ a: 1, b: 2 })).toBe(2);
  });

  it('counts a scalar as one', () => {
    expect(countItemsByShape('x')).toBe(1);
    expect(countItemsByShape(0)).toBe(1);
    expect(countItemsByShape(false)).toBe(1);
  });

  it('counts nothing as zero', () => {
    expect(countItemsByShape(null)).toBe(0);
    expect(countItemsByShape(undefined)).toBe(0);
  });

  it('reads a nested model as the number of top-level keys', () => {
    expect(countItemsByShape(NESTED)).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('falls back to the shape when a tool declares no counter', () => {
    expect(countStoredItems('word-counter', [1, 2])).toBe(2);
  });

  it('uses a declared counter instead of the shape', () => {
    ITEM_COUNTERS[FAKE_SLUG] = (data) =>
      (data as typeof NESTED).habits.length;

    expect(countStoredItems(FAKE_SLUG, NESTED)).toBe(3);
    expect(countItemsByShape(NESTED)).toBe(2);
  });

  it('keeps the fallback for other tools when one declares a counter', () => {
    ITEM_COUNTERS[FAKE_SLUG] = () => 99;
    expect(countStoredItems('markdown-preview', [1, 2, 3])).toBe(3);
  });

  it('falls back when a counter throws rather than breaking the page', () => {
    ITEM_COUNTERS[FAKE_SLUG] = () => {
      throw new Error('bad data model');
    };

    expect(countStoredItems(FAKE_SLUG, [1, 2])).toBe(2);
  });

  it('falls back when a counter meets data it did not expect', () => {
    ITEM_COUNTERS[FAKE_SLUG] = (data) => (data as typeof NESTED).habits.length;
    expect(countStoredItems(FAKE_SLUG, 'not the model')).toBe(1);
  });
});

describe('registry and counter map agree', () => {
  it('has a counter for every tool that declares one', () => {
    const missing = TOOLS.filter(
      (tool) => tool.hasItemCounter && !(tool.slug in ITEM_COUNTERS),
    ).map((tool) => tool.slug);

    expect(missing).toEqual([]);
  });

  it('has a declaration for every counter in the map', () => {
    const declared = new Set(
      TOOLS.filter((tool) => tool.hasItemCounter).map((tool) => tool.slug),
    );
    const undeclared = Object.keys(ITEM_COUNTERS).filter(
      (slug) => !declared.has(slug),
    );

    expect(undeclared).toEqual([]);
  });

  it('never declares a counter for a tool that stores nothing', () => {
    const pointless = TOOLS.filter(
      (tool) => tool.hasItemCounter && !tool.needsStorage,
    ).map((tool) => tool.slug);

    expect(pointless).toEqual([]);
  });
});
