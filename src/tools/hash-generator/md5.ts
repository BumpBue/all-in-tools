const BLOCK_BYTES = 64;
const WORDS_PER_BLOCK = 16;
const ROUNDS = 64;
const LENGTH_FIELD_BYTES = 8;
const BITS_PER_BYTE = 8;
const UINT32 = 2 ** 32;

const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(abs(sin(i + 1)) * 2^32), built rather than pasted so the table
// cannot be mistyped.
const SINE = new Uint32Array(ROUNDS);
for (let index = 0; index < ROUNDS; index += 1) {
  SINE[index] = Math.floor(Math.abs(Math.sin(index + 1)) * UINT32);
}

const INITIAL_STATE: readonly number[] = [
  0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
];

function rotateLeft(value: number, amount: number): number {
  return (value << amount) | (value >>> (32 - amount));
}

/**
 * MD5 by hand because WebCrypto does not offer it. Kept for checking file
 * integrity against a published digest, not for anything security-bearing.
 */
export function md5(input: Uint8Array): Uint8Array {
  const paddedLength =
    Math.ceil((input.length + 1 + LENGTH_FIELD_BYTES) / BLOCK_BYTES) * BLOCK_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const bitLength = input.length * BITS_PER_BYTE;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - LENGTH_FIELD_BYTES, bitLength >>> 0, true);
  view.setUint32(
    paddedLength - LENGTH_FIELD_BYTES + 4,
    Math.floor(bitLength / UINT32),
    true,
  );

  let [a0, b0, c0, d0] = INITIAL_STATE;
  const words = new Uint32Array(WORDS_PER_BLOCK);

  for (let offset = 0; offset < paddedLength; offset += BLOCK_BYTES) {
    for (let word = 0; word < WORDS_PER_BLOCK; word += 1) {
      words[word] = view.getUint32(offset + word * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let round = 0; round < ROUNDS; round += 1) {
      let mixed: number;
      let wordIndex: number;

      if (round < 16) {
        mixed = (b & c) | (~b & d);
        wordIndex = round;
      } else if (round < 32) {
        mixed = (d & b) | (~d & c);
        wordIndex = (5 * round + 1) % WORDS_PER_BLOCK;
      } else if (round < 48) {
        mixed = b ^ c ^ d;
        wordIndex = (3 * round + 5) % WORDS_PER_BLOCK;
      } else {
        mixed = c ^ (b | ~d);
        wordIndex = (7 * round) % WORDS_PER_BLOCK;
      }

      const sum = (a + mixed + SINE[round] + words[wordIndex]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotateLeft(sum, SHIFTS[round])) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const digest = new Uint8Array(16);
  const out = new DataView(digest.buffer);
  out.setUint32(0, a0 >>> 0, true);
  out.setUint32(4, b0 >>> 0, true);
  out.setUint32(8, c0 >>> 0, true);
  out.setUint32(12, d0 >>> 0, true);

  return digest;
}
