import {
  CATEGORIES,
  CATEGORY_DEFINITIONS,
  type CategoryId,
  type UnitDefinition,
} from '@/tools/unit-converter/units';

export const SIGNIFICANT_DIGITS = [4, 6, 8, 10] as const;
export type SignificantDigits = (typeof SIGNIFICANT_DIGITS)[number];
export const DEFAULT_DIGITS: SignificantDigits = 6;

export const DEFAULT_CATEGORY: CategoryId = 'length';

/** Below this a fixed notation would be all zeros, and above it all digits. */
const EXPONENT_LOW = 1e-4;
const EXPONENT_HIGH = 1e12;

const NUMBER = /^-?\d*\.?\d*(?:[eE][-+]?\d+)?$/;

export function categoryOf(id: string): CategoryId {
  return CATEGORIES.includes(id as CategoryId) ? (id as CategoryId) : DEFAULT_CATEGORY;
}

export function unitsOf(category: CategoryId): readonly UnitDefinition[] {
  return CATEGORY_DEFINITIONS[category].units;
}

export function findUnit(
  category: CategoryId,
  id: string | undefined,
  fallbackIndex: number,
): UnitDefinition {
  const units = unitsOf(category);
  const found = units.find((unit) => unit.id === id);
  if (found) return found;

  return units[Math.min(fallbackIndex, units.length - 1)] as UnitDefinition;
}

/**
 * Every unit is a straight line through the base unit: one multiplier and, for
 * temperature, one offset. Without the offset a Fahrenheit reading would come
 * out as a ratio, and 0 °F would convert to 0 °C.
 */
export function toBase(value: number, unit: UnitDefinition): number {
  return (value - (unit.offset ?? 0)) * unit.factor;
}

export function fromBase(base: number, unit: UnitDefinition): number {
  return base / unit.factor + (unit.offset ?? 0);
}

export function convert(
  value: number,
  from: UnitDefinition,
  to: UnitDefinition,
): number {
  return fromBase(toBase(value, from), to);
}

export function isAffine(unit: UnitDefinition): boolean {
  return (unit.offset ?? 0) !== 0;
}

export function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!NUMBER.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Significant digits rather than decimal places: 0.000123 and 123000 both
 * deserve the same number of meaningful figures, and neither deserves the
 * fifteen that a float will happily print.
 */
export function formatValue(value: number, digits: SignificantDigits): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';

  const magnitude = Math.abs(value);
  if (magnitude < EXPONENT_LOW || magnitude >= EXPONENT_HIGH) {
    return value.toExponential(digits - 1).replace(/\.?0+e/, 'e');
  }

  const fixed = value.toPrecision(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

export interface ConversionRow {
  unit: UnitDefinition;
  value: number;
  text: string;
}

export function convertToAll(
  value: number,
  from: UnitDefinition,
  category: CategoryId,
  digits: SignificantDigits,
): ConversionRow[] {
  return unitsOf(category).map((unit) => {
    const converted = convert(value, from, unit);
    return { unit, value: converted, text: formatValue(converted, digits) };
  });
}

export function readDigits(raw: string | undefined): SignificantDigits {
  const value = Number(raw);
  return SIGNIFICANT_DIGITS.includes(value as SignificantDigits)
    ? (value as SignificantDigits)
    : DEFAULT_DIGITS;
}
