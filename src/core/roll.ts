import { DICE, type Die } from './dice';
import { createRng, type Rng } from './rng';
import { DISPLAY_ORDER, type Entry, type TableSet } from './tables';

export interface DieResult {
  value: number;
  description: string;
}

/** A die rolled again because of another result's effect */
export interface ExtraResult extends DieResult {
  die: Die;
  /** The die whose result caused this roll */
  from: Die;
}

export interface RollRecord {
  id: string;
  timestamp: string;
  /** Seed the roll was made with, so it can be reproduced */
  seed: number;
  /** Results for the dice that were enabled */
  results: Partial<Record<Die, DieResult>>;
  /** Extra rolls from table effects, in the order they were rolled */
  extra?: ExtraResult[];
}

export type EnabledDice = Record<Die, boolean>;

export interface RollOptions {
  /** Apply table effects such as "roll again" (default true) */
  applyEffects?: boolean;
  now?: Date;
}

/** Most extra rolls one roll can trigger, so chained effects can't loop forever */
export const MAX_EXTRA_ROLLS = 6;

function rollOn(table: Entry[], rng: Rng): { value: number; entry: Entry | undefined } {
  const value = rng.int(1, table.length);
  return { value, entry: table[value - 1] };
}

/**
 * Roll every enabled die against its table. Each die is rolled against its
 * table's length, so the D100 with its 10-entry Classic table reads as a D10,
 * as in v1.
 *
 * Entries with a reroll effect then roll those dice again, in order. Extra
 * results can trigger effects of their own, up to MAX_EXTRA_ROLLS. Disabled
 * dice are never rolled.
 */
export function rollRoom(
  tables: TableSet,
  enabled: EnabledDice,
  seed: number,
  { applyEffects = true, now = new Date() }: RollOptions = {},
): RollRecord {
  const rng = createRng(seed);
  const results: Partial<Record<Die, DieResult>> = {};
  const pending: Array<{ die: Die; from: Die }> = [];

  const queueEffects = (from: Die, entry: Entry | undefined) => {
    if (!applyEffects) return;
    for (const die of entry?.reroll ?? []) {
      if (enabled[die]) pending.push({ die, from });
    }
  };

  for (const die of DICE) {
    if (!enabled[die]) continue;
    const { value, entry } = rollOn(tables[die], rng);
    results[die] = { value, description: entry?.text ?? '' };
    queueEffects(die, entry);
  }

  const extra: ExtraResult[] = [];
  while (pending.length > 0 && extra.length < MAX_EXTRA_ROLLS) {
    const { die, from } = pending.shift()!;
    const { value, entry } = rollOn(tables[die], rng);
    extra.push({ die, from, value, description: entry?.text ?? '' });
    queueEffects(die, entry);
  }

  return {
    id: `${now.getTime()}-${seed}`,
    timestamp: now.toISOString(),
    seed,
    results,
    ...(extra.length > 0 && { extra }),
  };
}

/**
 * Values that more than one die rolled, for v1's "highlight matching rolls".
 * Only the main results count, not extra rolls.
 */
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

/** Label for an extra roll, e.g. "D8 again (from D20)" */
export function extraLabel(extra: ExtraResult): string {
  return `${extra.die} again (from ${extra.from})`;
}

/** Plain-text log of the roll history, in v1's export format plus extra rolls */
export function historyToText(history: RollRecord[]): string {
  let text = 'Roll History:\n\n';
  history.forEach((record, index) => {
    text += `Roll ${index + 1} (${record.timestamp}):\n`;
    for (const [die, result] of orderedResults(record)) {
      text += `${die}: ${result.value} (${result.description || 'No description'})\n`;
    }
    for (const extra of record.extra ?? []) {
      text += `${extraLabel(extra)}: ${extra.value} (${extra.description || 'No description'})\n`;
    }
    text += '\n';
  });
  return text;
}
