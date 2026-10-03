import type { RollRecord } from './roll';

export type Wall = 'top' | 'left' | 'right';

export interface RoomLayout {
  /** Room width in 5ft squares */
  width: number;
  /** Room length in 5ft squares */
  length: number;
  /** Hallway length in squares; 0 means a door straight into the room */
  hallway: number;
  /** Walls with an extra exit, in placement order */
  exits: Wall[];
}

const EXIT_WALLS: readonly Wall[] = ['top', 'left', 'right'];

/**
 * v1's room rules:
 * - D10 = width and D100 (read as a D10) = length, in 5ft squares
 * - D6 ÷ 2, rounded up = extra exits, placed top, then left, then right
 * - D4 = hallway squares, except 1 ("Immediate doorway") which has no hallway
 * Disabled dice fall back to v1's defaults.
 */
export function roomLayout(record: RollRecord): RoomLayout {
  const { D4, D6, D10, D100 } = record.results;
  const exitCount = Math.ceil((D6?.value ?? 0) / 2);
  return {
    width: D10?.value ?? 5,
    length: D100?.value ?? 1,
    hallway: D4 ? (D4.value === 1 ? 0 : D4.value) : 1,
    exits: Array.from({ length: exitCount }, (_, i) => EXIT_WALLS[i % EXIT_WALLS.length] as Wall),
  };
}
