import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_COUNT,
  NANOID_ALPHABET,
  NANOID_DEFAULT_LENGTH,
  clampCount,
  clampLength,
  extractV7Time,
  formatId,
  generate,
  isValidAlphabet,
  nanoid,
  randomFromAlphabet,
  uuidV4,
  uuidV7,
} from '@/tools/uuid-generator/logic';

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SAMPLE_SIZE = 200;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uuid v4', () => {
  it('has the canonical shape', () => {
    expect(uuidV4()).toMatch(UUID_SHAPE);
  });

  it('carries the version and variant bits', () => {
    for (let run = 0; run < 50; run += 1) {
      const uuid = uuidV4();
      expect(uuid[14]).toBe('4');
      expect('89ab').toContain(uuid[19]);
    }
  });

  it('does not repeat across a large sample', () => {
    const ids = new Set(Array.from({ length: SAMPLE_SIZE }, uuidV4));
    expect(ids.size).toBe(SAMPLE_SIZE);
  });
});

describe('uuid v7', () => {
  it('has the canonical shape and version', () => {
    const uuid = uuidV7();
    expect(uuid).toMatch(UUID_SHAPE);
    expect(uuid[14]).toBe('7');
    expect('89ab').toContain(uuid[19]);
  });

  it('encodes the timestamp it was given', () => {
    const moment = 1_757_000_000_000;
    expect(extractV7Time(uuidV7(moment))).toBe(moment);
  });

  it('sorts in creation order as plain strings', () => {
    const base = 1_757_000_000_000;
    const ids = [0, 1, 2, 3, 4, 5].map((offset) => uuidV7(base + offset * 1000));

    expect([...ids].sort()).toEqual(ids);
  });

  it('still sorts in order when generated back to back in real time', () => {
    const ids = Array.from({ length: 20 }, (_, index) => uuidV7(Date.now() + index));
    expect([...ids].sort()).toEqual(ids);
  });

  it('differs between two ids made at the same millisecond', () => {
    const moment = 1_757_000_000_000;
    expect(uuidV7(moment)).not.toBe(uuidV7(moment));
  });

  it('reads back nothing from something that is not a v7', () => {
    expect(extractV7Time(uuidV4())).toBeNull();
    expect(extractV7Time('not-a-uuid')).toBeNull();
  });

  it('reads a timestamp from an uppercased or unhyphenated id', () => {
    const moment = 1_757_000_000_000;
    const uuid = uuidV7(moment);

    expect(extractV7Time(uuid.toUpperCase())).toBe(moment);
    expect(extractV7Time(uuid.replace(/-/g, ''))).toBe(moment);
  });
});

describe('randomness comes from crypto only', () => {
  it('never reaches for Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random');

    uuidV4();
    uuidV7();
    nanoid();
    randomFromAlphabet('abcdef', 12);
    generate({
      kind: 'uuid-v4',
      count: 5,
      uppercase: false,
      hyphens: true,
      alphabet: NANOID_ALPHABET,
      length: 10,
    });

    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('draws from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    uuidV4();
    expect(spy).toHaveBeenCalled();
  });
});

describe('nanoid', () => {
  it('is 21 characters by default', () => {
    expect(nanoid()).toHaveLength(NANOID_DEFAULT_LENGTH);
  });

  it('honours a requested length', () => {
    expect(nanoid(8)).toHaveLength(8);
    expect(nanoid(64)).toHaveLength(64);
  });

  it('uses only its own alphabet', () => {
    const allowed = new Set([...NANOID_ALPHABET]);
    for (const character of nanoid(200)) {
      expect(allowed.has(character)).toBe(true);
    }
  });

  it('does not repeat across a large sample', () => {
    const ids = new Set(Array.from({ length: SAMPLE_SIZE }, () => nanoid()));
    expect(ids.size).toBe(SAMPLE_SIZE);
  });
});

describe('randomFromAlphabet', () => {
  it('uses only the characters it was given', () => {
    const result = randomFromAlphabet('abc', 300);
    expect(result).toHaveLength(300);
    expect(/^[abc]+$/.test(result)).toBe(true);
  });

  it('ignores duplicate characters in the alphabet', () => {
    expect(/^[ab]+$/.test(randomFromAlphabet('aabb', 50))).toBe(true);
  });

  it('spreads roughly evenly rather than favouring the first characters', () => {
    const size = 6000;
    const counts = new Map<string, number>();
    for (const character of randomFromAlphabet('abcdefghij', size)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    const expectedShare = size / 10;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expectedShare * 0.7);
      expect(count).toBeLessThan(expectedShare * 1.3);
    }
  });

  it('returns nothing for an unusable alphabet', () => {
    expect(randomFromAlphabet('a', 10)).toBe('');
    expect(randomFromAlphabet('', 10)).toBe('');
  });

  it('returns nothing for a non-positive length', () => {
    expect(randomFromAlphabet('abc', 0)).toBe('');
  });
});

describe('isValidAlphabet', () => {
  it('needs at least two distinct characters', () => {
    expect(isValidAlphabet('ab')).toBe(true);
    expect(isValidAlphabet('a')).toBe(false);
    expect(isValidAlphabet('aaaa')).toBe(false);
    expect(isValidAlphabet('')).toBe(false);
  });
});

describe('formatId', () => {
  const uuid = '0189d6e1-5b7c-7c3a-8f21-9a4b6c8d0e2f';

  it('uppercases on request', () => {
    expect(formatId(uuid, true, true)).toBe(uuid.toUpperCase());
  });

  it('drops hyphens on request', () => {
    expect(formatId(uuid, false, false)).toBe(uuid.replace(/-/g, ''));
    expect(formatId(uuid, false, false)).toHaveLength(32);
  });

  it('can do both at once', () => {
    expect(formatId(uuid, true, false)).toBe(
      uuid.replace(/-/g, '').toUpperCase(),
    );
  });
});

describe('count and length limits', () => {
  it('clamps the count into range', () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(-5)).toBe(1);
    expect(clampCount(MAX_COUNT + 100)).toBe(MAX_COUNT);
    expect(clampCount(Number.NaN)).toBe(1);
    expect(clampCount(7.9)).toBe(7);
  });

  it('clamps the length into range', () => {
    expect(clampLength(0)).toBe(1);
    expect(clampLength(1000)).toBe(128);
    expect(clampLength(Number.NaN)).toBe(NANOID_DEFAULT_LENGTH);
  });
});

describe('generate', () => {
  const base = {
    count: 5,
    uppercase: false,
    hyphens: true,
    alphabet: 'abcdef',
    length: 10,
  };

  it('produces the requested number of ids', () => {
    expect(generate({ ...base, kind: 'uuid-v4' })).toHaveLength(5);
  });

  it('applies formatting to uuids', () => {
    const [id] = generate({ ...base, kind: 'uuid-v4', uppercase: true, hyphens: false });
    expect(id).toMatch(/^[0-9A-F]{32}$/);
  });

  it('keeps a batch of v7 ids in order', () => {
    const ids = generate({ ...base, count: 50, kind: 'uuid-v7' });
    expect([...ids].sort()).toEqual(ids);
  });

  it('keeps a full batch in order within a single millisecond', () => {
    const ids = generate({ ...base, count: MAX_COUNT, kind: 'uuid-v7' });

    expect(new Set(ids).size).toBe(MAX_COUNT);
    expect([...ids].sort()).toEqual(ids);
  });

  it('uses the custom alphabet and length', () => {
    const ids = generate({ ...base, kind: 'custom', length: 12 });
    for (const id of ids) {
      expect(id).toHaveLength(12);
      expect(/^[abcdef]+$/.test(id)).toBe(true);
    }
  });

  it('never returns duplicates in one batch', () => {
    const ids = generate({ ...base, count: MAX_COUNT, kind: 'uuid-v4' });
    expect(new Set(ids).size).toBe(MAX_COUNT);
  });

  it('clamps an out-of-range count', () => {
    expect(generate({ ...base, kind: 'uuid-v4', count: 99_999 })).toHaveLength(
      MAX_COUNT,
    );
  });
});
