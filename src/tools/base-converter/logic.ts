export const MIN_BASE = 2;
export const MAX_BASE = 36;
export const STANDARD_BASES = [2, 8, 10, 16] as const;
export const COMMON_WIDTHS = [8, 16, 32, 64] as const;
export const BIT_GROUP_SIZE = 4;

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const SEPARATORS = /[\s_]/g;
const BASE_PREFIXES: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
const UPPERCASE_ABOVE_BASE = 10;

export type ParseErrorCode =
  | 'empty'
  | 'invalid-base'
  | 'invalid-digit'
  | 'sign-only';

export interface ParseFailure {
  ok: false;
  code: ParseErrorCode;
  /** The offending character, for 'invalid-digit'. */
  character?: string;
  base: number;
}

export type ParseResult = { ok: true; value: bigint } | ParseFailure;

export function isValidBase(base: number): boolean {
  return Number.isInteger(base) && base >= MIN_BASE && base <= MAX_BASE;
}

function digitValue(character: string): number {
  return DIGITS.indexOf(character);
}

/**
 * Strips the separators people actually type, and a base marker when it matches
 * the base being parsed. A mismatched marker (0x in a decimal field) is left in
 * place so it surfaces as an invalid digit rather than being silently accepted.
 */
function stripDecorations(body: string, base: number): string {
  const cleaned = body.replace(SEPARATORS, '').toLowerCase();
  const prefix = BASE_PREFIXES[base];

  return prefix && cleaned.startsWith(prefix) ? cleaned.slice(prefix.length) : cleaned;
}

export function parseBigInt(raw: string, base: number): ParseResult {
  if (!isValidBase(base)) return { ok: false, code: 'invalid-base', base };

  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, code: 'empty', base };

  const negative = trimmed.startsWith('-');
  const unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const body = stripDecorations(unsigned, base);

  if (body.length === 0) return { ok: false, code: 'sign-only', base };

  const radix = BigInt(base);
  let magnitude = 0n;

  for (const character of body) {
    const value = digitValue(character);
    if (value === -1 || value >= base) {
      return { ok: false, code: 'invalid-digit', character, base };
    }
    magnitude = magnitude * radix + BigInt(value);
  }

  return { ok: true, value: negative ? -magnitude : magnitude };
}

export function formatBigInt(value: bigint, base: number): string {
  if (!isValidBase(base)) return '';

  const text = value.toString(base);
  return base > UPPERCASE_ABOVE_BASE ? text.toUpperCase() : text;
}

export function convertToBases(
  value: bigint,
  bases: readonly number[] = STANDARD_BASES,
): Record<number, string> {
  return Object.fromEntries(bases.map((base) => [base, formatBigInt(value, base)]));
}

function magnitudeOf(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function bitLength(value: bigint): number {
  const magnitude = magnitudeOf(value);
  return magnitude === 0n ? 0 : magnitude.toString(2).length;
}

/** Binary of the magnitude, zero-padded and grouped for reading. */
export function toBitGroups(value: bigint, groupSize: number = BIT_GROUP_SIZE): string {
  const raw = magnitudeOf(value).toString(2);
  const width = Math.max(Math.ceil(raw.length / groupSize) * groupSize, groupSize);
  const padded = raw.padStart(width, '0');

  const groups: string[] = [];
  for (let index = 0; index < padded.length; index += groupSize) {
    groups.push(padded.slice(index, index + groupSize));
  }
  return groups.join(' ');
}

export interface WidthFit {
  width: number;
  signed: boolean;
  unsigned: boolean;
}

export function fitsWidth(value: bigint, width: number): WidthFit {
  const signedLimit = 1n << BigInt(width - 1);
  const unsignedLimit = 1n << BigInt(width);

  return {
    width,
    signed: value >= -signedLimit && value < signedLimit,
    unsigned: value >= 0n && value < unsignedLimit,
  };
}

export function describeWidths(
  value: bigint,
  widths: readonly number[] = COMMON_WIDTHS,
): WidthFit[] {
  return widths.map((width) => fitsWidth(value, width));
}
