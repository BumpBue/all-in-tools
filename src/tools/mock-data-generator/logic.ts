import { createRandom, intBetween, pickFrom } from '@/lib/random';
import {
  EMAIL_DOMAINS,
  ENGLISH_FIRST_NAMES,
  ENGLISH_LAST_NAMES,
  MOBILE_PREFIXES,
  STREET_WORDS,
  TEXT_WORDS,
  THAI_FIRST_NAMES,
  THAI_LAST_NAMES,
  THAI_LOCATIONS,
  type ThaiLocation,
} from '@/tools/mock-data-generator/data';

export const FIELD_TYPES = [
  'thai-name',
  'english-name',
  'email',
  'phone',
  'national-id',
  'province',
  'district',
  'subdistrict',
  'postcode',
  'address',
  'date',
  'number',
  'boolean',
  'uuid',
  'text',
  'list',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FORMATS = ['csv', 'json', 'sql'] as const;
export type ExportFormat = (typeof FORMATS)[number];

export const MAX_ROWS = 10_000;
export const LARGE_ROWS = 1_000;
export const DEFAULT_ROWS = 20;
export const MAX_COLUMNS = 20;
export const PREVIEW_ROWS = 10;

const ID_LENGTH = 13;
const ID_CHECK_WEIGHT_START = 13;
const ID_MODULUS = 11;
const DECIMAL = 10;
const PHONE_DIGITS = 8;
const HOUSE_MAX = 999;
const TEXT_WORDS_MIN = 2;
const TEXT_WORDS_MAX = 6;
const UUID_VARIANT_MASK = 0x3f;
const UUID_VARIANT = 0x80;
const UUID_VERSION_MASK = 0x0f;
const UUID_VERSION = 0x40;
const HEX = 16;
const BYTE_PAD = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEEDS_CSV_QUOTES = /[",\r\n]/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface Column {
  id: string;
  name: string;
  type: FieldType;
  /** Only some types use these: a range, or the list to draw from. */
  min: string;
  max: string;
  values: string;
}

export type CellValue = string | number | boolean;

export function emptyColumn(id: string, type: FieldType = 'thai-name'): Column {
  return { id, name: '', type, min: '', max: '', values: '' };
}

/**
 * The thirteenth digit of a Thai national ID is a check digit over the first
 * twelve, weighted 13 down to 2. Without it the numbers look right and fail
 * every form that validates them, which is the opposite of useful test data.
 */
export function nationalIdCheckDigit(first12: string): number {
  let sum = 0;
  for (let index = 0; index < first12.length; index += 1) {
    sum += Number(first12[index]) * (ID_CHECK_WEIGHT_START - index);
  }

  return (ID_MODULUS - (sum % ID_MODULUS)) % DECIMAL;
}

export function isValidNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  return Number(id[ID_LENGTH - 1]) === nationalIdCheckDigit(id.slice(0, 12));
}

export function makeNationalId(random: () => number): string {
  let digits = String(intBetween(1, 8, random));
  while (digits.length < ID_LENGTH - 1) {
    digits += String(intBetween(0, 9, random));
  }

  return `${digits}${nationalIdCheckDigit(digits)}`;
}

export function makePhone(random: () => number): string {
  let digits = pickFrom(MOBILE_PREFIXES, random);
  for (let index = 0; index < PHONE_DIGITS; index += 1) {
    digits += String(intBetween(0, 9, random));
  }

  return digits;
}

/** RFC 4122 v4 from the same generator as everything else, so a seed repeats it. */
export function makeUuid(random: () => number): string {
  const bytes = Array.from({ length: 16 }, () => intBetween(0, 255, random));

  bytes[6] = ((bytes[6] ?? 0) & UUID_VERSION_MASK) | UUID_VERSION;
  bytes[8] = ((bytes[8] ?? 0) & UUID_VARIANT_MASK) | UUID_VARIANT;

  const hex = bytes
    .map((byte) => byte.toString(HEX).padStart(BYTE_PAD, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export interface RowContext {
  thaiFirst: string;
  thaiLast: string;
  englishFirst: string;
  englishLast: string;
  location: ThaiLocation;
  house: number;
  street: string;
}

/**
 * Everything a row needs is drawn once, so columns agree with each other: the
 * postcode belongs to the district beside it, and the email is built from the
 * name in the next column rather than from a different person.
 */
export function makeRowContext(random: () => number): RowContext {
  return {
    thaiFirst: pickFrom(THAI_FIRST_NAMES, random),
    thaiLast: pickFrom(THAI_LAST_NAMES, random),
    englishFirst: pickFrom(ENGLISH_FIRST_NAMES, random),
    englishLast: pickFrom(ENGLISH_LAST_NAMES, random),
    location: pickFrom(THAI_LOCATIONS, random),
    house: intBetween(1, HOUSE_MAX, random),
    street: pickFrom(STREET_WORDS, random),
  };
}

function parseDate(raw: string, fallback: number): number {
  if (!ISO_DATE.test(raw.trim())) return fallback;

  const value = Date.parse(`${raw.trim()}T00:00:00Z`);
  return Number.isFinite(value) ? value : fallback;
}

export function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const DAY_MS = 86_400_000;
const DEFAULT_DATE_SPAN_DAYS = 365;

export function makeValue(
  column: Column,
  context: RowContext,
  random: () => number,
): CellValue {
  switch (column.type) {
    case 'thai-name':
      return `${context.thaiFirst} ${context.thaiLast}`;
    case 'english-name':
      return `${context.englishFirst} ${context.englishLast}`;
    case 'email':
      return `${context.englishFirst}.${context.englishLast}`.toLowerCase() +
        `@${pickFrom(EMAIL_DOMAINS, random)}`;
    case 'phone':
      return makePhone(random);
    case 'national-id':
      return makeNationalId(random);
    case 'province':
      return context.location.province;
    case 'district':
      return context.location.district;
    case 'subdistrict':
      return context.location.subdistrict;
    case 'postcode':
      return context.location.postcode;
    case 'address':
      return [
        `${context.house}`,
        context.street,
        context.location.subdistrict,
        context.location.district,
        context.location.province,
        context.location.postcode,
      ].join(' ');
    case 'date': {
      const now = Date.now();
      const from = parseDate(column.min, now - DEFAULT_DATE_SPAN_DAYS * DAY_MS);
      const to = parseDate(column.max, now);
      const [low, high] = from <= to ? [from, to] : [to, from];

      return new Date(low + Math.floor(random() * (high - low + 1)))
        .toISOString()
        .slice(0, 10);
    }
    case 'number': {
      const low = Number(column.min.trim() === '' ? 0 : column.min);
      const high = Number(column.max.trim() === '' ? 100 : column.max);
      if (!Number.isFinite(low) || !Number.isFinite(high)) return 0;

      return intBetween(Math.min(low, high), Math.max(low, high), random);
    }
    case 'boolean':
      return random() < 0.5;
    case 'uuid':
      return makeUuid(random);
    case 'list': {
      const values = splitList(column.values);
      return values.length === 0 ? '' : pickFrom(values, random);
    }
    default: {
      const count = intBetween(TEXT_WORDS_MIN, TEXT_WORDS_MAX, random);
      return Array.from({ length: count }, () => pickFrom(TEXT_WORDS, random)).join(' ');
    }
  }
}

export function columnName(column: Column, index: number): string {
  const trimmed = column.name.trim();
  return trimmed.length === 0 ? `column_${index + 1}` : trimmed;
}

export function generateRows(
  columns: Column[],
  count: number,
  seed: number | null,
): Array<Record<string, CellValue>> {
  const random = createRandom(seed);
  const rows: Array<Record<string, CellValue>> = [];

  for (let index = 0; index < count; index += 1) {
    const context = makeRowContext(random);
    const row: Record<string, CellValue> = {};

    columns.forEach((column, position) => {
      row[columnName(column, position)] = makeValue(column, context, random);
    });

    rows.push(row);
  }

  return rows;
}

/** RFC 4180: a field with a quote, a comma or a newline is quoted, and its
 * quotes are doubled. Joining with commas and hoping is how a CSV breaks. */
export function escapeCsv(value: CellValue): string {
  const text = String(value);
  if (!NEEDS_CSV_QUOTES.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Record<string, CellValue>>, headers: string[]): string {
  const lines = [headers.map(escapeCsv).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','));
  }

  return lines.join('\n');
}

export function toJson(rows: Array<Record<string, CellValue>>): string {
  return JSON.stringify(rows, null, 2);
}

/** Standard SQL: a quote inside a string literal is written twice. */
export function escapeSqlString(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

export function quoteSqlIdentifier(name: string): string {
  return IDENTIFIER.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

export function toSqlValue(value: CellValue): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return escapeSqlString(value);
}

export function toSql(
  rows: Array<Record<string, CellValue>>,
  headers: string[],
  table: string,
): string {
  const tableName = quoteSqlIdentifier(table.trim().length === 0 ? 'mock_data' : table);
  const columns = headers.map(quoteSqlIdentifier).join(', ');

  return rows
    .map((row) => {
      const values = headers.map((header) => toSqlValue(row[header] ?? '')).join(', ');
      return `INSERT INTO ${tableName} (${columns}) VALUES (${values});`;
    })
    .join('\n');
}

export function clampRows(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_ROWS;
  return Math.min(MAX_ROWS, Math.max(1, Math.floor(count)));
}

// Columns travel as JSON tuples: a list of values may hold a comma, and every
// separator worth reading would have to be escaped anyway.
export function encodeColumns(columns: Column[]): string {
  if (columns.length === 0) return '';

  return JSON.stringify(
    columns.map((column) => [
      column.name,
      column.type,
      column.min,
      column.max,
      column.values,
    ]),
  );
}

export function decodeColumns(raw: string | undefined): Column[] {
  if (raw === undefined || raw.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, MAX_COLUMNS)
    .filter(
      (tuple): tuple is string[] =>
        Array.isArray(tuple) &&
        tuple.length === 5 &&
        tuple.every((field) => typeof field === 'string') &&
        FIELD_TYPES.includes(tuple[1] as FieldType),
    )
    .map((tuple, index) => ({
      id: `url-${index}`,
      name: tuple[0] ?? '',
      type: tuple[1] as FieldType,
      min: tuple[2] ?? '',
      max: tuple[3] ?? '',
      values: tuple[4] ?? '',
    }));
}
