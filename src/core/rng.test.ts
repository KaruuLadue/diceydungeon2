import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('keeps floats in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('resumes from a saved state', () => {
    const rng = createRng(99);
    rng.next();
    rng.next();
    const resumed = createRng(rng.state());
    expect(resumed.next()).toEqual(rng.next());
  });

  it('covers the whole inclusive int range evenly', () => {
    const rng = createRng(123);
    const counts = new Map<number, number>();
    const trials = 60_000;
    for (let i = 0; i < trials; i++) {
      const n = rng.int(1, 6);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const count of counts.values()) {
      // Each face should be within 5% of the expected 10,000
      expect(Math.abs(count - trials / 6)).toBeLessThan(trials / 6 / 20);
    }
  });

  it('rejects invalid ranges', () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(1.5, 3)).toThrow(RangeError);
  });
});
