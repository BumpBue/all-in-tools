export const ID_KINDS = ['uuid-v4', 'uuid-v7', 'nanoid', 'custom'] as const;
export type IdKind = (typeof ID_KINDS)[number];

export const MIN_COUNT = 1;
export const MAX_COUNT = 1000;

export const NANOID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
export const NANOID_DEFAULT_LENGTH = 21;

export const MIN_CUSTOM_LENGTH = 1;
export const MAX_CUSTOM_LENGTH = 128;
/** Rejection sampling needs a byte to address the alphabet. */
export const MAX_ALPHABET_SIZE = 256;

const UUID_BYTES = 16;
const TIMESTAMP_BYTES = 6;
const HEX = 16;
const HYPHEN_POSITIONS = [8, 12, 16, 20];
const BYTE_MAX = 256;

/**
 * RFC 9562 lets the 12 bits after the timestamp hold a counter so ids made in
 * the same millisecond still sort. Without it a batch generated in one tick is
 * ordered only by chance, which defeats the reason to pick v7 at all.
 *
 * Seeded randomly in the lower half of the range so the next value is not
 * guessable, leaving room for a full batch before it could saturate.
 */
const COUNTER_MASK = 0x0fff;
const COUNTER_SEED_MASK = 0x07ff;

let lastMilliseconds = -1;
let counter = 0;

function nextCounter(milliseconds: number): number {
  if (milliseconds === lastMilliseconds) {
    counter = Math.min(counter + 1, COUNTER_MASK);
    return counter;
  }

  lastMilliseconds = milliseconds;
  const seed = new Uint8Array(2);
  crypto.getRandomValues(seed);
  counter = ((seed[0] << 8) | seed[1]) & COUNTER_SEED_MASK;
  return counter;
}

export interface IdOptions {
  kind: IdKind;
  count: number;
  uppercase: boolean;
  hyphens: boolean;
  alphabet: string;
  length: number;
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toHexString(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(HEX).padStart(2, '0')).join('');
}

function withHyphens(hex: string): string {
  let out = '';
  let previous = 0;

  for (const position of HYPHEN_POSITIONS) {
    out += `${hex.slice(previous, position)}-`;
    previous = position;
  }

  return out + hex.slice(previous);
}

function stampVersion(bytes: Uint8Array, version: number): Uint8Array {
  const stamped = bytes.slice();
  stamped[6] = (stamped[6] & 0x0f) | (version << 4);
  stamped[8] = (stamped[8] & 0x3f) | 0x80;
  return stamped;
}

export function uuidV4(): string {
  return withHyphens(toHexString(stampVersion(randomBytes(UUID_BYTES), 4)));
}

/**
 * Version 7 puts a millisecond timestamp in the leading 48 bits, so ids sort in
 * creation order. That is what makes it usable as a primary key without
 * scattering writes across an index the way v4 does.
 */
export function uuidV7(milliseconds: number = Date.now()): string {
  const stamp = Math.floor(milliseconds);
  const bytes = randomBytes(UUID_BYTES);

  let remaining = stamp;
  for (let index = TIMESTAMP_BYTES - 1; index >= 0; index -= 1) {
    bytes[index] = remaining % BYTE_MAX;
    remaining = Math.floor(remaining / BYTE_MAX);
  }

  const sequence = nextCounter(stamp);
  bytes[6] = (sequence >> 8) & 0x0f;
  bytes[7] = sequence & 0xff;

  return withHyphens(toHexString(stampVersion(bytes, 7)));
}

export function extractV7Time(uuid: string): number | null {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (hex.length !== UUID_BYTES * 2) return null;
  if (hex[12] !== '7') return null;

  const timestamp = Number.parseInt(hex.slice(0, TIMESTAMP_BYTES * 2), HEX);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isValidAlphabet(alphabet: string): boolean {
  const unique = new Set([...alphabet]);
  return unique.size >= 2 && unique.size <= MAX_ALPHABET_SIZE;
}

/**
 * Rejection sampling rather than a modulo of the raw byte: taking byte % size
 * makes the first `256 % size` characters more likely than the rest.
 */
export function randomFromAlphabet(alphabet: string, length: number): string {
  const characters = [...new Set([...alphabet])];
  if (characters.length < 2 || characters.length > MAX_ALPHABET_SIZE) return '';
  if (length <= 0) return '';

  const ceiling = Math.floor(BYTE_MAX / characters.length) * characters.length;
  const out: string[] = [];

  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (out.length === length) break;
      if (byte < ceiling) out.push(characters[byte % characters.length]);
    }
  }

  return out.join('');
}

export function nanoid(length: number = NANOID_DEFAULT_LENGTH): string {
  return randomFromAlphabet(NANOID_ALPHABET, length);
}

export function formatId(id: string, uppercase: boolean, hyphens: boolean): string {
  const withCase = uppercase ? id.toUpperCase() : id;
  return hyphens ? withCase : withCase.replace(/-/g, '');
}

export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return MIN_COUNT;
  return Math.min(Math.max(Math.trunc(value), MIN_COUNT), MAX_COUNT);
}

export function clampLength(value: number): number {
  if (!Number.isFinite(value)) return NANOID_DEFAULT_LENGTH;
  return Math.min(Math.max(Math.trunc(value), MIN_CUSTOM_LENGTH), MAX_CUSTOM_LENGTH);
}

export function generate(options: IdOptions): string[] {
  const count = clampCount(options.count);
  const length = clampLength(options.length);

  return Array.from({ length: count }, () => {
    switch (options.kind) {
      case 'uuid-v4':
        return formatId(uuidV4(), options.uppercase, options.hyphens);
      case 'uuid-v7':
        return formatId(uuidV7(), options.uppercase, options.hyphens);
      case 'nanoid':
        return nanoid(length);
      default:
        return randomFromAlphabet(options.alphabet, length);
    }
  });
}
