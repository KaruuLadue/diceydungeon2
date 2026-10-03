import { describe, expect, it } from 'vitest';
import { DICE, roll, rollAll, sidesOf } from './dice';
import { createRng } from './rng';

describe('dice', () => {
  it('knows how many sides each die has', () => {
    expect(DICE.map(sidesOf)).toEqual([4, 6, 8, 10, 12, 20, 100]);
  });

  it('rolls within each die’s range', () => {
    const rng = createRng(5);
    for (const die of DICE) {
      for (let i = 0; i < 1_000; i++) {
        const value = roll(die, rng);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(sidesOf(die));
      }
    }
  });

  it('rolls the full set the same way for the same seed', () => {
    expect(rollAll(createRng(2026))).toEqual(rollAll(createRng(2026)));
  });
});
