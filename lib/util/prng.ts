/**
 * Deterministic pseudo-random number generator.
 *
 * mulberry32 — small, fast, and fully reproducible: the same seed always yields
 * the same sequence. This is what makes puzzle generation deterministic.
 */

export interface Rng {
  /** float in [0, 1). */
  next(): number;
  /** integer in [0, n). */
  int(n: number): number;
  /** pick a random element. */
  pick<T>(arr: readonly T[]): T;
  /** Fisher–Yates shuffle into a new array. */
  shuffle<T>(arr: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number): number => Math.floor(next() * n);

  const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];

  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return { next, int, pick, shuffle };
}

/** Stable string → 32-bit seed, so a theme name maps to a fixed seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
