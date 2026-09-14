import { describe, expect, it, vi } from 'vitest';

import {
  HASH_ALGORITHMS,
  compareDigest,
  digest,
  digestAll,
  encodeText,
  isWeak,
  readFileBytes,
  toHex,
  whichAlgorithmByLength,
} from '@/tools/hash-generator/logic';
import { md5 } from '@/tools/hash-generator/md5';

/** The RFC 1321 test suite, verbatim. */
const RFC_1321 = [
  ['', 'd41d8cd98f00b204e9800998ecf8427e'],
  ['a', '0cc175b9c0f1b6a831c399e269772661'],
  ['abc', '900150983cd24fb0d6963f7d28e17f72'],
  ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
  ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
  [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    'd174ab98d277d9f5a5611c2c9f419d9f',
  ],
  [
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
    '57edf4a22be3c955ac49da2e2107b67a',
  ],
] as const;

const THAI = 'สวัสดี';

function hashOf(text: string): string {
  return toHex(md5(encodeText(text)));
}

describe('md5 against the published vectors', () => {
  for (const [input, expected] of RFC_1321) {
    it(`hashes ${input.length === 0 ? 'the empty string' : `"${input.slice(0, 20)}"`}`, () => {
      expect(hashOf(input)).toBe(expected);
    });
  }
});

describe('md5 block handling', () => {
  it('produces 32 hex characters for any input', () => {
    expect(hashOf('')).toHaveLength(32);
    expect(hashOf('x'.repeat(1000))).toHaveLength(32);
  });

  it('handles the length that forces an extra padding block', () => {
    // 56 bytes leaves no room for the 8-byte length field in the same block.
    expect(hashOf('a'.repeat(55))).not.toBe(hashOf('a'.repeat(56)));
    expect(hashOf('a'.repeat(56))).toHaveLength(32);
    expect(hashOf('a'.repeat(64))).toHaveLength(32);
  });

  it('hashes exactly one full block', () => {
    expect(hashOf('a'.repeat(64))).toBe('014842d480b571495a4a0363793f7367');
  });

  it('hashes Thai by its utf-8 bytes', () => {
    expect(hashOf(THAI)).toBe(toHex(md5(new TextEncoder().encode(THAI))));
    expect(hashOf(THAI)).toHaveLength(32);
  });

  it('changes completely for a one-character difference', () => {
    expect(hashOf('abc')).not.toBe(hashOf('abd'));
  });
});

describe('digest', () => {
  it('matches the known SHA-256 of an empty input', async () => {
    expect(await digest('SHA-256', encodeText(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the known SHA-1 of "abc"', async () => {
    expect(await digest('SHA-1', encodeText('abc'))).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    );
  });

  it('matches the known SHA-512 of "abc"', async () => {
    expect(await digest('SHA-512', encodeText('abc'))).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('routes MD5 to the hand-written implementation', async () => {
    expect(await digest('MD5', encodeText('abc'))).toBe(
      '900150983cd24fb0d6963f7d28e17f72',
    );
  });

  it('produces the expected length for every algorithm', async () => {
    const all = await digestAll(encodeText('abc'));
    expect(Object.keys(all)).toEqual([...HASH_ALGORITHMS]);
    expect(all['MD5']).toHaveLength(32);
    expect(all['SHA-1']).toHaveLength(40);
    expect(all['SHA-256']).toHaveLength(64);
    expect(all['SHA-384']).toHaveLength(96);
    expect(all['SHA-512']).toHaveLength(128);
  });
});

describe('weak algorithms are named', () => {
  it('flags MD5 and SHA-1 only', () => {
    expect(isWeak('MD5')).toBe(true);
    expect(isWeak('SHA-1')).toBe(true);
    expect(isWeak('SHA-256')).toBe(false);
    expect(isWeak('SHA-512')).toBe(false);
  });
});

describe('compareDigest', () => {
  const actual = '900150983cd24fb0d6963f7d28e17f72';

  it('is idle until something is pasted', () => {
    expect(compareDigest('', actual)).toBe('idle');
    expect(compareDigest('   ', actual)).toBe('idle');
  });

  it('ignores case', () => {
    expect(compareDigest(actual.toUpperCase(), actual)).toBe('match');
  });

  it('ignores surrounding whitespace', () => {
    expect(compareDigest(`  ${actual}\n`, actual)).toBe('match');
  });

  it('reports a mismatch', () => {
    expect(compareDigest('deadbeef', actual)).toBe('mismatch');
  });
});

describe('whichAlgorithmByLength', () => {
  it('recognises each digest length', () => {
    expect(whichAlgorithmByLength('a'.repeat(32))).toBe('MD5');
    expect(whichAlgorithmByLength('a'.repeat(40))).toBe('SHA-1');
    expect(whichAlgorithmByLength('a'.repeat(64))).toBe('SHA-256');
    expect(whichAlgorithmByLength('a'.repeat(96))).toBe('SHA-384');
    expect(whichAlgorithmByLength('a'.repeat(128))).toBe('SHA-512');
  });

  it('returns nothing for a length that is not a digest', () => {
    expect(whichAlgorithmByLength('abc')).toBeUndefined();
  });
});

describe('readFileBytes', () => {
  it('reads a blob in one piece when it is small', async () => {
    const blob = new Blob(['abc']);
    expect(await readFileBytes(blob, () => {})).toEqual(encodeText('abc'));
  });

  it('reports progress up to the total', async () => {
    const size = 1024 * 1024 * 2 + 10;
    const blob = new Blob([new Uint8Array(size)]);
    const progress = vi.fn();

    const bytes = await readFileBytes(blob, progress);

    expect(bytes.length).toBe(size);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(size, size);
  });

  it('produces the same digest as hashing the whole blob at once', async () => {
    const blob = new Blob(['a'.repeat(1024 * 1024 + 7)]);
    const streamed = await readFileBytes(blob, () => {});

    expect(await digest('MD5', streamed)).toBe(
      await digest('MD5', new Uint8Array(await blob.arrayBuffer())),
    );
  });

  it('handles an empty blob', async () => {
    expect((await readFileBytes(new Blob([]), () => {})).length).toBe(0);
  });
});
