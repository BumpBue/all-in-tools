/** mulberry32: small, fast, and good enough for anything generated here. */
const SEED_MULTIPLIER = 0x6d2b79f5;
const UINT32 = 4294967296;

/**
 * Unseeded draws come from crypto.getRandomValues; Math.random is not used
 * anywhere in this project. A seed swaps in a small deterministic generator so
 * the same options produce the same output twice, which is what makes a
 * generator testable at all.
 */
export function createRandom(seed: number | null): () => number {
  if (seed === null) {
    return () => {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return (buffer[0] ?? 0) / UINT32;
    };
  }

  let state = seed >>> 0;
  return () => {
    state = (state + SEED_MULTIPLIER) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / UINT32;
  };
}

/** A fresh seed, drawn where randomness is allowed: never while rendering. */
export function drawSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 0;
}

export function pickFrom<T>(list: readonly T[], random: () => number): T {
  const index = Math.min(list.length - 1, Math.floor(random() * list.length));
  return list[index] as T;
}

export function intBetween(low: number, high: number, random: () => number): number {
  if (high < low) return low;
  return low + Math.floor(random() * (high - low + 1));
}
