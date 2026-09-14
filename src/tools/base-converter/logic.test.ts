import { describe, expect, it } from 'vitest';

import {
  COMMON_WIDTHS,
  MAX_BASE,
  MIN_BASE,
  bitLength,
  convertToBases,
  describeWidths,
  fitsWidth,
  formatBigInt,
  isValidBase,
  parseBigInt,
  toBitGroups,
} from '@/tools/base-converter/logic';

const RANDOM_SEED = 0x2f6e2b1;
const ROUND_TRIP_SAMPLES = 24;
const BIG_DECIMAL = '123456789012345678901234567890';
const OVER_64_BIT = (1n << 80n) + 12345n;

function ok(raw: string, base: number): bigint {
  const result = parseBigInt(raw, base);
  if (!result.ok) throw new Error(`expected "${raw}" in base ${base} to parse`);
  return result.value;
}

function failure(raw: string, base: number) {
  const result = parseBigInt(raw, base);
  if (result.ok) throw new Error(`expected "${raw}" in base ${base} to fail`);
  return result;
}

/** Deterministic so a failing round-trip case can be reproduced. */
function* pseudoRandom(seed: number): Generator<number> {
  let state = seed;
  while (true) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    yield state;
  }
}

describe('isValidBase', () => {
  it('accepts 2 through 36', () => {
    expect(isValidBase(MIN_BASE)).toBe(true);
    expect(isValidBase(MAX_BASE)).toBe(true);
    expect(isValidBase(10)).toBe(true);
  });

  it('rejects bases outside the range', () => {
    expect(isValidBase(1)).toBe(false);
    expect(isValidBase(37)).toBe(false);
    expect(isValidBase(0)).toBe(false);
    expect(isValidBase(-2)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isValidBase(8.5)).toBe(false);
    expect(isValidBase(Number.NaN)).toBe(false);
  });
});

describe('parseBigInt failures name the reason', () => {
  it('reports an empty input', () => {
    expect(failure('', 10).code).toBe('empty');
    expect(failure('   ', 10).code).toBe('empty');
  });

  it('reports a sign with no digits', () => {
    expect(failure('-', 10).code).toBe('sign-only');
    expect(failure('0x', 16).code).toBe('sign-only');
  });

  it('reports an out-of-range base', () => {
    expect(failure('10', 1).code).toBe('invalid-base');
    expect(failure('10', 37).code).toBe('invalid-base');
  });

  it('reports the offending character for a wrong digit', () => {
    const result = failure('102', 2);
    expect(result.code).toBe('invalid-digit');
    expect(result.character).toBe('2');
    expect(result.base).toBe(2);
  });

  it('rejects a hex digit in a decimal field', () => {
    expect(failure('12f', 10).character).toBe('f');
  });

  it('rejects a base marker that does not match the base', () => {
    expect(failure('0x1f', 10).code).toBe('invalid-digit');
  });
});

describe('parseBigInt values', () => {
  it('parses zero', () => {
    expect(ok('0', 10)).toBe(0n);
    expect(ok('0', 2)).toBe(0n);
    expect(ok('0', 36)).toBe(0n);
  });

  it('ignores leading zeros', () => {
    expect(ok('0000255', 10)).toBe(255n);
    expect(ok('00001111', 2)).toBe(15n);
  });

  it('parses negatives', () => {
    expect(ok('-255', 10)).toBe(-255n);
    expect(ok('-ff', 16)).toBe(-255n);
    expect(ok('-0', 10)).toBe(0n);
  });

  it('accepts an explicit plus sign', () => {
    expect(ok('+42', 10)).toBe(42n);
  });

  it('ignores surrounding whitespace', () => {
    expect(ok('  42  ', 10)).toBe(42n);
  });

  it('accepts underscores and inner spaces as separators', () => {
    expect(ok('1111_0000', 2)).toBe(240n);
    expect(ok('1111 0000', 2)).toBe(240n);
    expect(ok('1_000_000', 10)).toBe(1_000_000n);
  });

  it('accepts the matching base prefix', () => {
    expect(ok('0xFF', 16)).toBe(255n);
    expect(ok('0b1010', 2)).toBe(10n);
    expect(ok('0o777', 8)).toBe(511n);
  });

  it('treats hex as case-insensitive', () => {
    expect(ok('ff', 16)).toBe(255n);
    expect(ok('FF', 16)).toBe(255n);
    expect(ok('Ff', 16)).toBe(255n);
  });

  it('uses every digit available in base 36', () => {
    expect(ok('z', 36)).toBe(35n);
    expect(ok('10', 36)).toBe(36n);
    expect(ok('ZZ', 36)).toBe(1295n);
  });
});

describe('numbers beyond Number.MAX_SAFE_INTEGER', () => {
  it('keeps a 30-digit decimal exact', () => {
    expect(ok(BIG_DECIMAL, 10)).toBe(BigInt(BIG_DECIMAL));
  });

  it('does not lose precision the way Number would', () => {
    const raw = '9007199254740993';
    expect(ok(raw, 10)).toBe(9007199254740993n);
    expect(BigInt(Number(raw))).toBe(9007199254740992n);
  });

  it('round-trips a value wider than 64 bits', () => {
    const hex = formatBigInt(OVER_64_BIT, 16);
    expect(ok(hex, 16)).toBe(OVER_64_BIT);
  });

  it('handles a negative value wider than 64 bits', () => {
    expect(ok(`-${OVER_64_BIT.toString(10)}`, 10)).toBe(-OVER_64_BIT);
  });
});

describe('formatBigInt', () => {
  it('uppercases digits above base 10', () => {
    expect(formatBigInt(255n, 16)).toBe('FF');
    expect(formatBigInt(35n, 36)).toBe('Z');
  });

  it('leaves numeric bases alone', () => {
    expect(formatBigInt(255n, 10)).toBe('255');
    expect(formatBigInt(255n, 2)).toBe('11111111');
    expect(formatBigInt(255n, 8)).toBe('377');
  });

  it('keeps the sign', () => {
    expect(formatBigInt(-255n, 16)).toBe('-FF');
  });

  it('returns an empty string for an invalid base', () => {
    expect(formatBigInt(255n, 1)).toBe('');
    expect(formatBigInt(255n, 37)).toBe('');
  });
});

describe('round trip across every base', () => {
  it('survives parse and format in bases 2 through 36', () => {
    const random = pseudoRandom(RANDOM_SEED);

    for (let base = MIN_BASE; base <= MAX_BASE; base += 1) {
      for (let sample = 0; sample < ROUND_TRIP_SAMPLES; sample += 1) {
        const next = random.next().value;
        const magnitude = BigInt(next) * BigInt(next) + BigInt(sample);
        const value = sample % 2 === 0 ? magnitude : -magnitude;

        const text = formatBigInt(value, base);
        expect(parseBigInt(text, base), `base ${base} value ${value}`).toEqual({
          ok: true,
          value,
        });
      }
    }
  });

  it('agrees with BigInt.toString for every base', () => {
    for (let base = MIN_BASE; base <= MAX_BASE; base += 1) {
      expect(formatBigInt(12345n, base).toLowerCase()).toBe(
        (12345n).toString(base),
      );
    }
  });
});

describe('convertToBases', () => {
  it('produces the four standard bases at once', () => {
    expect(convertToBases(255n)).toEqual({
      2: '11111111',
      8: '377',
      10: '255',
      16: 'FF',
    });
  });
});

describe('bitLength', () => {
  it('is zero for zero', () => {
    expect(bitLength(0n)).toBe(0);
  });

  it('counts the bits of the magnitude', () => {
    expect(bitLength(1n)).toBe(1);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
  });

  it('ignores the sign', () => {
    expect(bitLength(-255n)).toBe(8);
  });

  it('handles very large values', () => {
    expect(bitLength(1n << 100n)).toBe(101);
  });
});

describe('toBitGroups', () => {
  it('groups by four', () => {
    expect(toBitGroups(255n)).toBe('1111 1111');
    expect(toBitGroups(5n)).toBe('0101');
  });

  it('pads a partial group with leading zeros', () => {
    expect(toBitGroups(256n)).toBe('0001 0000 0000');
  });

  it('shows zero as a full group', () => {
    expect(toBitGroups(0n)).toBe('0000');
  });

  it('uses the magnitude for negatives', () => {
    expect(toBitGroups(-5n)).toBe('0101');
  });

  it('honours a different group size', () => {
    expect(toBitGroups(255n, 8)).toBe('11111111');
  });
});

describe('fitsWidth', () => {
  it('accepts the largest unsigned value for the width', () => {
    expect(fitsWidth(255n, 8)).toMatchObject({ unsigned: true, signed: false });
    expect(fitsWidth(256n, 8).unsigned).toBe(false);
  });

  it('accepts the signed range', () => {
    expect(fitsWidth(127n, 8).signed).toBe(true);
    expect(fitsWidth(128n, 8).signed).toBe(false);
    expect(fitsWidth(-128n, 8).signed).toBe(true);
    expect(fitsWidth(-129n, 8).signed).toBe(false);
  });

  it('never calls a negative value unsigned', () => {
    expect(fitsWidth(-1n, 64).unsigned).toBe(false);
  });

  it('reports a value that overflows every common width', () => {
    const fits = describeWidths(OVER_64_BIT);
    expect(fits).toHaveLength(COMMON_WIDTHS.length);
    expect(fits.every((entry) => !entry.signed && !entry.unsigned)).toBe(true);
  });

  it('reports the widths a 64-bit value fits', () => {
    const value = (1n << 63n) - 1n;
    const fits = describeWidths(value);
    expect(fits.find((entry) => entry.width === 64)).toMatchObject({
      signed: true,
      unsigned: true,
    });
    expect(fits.find((entry) => entry.width === 32)?.signed).toBe(false);
  });
});
