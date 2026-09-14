export type EncodeMode = 'component' | 'uri';

export type DecodeErrorCode = 'malformed-escape';

export type DecodeResult =
  | { ok: true; value: string }
  | { ok: false; code: DecodeErrorCode };

export interface QueryParam {
  key: string;
  value: string;
  /** A bare `flag` is not the same as `flag=`, and rebuilding must keep it. */
  hasValue: boolean;
}

export interface UrlParts {
  protocol: string;
  host: string;
  path: string;
  query: string;
  hash: string;
}

export interface ParsedUrl {
  parts: UrlParts;
  params: QueryParam[];
  /** True when the input had no scheme and was read as a path. */
  relative: boolean;
}

const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid';
const LEADING_QUESTION = /^\?/;
const PAIR_SEPARATOR = '&';
const KEY_SEPARATOR = '=';
const PLUS = /\+/g;

export function encode(text: string, mode: EncodeMode): string {
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text);
}

export function decode(text: string): DecodeResult {
  try {
    return { ok: true, value: decodeURIComponent(text) };
  } catch {
    return { ok: false, code: 'malformed-escape' };
  }
}

/** Leaves the text as it stands rather than throwing, so a table still renders. */
function decodeLoosely(text: string, plusAsSpace: boolean): string {
  const prepared = plusAsSpace ? text.replace(PLUS, ' ') : text;
  const result = decode(prepared);
  return result.ok ? result.value : prepared;
}

export function parseQuery(query: string, plusAsSpace: boolean): QueryParam[] {
  const body = query.replace(LEADING_QUESTION, '');
  if (body.length === 0) return [];

  return body
    .split(PAIR_SEPARATOR)
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const separator = pair.indexOf(KEY_SEPARATOR);
      const rawKey = separator === -1 ? pair : pair.slice(0, separator);
      const rawValue = separator === -1 ? '' : pair.slice(separator + 1);

      return {
        key: decodeLoosely(rawKey, plusAsSpace),
        value: decodeLoosely(rawValue, plusAsSpace),
        hasValue: separator !== -1,
      };
    });
}

export function buildQuery(params: QueryParam[], plusAsSpace: boolean): string {
  const write = (text: string) => {
    const encoded = encodeURIComponent(text);
    return plusAsSpace ? encoded.replace(/%20/g, '+') : encoded;
  };

  return params
    .filter((param) => param.key.length > 0 || param.hasValue)
    .map((param) =>
      param.hasValue ? `${write(param.key)}=${write(param.value)}` : write(param.key),
    )
    .join(PAIR_SEPARATOR);
}

export function parseUrl(raw: string, plusAsSpace: boolean): ParsedUrl | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  let url: URL;
  let relative = false;

  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(trimmed, PLACEHOLDER_ORIGIN);
      relative = true;
    } catch {
      return null;
    }
  }

  return {
    parts: {
      protocol: relative ? '' : url.protocol.replace(':', ''),
      host: relative ? '' : url.host,
      path: url.pathname,
      query: url.search.replace(LEADING_QUESTION, ''),
      hash: url.hash.replace('#', ''),
    },
    params: parseQuery(url.search, plusAsSpace),
    relative,
  };
}

export function buildUrl(
  parts: UrlParts,
  params: QueryParam[],
  plusAsSpace: boolean,
): string {
  const query = buildQuery(params, plusAsSpace);
  const origin =
    parts.protocol.length > 0 && parts.host.length > 0
      ? `${parts.protocol}://${parts.host}`
      : '';

  return [
    origin,
    parts.path,
    query.length > 0 ? `?${query}` : '',
    parts.hash.length > 0 ? `#${parts.hash}` : '',
  ].join('');
}

/** What encodeURI leaves alone that encodeURIComponent does not. */
export const URI_RESERVED_CHARACTERS = ":/?#[]@!$&'()*+,;=";

export function differsBetweenModes(text: string): boolean {
  return encode(text, 'component') !== encode(text, 'uri');
}

export function spaceEncoding(plusAsSpace: boolean): string {
  return plusAsSpace ? '+' : encodeURIComponent(' ');
}
