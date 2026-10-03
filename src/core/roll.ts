import { DICE, type Die } from './dice';
import { createRng } from './rng';
import { DISPLAY_ORDER, type TableSet } from './tables';

export interface DieResult {
  value: number;
  description: string;
}

export interface RollRecord {
  id: string;
  timestamp: string;
  /** Seed the roll was made with, so it can be reproduced */
  seed: number;
  /** Results for the dice that were enabled */
  results: Partial<Record<Die, DieResult>>;
}

export type EnabledDice = Record<Die, boolean>;

/**
 * Roll every enabled die against its table. Each die is rolled against its
 * table's length, so the D100 with its 10-entry Classic table reads as a D10,
 * as in v1.
 */
export function rollRoom(
  tables: TableSet,
  enabled: EnabledDice,
  seed: number,
  now: Date = new Date(),
): RollRecord {
  const rng = createRng(seed);
  const results: Partial<Record<Die, DieResult>> = {};
  for (const die of DICE) {
    if (!enabled[die]) continue;
    const table = tables[die];
    const value = rng.int(1, table.length);
    results[die] = { value, description: table[value - 1] ?? '' };
  }
  return { id: `${now.getTime()}-${seed}`, timestamp: now.toISOString(), seed, results };
}

/** Values that more than one die rolled, for v1's "highlight matching rolls" */
export function matchingValues(record: RollRecord): Set<number> {
  const counts = new Map<number, number>();
  for (const result of Object.values(record.results)) {
    counts.set(result.value, (counts.get(result.value) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

/** Results in display order, skipping dice that weren't rolled */
export function orderedResults(record: RollRecord): Array<[Die, DieResult]> {
  return DISPLAY_ORDER.flatMap((die) => {
    const result = record.results[die];
    return result ? [[die, result] as [Die, DieResult]] : [];
  });
}

/** Plain-text log of the roll history, in v1's export format */
export function historyToText(history: RollRecord[]): string {
  let text = 'Roll History:\n\n';
  history.forEach((record, index) => {
    text += `Roll ${index + 1} (${record.timestamp}):\n`;
    for (const [die, result] of orderedResults(record)) {
      text += `${die}: ${result.value} (${result.description || 'No description'})\n`;
    }
    text += '\n';
  });
  return text;
}
