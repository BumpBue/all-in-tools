import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DIGITS,
  SIGNIFICANT_DIGITS,
  categoryOf,
  convert,
  convertToAll,
  findUnit,
  formatValue,
  isAffine,
  parseValue,
  readDigits,
  unitsOf,
} from '@/tools/unit-converter/logic';
import {
  CATEGORIES,
  CATEGORY_DEFINITIONS,
  type CategoryId,
  type UnitDefinition,
} from '@/tools/unit-converter/units';

function unit(category: CategoryId, id: string): UnitDefinition {
  const found = unitsOf(category).find((each) => each.id === id);
  if (!found) throw new Error(`no unit ${id} in ${category}`);
  return found;
}

function between(category: CategoryId, from: string, to: string, value: number): number {
  return convert(value, unit(category, from), unit(category, to));
}

describe('the catalogue', () => {
  it('covers the ten categories the tool advertises', () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(Object.keys(CATEGORY_DEFINITIONS)).toEqual([...CATEGORIES]);
  });

  it('gives every category at least two units', () => {
    for (const category of CATEGORIES) {
      expect(unitsOf(category).length).toBeGreaterThan(1);
    }
  });

  it('never repeats a unit id inside a category', () => {
    for (const category of CATEGORIES) {
      const ids = unitsOf(category).map((each) => each.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has exactly one unit of factor one in every category but temperature', () => {
    for (const category of CATEGORIES) {
      if (category === 'temperature') continue;
      const ones = unitsOf(category).filter((each) => each.factor === 1);
      expect(ones).toHaveLength(1);
    }
  });

  it('gives every unit a positive factor', () => {
    for (const category of CATEGORIES) {
      for (const each of unitsOf(category)) expect(each.factor).toBeGreaterThan(0);
    }
  });

  it('marks every unit that is a convention rather than a definition', () => {
    const conventional = ['rai', 'baht-gold', 'thang', 'month', 'wa'];

    for (const id of conventional) {
      const found = CATEGORIES.flatMap((category) => unitsOf(category)).find(
        (each) => each.id === id,
      );
      expect(found?.provenance).toBeDefined();
    }
  });
});

describe('converting', () => {
  it('round-trips every pair in every category', () => {
    for (const category of CATEGORIES) {
      const units = unitsOf(category);

      for (const from of units) {
        for (const to of units) {
          const back = convert(convert(7, from, to), to, from);
          expect(back).toBeCloseTo(7, 8);
        }
      }
    }
  });

  it('leaves a value alone when both sides are the same unit', () => {
    for (const category of CATEGORIES) {
      for (const each of unitsOf(category)) {
        expect(convert(3.5, each, each)).toBeCloseTo(3.5, 10);
      }
    }
  });

  it('converts the metric units it is built on', () => {
    expect(between('length', 'km', 'm', 1)).toBe(1000);
    expect(between('weight', 'kg', 'g', 2)).toBe(2000);
    expect(between('length', 'in', 'cm', 1)).toBeCloseTo(2.54, 10);
  });
});

// The numbers a Thai reader would check first.
describe('Thai units', () => {
  it('makes one rai 1600 square metres', () => {
    expect(between('area', 'rai', 'm2', 1)).toBe(1600);
  });

  it('makes one rai four ngan and four hundred square wa', () => {
    expect(between('area', 'rai', 'ngan', 1)).toBeCloseTo(4, 10);
    expect(between('area', 'rai', 'square-wa', 1)).toBeCloseTo(400, 10);
  });

  it('makes one square wa four square metres', () => {
    expect(between('area', 'square-wa', 'm2', 1)).toBe(4);
  });

  it('makes one baht of bullion gold 15.244 grams', () => {
    expect(between('weight', 'baht-gold', 'g', 1)).toBe(15.244);
  });

  it('keeps jewellery gold apart from bullion, which is lighter per baht', () => {
    const bullion = between('weight', 'baht-gold', 'g', 1);
    const jewellery = between('weight', 'baht-jewelry', 'g', 1);

    expect(jewellery).toBe(15.16);
    expect(jewellery).toBeLessThan(bullion);
  });

  it('makes four salueng one baht of gold', () => {
    expect(between('weight', 'salueng', 'baht-gold', 4)).toBeCloseTo(1, 10);
  });

  it('makes one wa two metres, and four sok one wa', () => {
    expect(between('length', 'wa', 'm', 1)).toBe(2);
    expect(between('length', 'sok', 'wa', 4)).toBeCloseTo(1, 10);
  });

  it('makes two khuep one sok and twelve Thai inches one khuep', () => {
    expect(between('length', 'khuep', 'sok', 2)).toBeCloseTo(1, 10);
    expect(between('length', 'nio', 'khuep', 12)).toBeCloseTo(1, 10);
  });

  it('makes one sen twenty wa', () => {
    expect(between('length', 'sen', 'wa', 1)).toBeCloseTo(20, 10);
  });

  it('makes one kwian a hundred thang', () => {
    expect(between('volume', 'kwian', 'thang', 1)).toBeCloseTo(100, 10);
    expect(between('volume', 'thang', 'l', 1)).toBe(20);
  });

  // หุน means two different things, so the tool carries both rather than
  // picking one and being wrong half the time.
  it('carries hun as both a length and a weight', () => {
    expect(between('length', 'hun-length', 'in', 8)).toBeCloseTo(1, 10);
    expect(between('weight', 'hun-weight', 'tamlueng', 100)).toBeCloseTo(1, 10);
  });
});

describe('temperature', () => {
  it('is affine, unlike everything else', () => {
    expect(isAffine(unit('temperature', 'f'))).toBe(true);
    expect(isAffine(unit('temperature', 'k'))).toBe(true);
    expect(isAffine(unit('temperature', 'c'))).toBe(false);
    expect(isAffine(unit('length', 'm'))).toBe(false);
  });

  it('freezes and boils water where it should', () => {
    expect(between('temperature', 'c', 'f', 0)).toBeCloseTo(32, 10);
    expect(between('temperature', 'c', 'f', 100)).toBeCloseTo(212, 10);
  });

  it('meets itself at minus forty', () => {
    expect(between('temperature', 'c', 'f', -40)).toBeCloseTo(-40, 10);
    expect(between('temperature', 'f', 'c', -40)).toBeCloseTo(-40, 10);
  });

  it('puts absolute zero at -273.15 °C and -459.67 °F', () => {
    expect(between('temperature', 'k', 'c', 0)).toBeCloseTo(-273.15, 10);
    expect(between('temperature', 'k', 'f', 0)).toBeCloseTo(-459.67, 8);
  });

  it('does not treat zero as nothing, the way a plain factor would', () => {
    expect(between('temperature', 'c', 'k', 0)).toBeCloseTo(273.15, 10);
    expect(between('temperature', 'c', 'f', 0)).not.toBe(0);
  });

  it('keeps a body temperature readable', () => {
    expect(between('temperature', 'c', 'f', 37)).toBeCloseTo(98.6, 8);
  });
});

describe('digital storage', () => {
  it('keeps the two bases apart', () => {
    expect(between('data', 'kb', 'byte', 1)).toBe(1000);
    expect(between('data', 'kib', 'byte', 1)).toBe(1024);
  });

  it('shows the gap that sells hard drives', () => {
    expect(between('data', 'tb', 'tib', 1)).toBeCloseTo(0.909494701772928, 10);
  });

  it('makes eight bits one byte', () => {
    expect(between('data', 'bit', 'byte', 8)).toBe(1);
  });
});

describe('formatValue', () => {
  it('does not print fifteen decimal places', () => {
    expect(formatValue(1 / 3, 6)).toBe('0.333333');
    expect(formatValue(0.1 + 0.2, 6)).toBe('0.3');
  });

  it('keeps whole numbers whole', () => {
    expect(formatValue(1000, 6)).toBe('1000');
    expect(formatValue(2.5, 6)).toBe('2.5');
  });

  it('honours the number of digits asked for', () => {
    expect(formatValue(Math.PI, 4)).toBe('3.142');
    expect(formatValue(Math.PI, 8)).toBe('3.1415927');
  });

  it('does not round a small value away to nothing', () => {
    expect(formatValue(0.000000123, 6)).toContain('e-');
    expect(Number(formatValue(0.000000123, 6))).toBeCloseTo(0.000000123, 12);
  });

  it('switches to exponent notation rather than printing a wall of digits', () => {
    expect(formatValue(1.5e15, 6)).toContain('e+');
  });

  it('prints zero as zero', () => {
    expect(formatValue(0, 6)).toBe('0');
  });

  it('keeps a negative sign', () => {
    expect(formatValue(-40, 6)).toBe('-40');
  });
});

describe('parseValue', () => {
  it('reads a plain number', () => {
    expect(parseValue('12.5')).toBe(12.5);
    expect(parseValue('-40')).toBe(-40);
  });

  it('reads what it prints back', () => {
    expect(parseValue(formatValue(1.5e15, 6))).toBeCloseTo(1.5e15, 0);
  });

  it('reads nothing as nothing rather than as zero', () => {
    expect(parseValue('')).toBeNull();
    expect(parseValue('  ')).toBeNull();
  });

  it('refuses what is not a number', () => {
    expect(parseValue('สิบ')).toBeNull();
    expect(parseValue('1/2')).toBeNull();
  });
});

describe('reading the link', () => {
  it('falls back to a known category', () => {
    expect(categoryOf('length')).toBe('length');
    expect(categoryOf('nonsense')).toBe('length');
  });

  it('falls back to a unit that exists in the category', () => {
    expect(findUnit('length', 'm', 0).id).toBe('m');
    expect(unitsOf('length')).toContainEqual(findUnit('length', 'rai', 0));
  });

  it('never runs off the end of a short category', () => {
    expect(findUnit('temperature', undefined, 99).id).toBeDefined();
  });

  it('only accepts a digit count it offers', () => {
    expect(readDigits('8')).toBe(8);
    expect(readDigits('99')).toBe(DEFAULT_DIGITS);
    expect(readDigits(undefined)).toBe(DEFAULT_DIGITS);
    expect(SIGNIFICANT_DIGITS).toContain(DEFAULT_DIGITS);
  });
});

describe('convertToAll', () => {
  it('answers for every unit in the category', () => {
    const rows = convertToAll(1, unit('area', 'rai'), 'area', 6);
    expect(rows).toHaveLength(unitsOf('area').length);
  });

  it('includes the unit it started from, unchanged', () => {
    const rows = convertToAll(2.5, unit('length', 'm'), 'length', 6);
    expect(rows.find((row) => row.unit.id === 'm')?.text).toBe('2.5');
  });

  it('formats every row', () => {
    const rows = convertToAll(1, unit('temperature', 'c'), 'temperature', 6);
    expect(rows.every((row) => row.text.length > 0)).toBe(true);
  });
});
