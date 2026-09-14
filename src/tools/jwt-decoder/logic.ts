export const JWT_PART_COUNT = 3;

export const STANDARD_CLAIMS = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti'] as const;
export type StandardClaim = (typeof STANDARD_CLAIMS)[number];

/** Verification is only possible for the ones WebCrypto can do with a secret. */
export const HMAC_HASHES: Readonly<Record<string, string>> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

export const JSON_INDENT = 2;
const MILLISECONDS_PER_SECOND = 1000;
const BASE64_GROUP = 4;

const BEARER_PREFIX = /^bearer\s+/i;
const BASE64_URL_ONLY = /^[A-Za-z0-9_-]*$/;

export type JwtPart = 'header' | 'payload' | 'signature';

export type JwtErrorCode =
  | 'empty'
  | 'wrong-part-count'
  | 'bad-base64'
  | 'bad-json'
  | 'not-an-object';

export interface JwtFailure {
  ok: false;
  code: JwtErrorCode;
  /** Which of the three pieces broke, when the failure belongs to one. */
  part: JwtPart | null;
  detail: string;
}

export type Claims = Record<string, unknown>;

export interface Jwt {
  ok: true;
  header: Claims;
  payload: Claims;
  /** What the signature is computed over: the first two parts and the dot. */
  signingInput: string;
  signature: string;
  algorithm: string | null;
  type: string | null;
}

export type JwtResult = Jwt | JwtFailure;

export function base64UrlToBytes(part: string): Uint8Array | null {
  if (!BASE64_URL_ONLY.test(part)) return null;

  const padding = (BASE64_GROUP - (part.length % BASE64_GROUP)) % BASE64_GROUP;
  const base64 = part.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(padding);

  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function decodeBase64UrlText(part: string): string | null {
  const bytes = base64UrlToBytes(part);
  if (bytes === null) return null;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function readSegment(
  part: JwtPart,
  raw: string,
): { ok: true; value: Claims } | JwtFailure {
  const text = decodeBase64UrlText(raw);
  if (text === null) {
    return { ok: false, code: 'bad-base64', part, detail: raw.slice(0, 40) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      code: 'bad-json',
      part,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, code: 'not-an-object', part, detail: text.slice(0, 40) };
  }

  return { ok: true, value: parsed as Claims };
}

function stringClaim(claims: Claims, name: string): string | null {
  const value = claims[name];
  return typeof value === 'string' ? value : null;
}

export function decodeJwt(raw: string): JwtResult {
  const token = raw.trim().replace(BEARER_PREFIX, '');

  if (token.length === 0) {
    return { ok: false, code: 'empty', part: null, detail: '' };
  }

  const parts = token.split('.');
  if (parts.length !== JWT_PART_COUNT) {
    return {
      ok: false,
      code: 'wrong-part-count',
      part: null,
      detail: String(parts.length),
    };
  }

  const [rawHeader = '', rawPayload = '', signature = ''] = parts;

  const header = readSegment('header', rawHeader);
  if (!header.ok) return header;

  const payload = readSegment('payload', rawPayload);
  if (!payload.ok) return payload;

  return {
    ok: true,
    header: header.value,
    payload: payload.value,
    signingInput: `${rawHeader}.${rawPayload}`,
    signature,
    algorithm: stringClaim(header.value, 'alg'),
    type: stringClaim(header.value, 'typ'),
  };
}

export function numberClaim(claims: Claims, name: string): number | null {
  const value = claims[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** exp, nbf and iat are seconds since the epoch; everything else here is ms. */
export function claimTimeMs(claims: Claims, name: string): number | null {
  const seconds = numberClaim(claims, name);
  return seconds === null ? null : seconds * MILLISECONDS_PER_SECOND;
}

export type ValidityState = 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry';

export interface Validity {
  state: ValidityState;
  expiresAt: number | null;
  notBefore: number | null;
  issuedAt: number | null;
}

export function readValidity(claims: Claims, nowMs: number): Validity {
  const expiresAt = claimTimeMs(claims, 'exp');
  const notBefore = claimTimeMs(claims, 'nbf');
  const issuedAt = claimTimeMs(claims, 'iat');

  const state: ValidityState =
    expiresAt !== null && nowMs >= expiresAt
      ? 'expired'
      : notBefore !== null && nowMs < notBefore
        ? 'not-yet-valid'
        : expiresAt === null
          ? 'no-expiry'
          : 'valid';

  return { state, expiresAt, notBefore, issuedAt };
}

/** aud is allowed to be one string or a list of them. */
export function audienceList(claims: Claims): string[] {
  const value = claims['aud'];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  return [];
}

export function isStandardClaim(name: string): name is StandardClaim {
  return (STANDARD_CLAIMS as readonly string[]).includes(name);
}

export function splitClaims(claims: Claims): {
  standard: Array<[StandardClaim, unknown]>;
  extra: Array<[string, unknown]>;
} {
  const standard: Array<[StandardClaim, unknown]> = [];
  const extra: Array<[string, unknown]> = [];

  for (const [name, value] of Object.entries(claims)) {
    if (isStandardClaim(name)) standard.push([name, value]);
    else extra.push([name, value]);
  }

  standard.sort(
    (left, right) => STANDARD_CLAIMS.indexOf(left[0]) - STANDARD_CLAIMS.indexOf(right[0]),
  );

  return { standard, extra };
}

export function formatClaims(claims: Claims): string {
  return JSON.stringify(claims, null, JSON_INDENT);
}

export function claimText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export type VerifyErrorCode =
  | 'no-algorithm'
  | 'unsupported-algorithm'
  | 'bad-signature-encoding'
  | 'empty-secret'
  | 'crypto-unavailable'
  | 'crypto-failed';

export type VerifyResult =
  | { ok: true; valid: boolean }
  | { ok: false; code: VerifyErrorCode; detail: string };

export function canVerify(algorithm: string | null): boolean {
  return algorithm !== null && algorithm in HMAC_HASHES;
}

/**
 * Checks an HMAC signature with the secret the reader typed. The secret never
 * leaves this function: WebCrypto runs in the page, and nothing here is sent
 * anywhere or written down.
 */
/** The three fields a signature check needs, so the caller can pass primitives. */
export interface SignedToken {
  algorithm: string | null;
  signature: string;
  signingInput: string;
}

export async function verifyHmac(
  token: SignedToken,
  secret: string,
): Promise<VerifyResult> {
  if (token.algorithm === null) {
    return { ok: false, code: 'no-algorithm', detail: '' };
  }

  const hash = HMAC_HASHES[token.algorithm];
  if (hash === undefined) {
    return { ok: false, code: 'unsupported-algorithm', detail: token.algorithm };
  }

  const signature = base64UrlToBytes(token.signature);
  if (signature === null) {
    return { ok: false, code: 'bad-signature-encoding', detail: token.signature.slice(0, 40) };
  }

  // HMAC itself is defined for an empty key, but WebCrypto refuses to import
  // one, so this has to be answered before asking it.
  if (secret.length === 0) {
    return { ok: false, code: 'empty-secret', detail: '' };
  }

  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    return { ok: false, code: 'crypto-unavailable', detail: '' };
  }

  const encoder = new TextEncoder();

  try {
    const key = await subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash },
      false,
      ['verify'],
    );

    const valid = await subtle.verify(
      'HMAC',
      key,
      signature.slice().buffer as ArrayBuffer,
      encoder.encode(token.signingInput),
    );

    return { ok: true, valid };
  } catch (error) {
    return {
      ok: false,
      code: 'crypto-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
