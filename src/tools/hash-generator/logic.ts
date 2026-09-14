import { md5 } from '@/tools/hash-generator/md5';

export const HASH_ALGORITHMS = [
  'MD5',
  'SHA-1',
  'SHA-256',
  'SHA-384',
  'SHA-512',
] as const;

export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** Fine for checking a download against a published digest, not for security. */
export const WEAK_ALGORITHMS: readonly HashAlgorithm[] = ['MD5', 'SHA-1'];

/**
 * WebCrypto has no incremental digest, so a file has to be in memory as one
 * buffer before it can be hashed. This cap keeps that from becoming the tab's
 * problem.
 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const FILE_CHUNK_BYTES = 1024 * 1024;

const HEX_DIGITS = 2;

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(HEX_DIGITS, '0')).join('');
}

export function isWeak(algorithm: HashAlgorithm): boolean {
  return WEAK_ALGORITHMS.includes(algorithm);
}

export async function digest(
  algorithm: HashAlgorithm,
  bytes: Uint8Array,
): Promise<string> {
  if (algorithm === 'MD5') return toHex(md5(bytes));

  const buffer = await crypto.subtle.digest(
    algorithm,
    bytes.slice().buffer as ArrayBuffer,
  );
  return toHex(new Uint8Array(buffer));
}

export async function digestAll(
  bytes: Uint8Array,
): Promise<Record<HashAlgorithm, string>> {
  const entries = await Promise.all(
    HASH_ALGORITHMS.map(async (algorithm) => [
      algorithm,
      await digest(algorithm, bytes),
    ]),
  );

  return Object.fromEntries(entries) as Record<HashAlgorithm, string>;
}

export type ComparisonResult = 'idle' | 'match' | 'mismatch';

/** Published digests come in either case and often with stray whitespace. */
export function compareDigest(expected: string, actual: string): ComparisonResult {
  const cleaned = expected.trim().toLowerCase();
  if (cleaned.length === 0) return 'idle';
  return cleaned === actual.trim().toLowerCase() ? 'match' : 'mismatch';
}

export function whichAlgorithmByLength(
  expected: string,
): HashAlgorithm | undefined {
  const lengths: Record<number, HashAlgorithm> = {
    32: 'MD5',
    40: 'SHA-1',
    64: 'SHA-256',
    96: 'SHA-384',
    128: 'SHA-512',
  };

  return lengths[expected.trim().length];
}

export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Reads in chunks so progress can be reported on a large file, then hands back
 * one buffer because crypto.subtle.digest cannot take it any other way.
 */
export async function readFileBytes(
  file: Blob,
  onProgress: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  const total = file.size;
  const bytes = new Uint8Array(total);
  let loaded = 0;

  while (loaded < total) {
    const end = Math.min(loaded + FILE_CHUNK_BYTES, total);
    const chunk = new Uint8Array(await file.slice(loaded, end).arrayBuffer());
    bytes.set(chunk, loaded);
    loaded = end;
    onProgress(loaded, total);
  }

  return bytes;
}
