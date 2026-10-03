import { describe, expect, it } from 'vitest';
import { roomLayout } from './layout';
import type { RollRecord } from './roll';

function layoutFor(values: Record<string, number>) {
  const results = Object.fromEntries(
    Object.entries(values).map(([die, value]) => [die, { value, description: '' }]),
  );
  return roomLayout({ id: 'r', timestamp: '', seed: 0, results } as RollRecord);
}

describe('roomLayout', () => {
  it('uses D10 for width and D100 for length', () => {
    const layout = layoutFor({ D10: 3, D100: 7 });
    expect(layout.width).toBe(3);
    expect(layout.length).toBe(7);
  });

  it('places D6 ÷ 2 (rounded up) exits top, then left, then right', () => {
    expect(layoutFor({ D6: 1 }).exits).toEqual(['top']);
    expect(layoutFor({ D6: 4 }).exits).toEqual(['top', 'left']);
    expect(layoutFor({ D6: 6 }).exits).toEqual(['top', 'left', 'right']);
  });

  it('draws no hallway for an immediate doorway (D4 = 1)', () => {
    expect(layoutFor({ D4: 1 }).hallway).toBe(0);
    expect(layoutFor({ D4: 2 }).hallway).toBe(2);
    expect(layoutFor({ D4: 4 }).hallway).toBe(4);
  });

  it('falls back to v1’s defaults for disabled dice', () => {
    expect(layoutFor({})).toEqual({ width: 5, length: 1, hallway: 1, exits: [] });
  });
});
