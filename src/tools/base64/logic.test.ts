import { describe, expect, it } from 'vitest';

import {
  bytesToBase64,
  bytesToText,
  decodeText,
  decodeToBytes,
  encodeText,
  fromUrlSafe,
  toUrlSafe,
} from '@/tools/base64/logic';

const THAI = 'สวัสดีครับ';
const EMOJI = '🇹🇭 ทดสอบ 👨‍👩‍👧‍👦';
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function roundTrip(text: string, variant: 'standard' | 'url-safe' = 'standard') {
  const result = decodeText(encodeText(text, variant));
  if (!result.ok) throw new Error(`round trip failed for "${text}"`);
  return result.text;
}

describe('encoding text', () => {
  it('matches the known encoding for ascii', () => {
    expect(encodeText('Man', 'standard')).toBe('TWFu');
    expect(encodeText('hello world', 'standard')).toBe('aGVsbG8gd29ybGQ=');
  });

  it('pads to a multiple of four', () => {
    expect(encodeText('a', 'standard')).toBe('YQ==');
    expect(encodeText('ab', 'standard')).toBe('YWI=');
    expect(encodeText('abc', 'standard')).toBe('YWJj');
  });

  it('encodes an empty string as an empty string', () => {
    expect(encodeText('', 'standard')).toBe('');
  });

  it('handles Thai, which btoa alone cannot', () => {
    expect(() => btoa(THAI)).toThrow();
    expect(encodeText(THAI, 'standard')).toBe('4Liq4Lin4Lix4Liq4LiU4Li14LiE4Lij4Lix4Lia');
  });

  it('round-trips Thai', () => {
    expect(roundTrip(THAI)).toBe(THAI);
  });

  it('round-trips emoji, including a joined family sequence', () => {
    expect(roundTrip(EMOJI)).toBe(EMOJI);
  });

  it('round-trips a mix of scripts and control whitespace', () => {
    const mixed = 'a\tb\nค\r\nd 🙂';
    expect(roundTrip(mixed)).toBe(mixed);
  });
});

describe('the url-safe variant', () => {
  const withBothSpecials = new Uint8Array([0xfb, 0xff, 0xbf]);

  it('replaces the two characters that are unsafe in a url', () => {
    const standard = bytesToBase64(withBothSpecials, 'standard');
    const safe = bytesToBase64(withBothSpecials, 'url-safe');

    expect(standard).toContain('+');
    expect(standard).toContain('/');
    expect(safe).not.toContain('+');
    expect(safe).not.toContain('/');
  });

  it('drops padding', () => {
    expect(encodeText('a', 'url-safe')).toBe('YQ');
    expect(encodeText('ab', 'url-safe')).toBe('YWI');
  });

  it('round-trips without padding', () => {
    expect(roundTrip(THAI, 'url-safe')).toBe(THAI);
    expect(roundTrip('a', 'url-safe')).toBe('a');
  });

  it('converts between the two forms', () => {
    expect(toUrlSafe('ab+/cd==')).toBe('ab-_cd');
    expect(fromUrlSafe('ab-_cd')).toBe('ab+/cd');
  });

  it('decodes either form without being told which', () => {
    const standard = encodeText(THAI, 'standard');
    const safe = encodeText(THAI, 'url-safe');

    expect(decodeText(standard)).toMatchObject({ ok: true, text: THAI });
    expect(decodeText(safe)).toMatchObject({ ok: true, text: THAI });
  });
});

describe('decoding failures name the reason', () => {
  it('reports an empty input', () => {
    expect(decodeToBytes('')).toMatchObject({ code: 'empty' });
    expect(decodeToBytes('   \n ')).toMatchObject({ code: 'empty' });
  });

  it('reports a character outside the alphabet', () => {
    const result = decodeToBytes('YWJj$');
    expect(result).toMatchObject({ ok: false, code: 'invalid-character' });
    if (!result.ok) expect(result.character).toBe('$');
  });

  it('reports a length that cannot be base64', () => {
    expect(decodeToBytes('YWJjY')).toMatchObject({ code: 'invalid-length' });
  });

  it('accepts input with missing padding', () => {
    expect(decodeText('YWJj')).toMatchObject({ ok: true, text: 'abc' });
    expect(decodeText('YQ')).toMatchObject({ ok: true, text: 'a' });
  });

  it('ignores whitespace and line breaks inside the input', () => {
    expect(decodeText('aGVs bG8g\nd29y bGQ=')).toMatchObject({
      ok: true,
      text: 'hello world',
    });
  });
});

describe('binary payloads', () => {
  it('reports bytes that are not valid utf-8 as not text', () => {
    const encoded = bytesToBase64(PNG_HEADER, 'standard');
    const result = decodeText(encoded);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('not-text');
      expect(result.bytes).toEqual(PNG_HEADER);
    }
  });

  it('treats a NUL byte as binary even though it decodes', () => {
    expect(bytesToText(new Uint8Array([0x41, 0x00, 0x42]))).toMatchObject({
      code: 'not-text',
    });
  });

  it('accepts valid utf-8 as text', () => {
    expect(bytesToText(new TextEncoder().encode(THAI))).toMatchObject({
      ok: true,
      text: THAI,
    });
  });

  it('round-trips arbitrary bytes without a text detour', () => {
    const bytes = new Uint8Array(256);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;

    const decoded = decodeToBytes(bytesToBase64(bytes, 'standard'));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.bytes).toEqual(bytes);
  });

  it('handles an input larger than one encoding chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(0x41);
    const decoded = decodeToBytes(bytesToBase64(bytes, 'standard'));

    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.bytes.length).toBe(bytes.length);
  });
});
