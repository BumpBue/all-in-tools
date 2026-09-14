import { describe, expect, it } from 'vitest';

import {
  buildQuery,
  buildUrl,
  decode,
  differsBetweenModes,
  encode,
  parseQuery,
  parseUrl,
  spaceEncoding,
} from '@/tools/url-encoder/logic';

const THAI = 'ทดสอบ';
const FULL_URL = 'https://example.com:8443/a/b?q=hello%20world&tag=ไทย&tag=two&flag#top';
/** What the URL parser normalizes the raw Thai above into. */
const FULL_URL_NORMALIZED =
  'https://example.com:8443/a/b?q=hello%20world&tag=%E0%B9%84%E0%B8%97%E0%B8%A2&tag=two&flag#top';

function params(query: string, plusAsSpace = false) {
  return parseQuery(query, plusAsSpace).map((param) => [
    param.key,
    param.value,
    param.hasValue,
  ]);
}

describe('encode modes', () => {
  it('component escapes the reserved characters that uri keeps', () => {
    expect(encode('a/b?c=d&e', 'component')).toBe('a%2Fb%3Fc%3Dd%26e');
    expect(encode('a/b?c=d&e', 'uri')).toBe('a/b?c=d&e');
  });

  it('both escape a space', () => {
    expect(encode('a b', 'component')).toBe('a%20b');
    expect(encode('a b', 'uri')).toBe('a%20b');
  });

  it('both encode Thai the same way', () => {
    expect(encode(THAI, 'component')).toBe(encode(THAI, 'uri'));
    expect(encode(THAI, 'component')).toBe('%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A');
  });

  it('reports when the two modes would differ', () => {
    expect(differsBetweenModes('a/b')).toBe(true);
    expect(differsBetweenModes('plain')).toBe(false);
    expect(differsBetweenModes(THAI)).toBe(false);
  });

  it('round-trips through decode', () => {
    expect(decode(encode(THAI, 'component'))).toEqual({ ok: true, value: THAI });
  });
});

describe('decode failures', () => {
  it('reports a malformed escape rather than throwing', () => {
    expect(decode('%E0%A4%A')).toEqual({ ok: false, code: 'malformed-escape' });
    expect(decode('%ZZ')).toEqual({ ok: false, code: 'malformed-escape' });
  });

  it('leaves a bare percent sign as an error', () => {
    expect(decode('100%').ok).toBe(false);
  });

  it('decodes an empty string to an empty string', () => {
    expect(decode('')).toEqual({ ok: true, value: '' });
  });
});

describe('parseQuery', () => {
  it('splits pairs and decodes both sides', () => {
    expect(params('a=1&b=hello%20world')).toEqual([
      ['a', '1', true],
      ['b', 'hello world', true],
    ]);
  });

  it('keeps repeated keys as separate rows', () => {
    expect(params('tag=one&tag=two')).toEqual([
      ['tag', 'one', true],
      ['tag', 'two', true],
    ]);
  });

  it('tells a bare flag from an empty value', () => {
    expect(params('flag&empty=')).toEqual([
      ['flag', '', false],
      ['empty', '', true],
    ]);
  });

  it('leaves plus alone by default', () => {
    expect(params('q=a+b')).toEqual([['q', 'a+b', true]]);
  });

  it('reads plus as a space when asked', () => {
    expect(params('q=a+b', true)).toEqual([['q', 'a b', true]]);
  });

  it('keeps a malformed escape as written instead of dropping the row', () => {
    expect(params('q=%E0%A4%A')).toEqual([['q', '%E0%A4%A', true]]);
  });

  it('ignores a leading question mark and empty pairs', () => {
    expect(params('?a=1&&b=2')).toEqual([
      ['a', '1', true],
      ['b', '2', true],
    ]);
  });

  it('returns nothing for an empty query', () => {
    expect(parseQuery('', false)).toEqual([]);
    expect(parseQuery('?', false)).toEqual([]);
  });

  it('decodes a Thai value', () => {
    expect(params('q=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A')).toEqual([
      ['q', THAI, true],
    ]);
  });
});

describe('buildQuery', () => {
  it('re-encodes both sides', () => {
    expect(
      buildQuery([{ key: 'a b', value: 'c/d', hasValue: true }], false),
    ).toBe('a%20b=c%2Fd');
  });

  it('keeps a bare flag bare', () => {
    expect(buildQuery([{ key: 'flag', value: '', hasValue: false }], false)).toBe(
      'flag',
    );
  });

  it('keeps an empty value as an empty value', () => {
    expect(buildQuery([{ key: 'a', value: '', hasValue: true }], false)).toBe('a=');
  });

  it('writes spaces as plus when asked', () => {
    expect(buildQuery([{ key: 'q', value: 'a b', hasValue: true }], true)).toBe(
      'q=a+b',
    );
  });

  it('drops a row with no key and no value', () => {
    expect(buildQuery([{ key: '', value: '', hasValue: false }], false)).toBe('');
  });

  it('survives a round trip with repeated keys', () => {
    const original = 'tag=one&tag=two&flag';
    expect(buildQuery(parseQuery(original, false), false)).toBe(original);
  });
});

describe('parseUrl', () => {
  it('splits a full url into its parts', () => {
    const parsed = parseUrl(FULL_URL, false);
    expect(parsed?.parts).toEqual({
      protocol: 'https',
      host: 'example.com:8443',
      path: '/a/b',
      query: 'q=hello%20world&tag=%E0%B9%84%E0%B8%97%E0%B8%A2&tag=two&flag',
      hash: 'top',
    });
  });

  it('lists the query as decoded rows', () => {
    const parsed = parseUrl(FULL_URL, false);
    expect(parsed?.params.map((param) => [param.key, param.value])).toEqual([
      ['q', 'hello world'],
      ['tag', 'ไทย'],
      ['tag', 'two'],
      ['flag', ''],
    ]);
  });

  it('reads a path with no scheme as relative', () => {
    const parsed = parseUrl('/search?q=1', false);
    expect(parsed?.relative).toBe(true);
    expect(parsed?.parts.host).toBe('');
    expect(parsed?.parts.path).toBe('/search');
  });

  it('returns nothing for an empty input', () => {
    expect(parseUrl('', false)).toBeNull();
    expect(parseUrl('   ', false)).toBeNull();
  });

  it('handles a url with no query or hash', () => {
    const parsed = parseUrl('https://example.com', false);
    expect(parsed?.parts.query).toBe('');
    expect(parsed?.parts.hash).toBe('');
    expect(parsed?.params).toEqual([]);
  });
});

describe('buildUrl', () => {
  it('reassembles what parseUrl took apart', () => {
    const parsed = parseUrl(FULL_URL_NORMALIZED, false);
    if (!parsed) throw new Error('expected a parse');

    expect(buildUrl(parsed.parts, parsed.params, false)).toBe(FULL_URL_NORMALIZED);
  });

  it('normalizes raw non-ascii that was pasted unencoded', () => {
    const parsed = parseUrl(FULL_URL, false);
    if (!parsed) throw new Error('expected a parse');

    expect(buildUrl(parsed.parts, parsed.params, false)).toBe(FULL_URL_NORMALIZED);
  });

  it('reflects an edited parameter', () => {
    const parsed = parseUrl('https://example.com/a?q=old', false);
    if (!parsed) throw new Error('expected a parse');

    const edited = parsed.params.map((param) => ({ ...param, value: 'new' }));
    expect(buildUrl(parsed.parts, edited, false)).toBe('https://example.com/a?q=new');
  });

  it('omits the query when every parameter is removed', () => {
    const parsed = parseUrl('https://example.com/a?q=1', false);
    if (!parsed) throw new Error('expected a parse');

    expect(buildUrl(parsed.parts, [], false)).toBe('https://example.com/a');
  });

  it('keeps a relative url relative', () => {
    const parsed = parseUrl('/search?q=1', false);
    if (!parsed) throw new Error('expected a parse');

    expect(buildUrl(parsed.parts, parsed.params, false)).toBe('/search?q=1');
  });
});

describe('spaceEncoding', () => {
  it('names how a space will be written', () => {
    expect(spaceEncoding(false)).toBe('%20');
    expect(spaceEncoding(true)).toBe('+');
  });
});
