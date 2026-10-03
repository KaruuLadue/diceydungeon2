import type { Rng } from './rng';

export const DICE = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20', 'D100'] as const;
export type Die = (typeof DICE)[number];

export function sidesOf(die: Die): number {
  return Number(die.slice(1));
}

export function roll(die: Die, rng: Rng): number {
  return rng.int(1, sidesOf(die));
}

export function rollAll(rng: Rng): Record<Die, number> {
  return Object.fromEntries(DICE.map((die) => [die, roll(die, rng)])) as Record<Die, number>;
}
