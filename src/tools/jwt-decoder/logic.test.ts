import { describe, expect, it } from 'vitest';

import {
  HMAC_HASHES,
  STANDARD_CLAIMS,
  audienceList,
  base64UrlToBytes,
  canVerify,
  claimTimeMs,
  decodeBase64UrlText,
  decodeJwt,
  numberClaim,
  readValidity,
  splitClaims,
  verifyHmac,
  type Jwt,
} from '@/tools/jwt-decoder/logic';

// Signed with the secret below; the HS256 one is the vector jwt.io ships, and
// the other two were produced from the same header and payload.
const SECRET = 'your-256-bit-secret';

const HS256 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const HS384 =
  'eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.RGFdh_VuEuURSubru7xP4rbaA4boUyueI7rEm75l1cNdE9gQ7H6mx2DYpauBjX5S';

const HS512 =
  'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.pazba9Pj009HgANP4pTCQAHpXNU7pVbjIGff_plktSzsa9rXTGzFngaawzXGEO6Q0Hx5dtGi-dMDlIadV81o3Q';

/** {"name":"สมชาย","exp":1789000000,"iss":"toolbox"} */
const THAI_PAYLOAD =
  'eyJuYW1lIjoi4Liq4Lih4LiK4Liy4LiiIiwiZXhwIjoxNzg5MDAwMDAwLCJpc3MiOiJ0b29sYm94In0';

const SECOND_MS = 1000;

function decoded(token: string): Jwt {
  const result = decodeJwt(token);
  if (!result.ok) throw new Error(`expected the token to decode: ${result.code}`);
  return result;
}

function failure(token: string) {
  const result = decodeJwt(token);
  if (result.ok) throw new Error('expected the token to fail');
  return result;
}

describe('base64url', () => {
  it('decodes without padding', () => {
    expect(decodeBase64UrlText('eyJhIjoxfQ')).toBe('{"a":1}');
  });

  it('reads - and _ as + and /', () => {
    const bytes = base64UrlToBytes('-_8');
    expect(bytes && [...bytes]).toEqual([251, 255]);
  });

  it('keeps Thai text intact through UTF-8', () => {
    expect(decodeBase64UrlText(THAI_PAYLOAD)).toContain('สมชาย');
  });

  it('refuses characters that base64url does not use', () => {
    expect(base64UrlToBytes('ab+c')).toBeNull();
    expect(base64UrlToBytes('ab=c')).toBeNull();
  });

  it('refuses bytes that are not valid UTF-8', () => {
    // 0xFF alone is never a legal UTF-8 sequence.
    expect(decodeBase64UrlText('_w')).toBeNull();
  });

  it('accepts an empty part', () => {
    expect(decodeBase64UrlText('')).toBe('');
  });
});

describe('decodeJwt', () => {
  it('splits a token into its three pieces', () => {
    const token = decoded(HS256);

    expect(token.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(token.payload).toMatchObject({ sub: '1234567890', name: 'John Doe' });
    expect(token.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('signs over the header and payload, dot included', () => {
    const token = decoded(HS256);
    expect(token.signingInput).toBe(HS256.slice(0, HS256.lastIndexOf('.')));
  });

  it('reads the algorithm and type out of the header', () => {
    expect(decoded(HS384)).toMatchObject({ algorithm: 'HS384', type: 'JWT' });
  });

  it('ignores a Bearer prefix and surrounding space', () => {
    expect(decodeJwt(`  Bearer ${HS256}  `)).toMatchObject({ ok: true });
  });

  it('says when the token has the wrong number of pieces', () => {
    expect(failure('a.b')).toMatchObject({ code: 'wrong-part-count', detail: '2' });
    expect(failure('a.b.c.d')).toMatchObject({ code: 'wrong-part-count', detail: '4' });
  });

  it('reports an empty input on its own', () => {
    expect(failure('   ')).toMatchObject({ code: 'empty', part: null });
  });

  it('names the piece whose base64 is broken', () => {
    expect(failure('not*base64.eyJhIjoxfQ.sig')).toMatchObject({
      code: 'bad-base64',
      part: 'header',
    });
    expect(failure('eyJhIjoxfQ.not*base64.sig')).toMatchObject({
      code: 'bad-base64',
      part: 'payload',
    });
  });

  it('names the piece whose JSON is broken', () => {
    // "{oops" encoded, which decodes cleanly and then fails to parse.
    expect(failure('e29vcHM.eyJhIjoxfQ.sig')).toMatchObject({
      code: 'bad-json',
      part: 'header',
    });
  });

  it('rejects a piece that decodes to something other than an object', () => {
    // "[1,2]" and "42" are valid JSON but cannot be a header or a payload.
    expect(failure('WzEsMl0.eyJhIjoxfQ.sig')).toMatchObject({
      code: 'not-an-object',
      part: 'header',
    });
    expect(failure('eyJhIjoxfQ.NDI.sig')).toMatchObject({
      code: 'not-an-object',
      part: 'payload',
    });
  });

  it('decodes a token whose signature is missing, which is what alg none looks like', () => {
    expect(decodeJwt('eyJhbGciOiJub25lIn0.eyJhIjoxfQ.')).toMatchObject({
      ok: true,
      algorithm: 'none',
      signature: '',
    });
  });

  it('leaves a header without alg reported as having none', () => {
    expect(decoded('eyJhIjoxfQ.eyJhIjoxfQ.sig').algorithm).toBeNull();
  });
});

describe('claims', () => {
  it('lists the seven registered claims in a fixed order', () => {
    expect(STANDARD_CLAIMS).toEqual(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);
  });

  it('separates registered claims from the rest', () => {
    const { standard, extra } = splitClaims({
      role: 'admin',
      sub: 'u1',
      iss: 'toolbox',
    });

    expect(standard).toEqual([
      ['iss', 'toolbox'],
      ['sub', 'u1'],
    ]);
    expect(extra).toEqual([['role', 'admin']]);
  });

  it('reads a numeric claim only when it really is a number', () => {
    expect(numberClaim({ exp: 100 }, 'exp')).toBe(100);
    expect(numberClaim({ exp: '100' }, 'exp')).toBeNull();
    expect(numberClaim({ exp: Number.NaN }, 'exp')).toBeNull();
    expect(numberClaim({}, 'exp')).toBeNull();
  });

  it('turns the seconds of a time claim into milliseconds', () => {
    expect(claimTimeMs({ exp: 1516239022 }, 'exp')).toBe(1516239022 * SECOND_MS);
  });

  it('accepts an audience given as one string or as a list', () => {
    expect(audienceList({ aud: 'api' })).toEqual(['api']);
    expect(audienceList({ aud: ['api', 'web'] })).toEqual(['api', 'web']);
    expect(audienceList({ aud: 42 })).toEqual([]);
    expect(audienceList({})).toEqual([]);
  });
});

describe('readValidity', () => {
  const now = 1_700_000_000 * SECOND_MS;

  it('calls a token with a future exp valid', () => {
    expect(readValidity({ exp: 1_700_000_060 }, now).state).toBe('valid');
  });

  it('calls a token expired the moment exp is reached', () => {
    expect(readValidity({ exp: 1_700_000_000 }, now).state).toBe('expired');
    expect(readValidity({ exp: 1_699_999_999 }, now).state).toBe('expired');
  });

  it('calls a token with no exp at all unexpiring rather than valid', () => {
    expect(readValidity({ sub: 'u1' }, now).state).toBe('no-expiry');
  });

  it('honours nbf', () => {
    expect(readValidity({ nbf: 1_700_000_060, exp: 1_700_000_600 }, now).state).toBe(
      'not-yet-valid',
    );
    expect(readValidity({ nbf: 1_699_999_000, exp: 1_700_000_600 }, now).state).toBe(
      'valid',
    );
  });

  it('lets exp win over nbf, since an expired token is not coming back', () => {
    expect(readValidity({ nbf: 1_700_000_060, exp: 1_699_999_000 }, now).state).toBe(
      'expired',
    );
  });

  it('hands back the three times in milliseconds', () => {
    expect(readValidity({ exp: 2, nbf: 1, iat: 0 }, now)).toMatchObject({
      expiresAt: 2000,
      notBefore: 1000,
      issuedAt: 0,
    });
  });
});

describe('verifyHmac', () => {
  it('knows which algorithms it can check', () => {
    expect(Object.keys(HMAC_HASHES)).toEqual(['HS256', 'HS384', 'HS512']);
    expect(canVerify('HS256')).toBe(true);
    expect(canVerify('RS256')).toBe(false);
    expect(canVerify(null)).toBe(false);
  });

  it('accepts the right secret for each HMAC size', async () => {
    for (const token of [HS256, HS384, HS512]) {
      await expect(verifyHmac(decoded(token), SECRET)).resolves.toEqual({
        ok: true,
        valid: true,
      });
    }
  });

  it('rejects a wrong secret', async () => {
    await expect(verifyHmac(decoded(HS256), 'wrong')).resolves.toEqual({
      ok: true,
      valid: false,
    });
  });

  it('rejects a token whose payload was edited after signing', async () => {
    const tampered = decoded(HS256);
    const forged: Jwt = {
      ...tampered,
      signingInput: tampered.signingInput.replace(/.$/, 'X'),
    };

    await expect(verifyHmac(forged, SECRET)).resolves.toEqual({
      ok: true,
      valid: false,
    });
  });

  it('refuses to guess at an algorithm it cannot compute', async () => {
    const token = decoded(HS256);
    await expect(
      verifyHmac({ ...token, algorithm: 'RS256' }, SECRET),
    ).resolves.toMatchObject({ ok: false, code: 'unsupported-algorithm' });
  });

  it('says so when the header carries no algorithm', async () => {
    const token = decoded(HS256);
    await expect(
      verifyHmac({ ...token, algorithm: null }, SECRET),
    ).resolves.toMatchObject({ ok: false, code: 'no-algorithm' });
  });

  it('reports a signature that is not base64url', async () => {
    const token = decoded(HS256);
    await expect(
      verifyHmac({ ...token, signature: 'not*base64' }, SECRET),
    ).resolves.toMatchObject({ ok: false, code: 'bad-signature-encoding' });
  });

  // HMAC is defined for an empty key; WebCrypto refuses to import one, which
  // would otherwise surface as an unhandled DataError.
  it('answers an empty secret instead of throwing', async () => {
    await expect(verifyHmac(decoded(HS256), '')).resolves.toMatchObject({
      ok: false,
      code: 'empty-secret',
    });
  });
});
