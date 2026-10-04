/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Every random choice in the game goes through an Rng, so the same seed
 * always produces the same dungeon. That makes share links and tests repeatable.
 */
export interface Rng {
  /** Float in [0, 1) */
  next(): number;
  /** Integer in [min, max], inclusive */
  int(min: number, max: number): number;
  /** Current internal state, for saving and restoring */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Invalid range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    state: () => s,
  };
}

/** A random 32-bit seed for starting a new dungeon */
export function randomSeed(): number {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  return seed;
}

/**
 * Seed for roll `n` (1-based) of a dungeon, so a dungeon's seed decides every
 * roll in it. Rolling again after an undo gives the same dice.
 */
export function rollSeed(dungeonSeed: number, n: number): number {
  // splitmix32-style mixing of the two numbers
  let h = (dungeonSeed ^ Math.imul(n, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
