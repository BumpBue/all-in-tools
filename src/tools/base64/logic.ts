export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type Base64Variant = 'standard' | 'url-safe';

export type DecodeErrorCode = 'empty' | 'invalid-character' | 'invalid-length';

export interface DecodeFailure {
  ok: false;
  code: DecodeErrorCode;
  character?: string;
}

export type DecodeResult = { ok: true; bytes: Uint8Array } | DecodeFailure;

export type TextResult =
  | { ok: true; text: string }
  | { ok: false; code: 'not-text' };

// String.fromCharCode is applied to a whole chunk at a time; a chunk much
// larger than this overflows the call stack on big inputs.
const BINARY_CHUNK = 0x8000;

const STANDARD_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;
const PADDING = /=+$/;
const IGNORED_WHITESPACE = /\s+/g;
const BASE64_GROUP = 4;
const NUL_BYTE = 0;

export function toUrlSafe(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(PADDING, '');
}

export function fromUrlSafe(base64: string): string {
  return base64.replace(/-/g, '+').replace(/_/g, '/');
}

export function bytesToBase64(bytes: Uint8Array, variant: Base64Variant): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BINARY_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BINARY_CHUNK));
  }

  const encoded = btoa(binary);
  return variant === 'url-safe' ? toUrlSafe(encoded) : encoded;
}

/** btoa cannot take Thai or emoji; encoding to UTF-8 bytes first can. */
export function encodeText(text: string, variant: Base64Variant): string {
  return bytesToBase64(new TextEncoder().encode(text), variant);
}

export function decodeToBytes(raw: string): DecodeResult {
  const stripped = raw.replace(IGNORED_WHITESPACE, '');
  if (stripped.length === 0) return { ok: false, code: 'empty' };

  const normalized = fromUrlSafe(stripped);
  if (!STANDARD_ALPHABET.test(normalized)) {
    const character = [...normalized].find(
      (candidate) => !STANDARD_ALPHABET.test(candidate.replace('=', '')),
    );
    return { ok: false, code: 'invalid-character', character };
  }

  const unpadded = normalized.replace(PADDING, '');
  const remainder = unpadded.length % BASE64_GROUP;
  if (remainder === 1) return { ok: false, code: 'invalid-length' };

  const padded = unpadded.padEnd(
    unpadded.length + ((BASE64_GROUP - remainder) % BASE64_GROUP),
    '=',
  );

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { ok: true, bytes };
  } catch {
    return { ok: false, code: 'invalid-character' };
  }
}

/** Fails rather than returning replacement characters, so binary is detectable. */
export function bytesToText(bytes: Uint8Array): TextResult {
  if (bytes.includes(NUL_BYTE)) return { ok: false, code: 'not-text' };

  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, code: 'not-text' };
  }
}

export type DecodeTextResult =
  | { ok: true; text: string; bytes: Uint8Array }
  | { ok: false; code: DecodeErrorCode | 'not-text'; character?: string; bytes?: Uint8Array };

export function decodeText(raw: string): DecodeTextResult {
  const decoded = decodeToBytes(raw);
  if (!decoded.ok) return decoded;

  const text = bytesToText(decoded.bytes);
  return text.ok
    ? { ok: true, text: text.text, bytes: decoded.bytes }
    : { ok: false, code: 'not-text', bytes: decoded.bytes };
}
