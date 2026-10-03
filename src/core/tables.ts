import { DICE, type Die } from './dice';
import classic from './packs/classic.json';

/** One roll table per die. A die is rolled against its table's length. */
export type TableSet = Record<Die, string[]>;

export interface DieInfo {
  label: string;
  /** Longer description for the table editor and instructions */
  hint: string;
}

export const DIE_INFO: Record<Die, DieInfo> = {
  D4: { label: 'Hallway Length', hint: 'How long to draw the hallway, in squares.' },
  D6: { label: 'Additional Exits', hint: 'Number of extra doors (D6 ÷ 2, rounded up).' },
  D8: { label: 'Room Encounter', hint: 'What, if anything, is in the room.' },
  D10: { label: 'Room Width', hint: 'Width of the room, 5ft per square.' },
  D12: { label: 'Room Type', hint: 'What kind of room it is.' },
  D20: { label: 'Room Modifier', hint: 'A twist that changes the room.' },
  D100: { label: 'Room Length', hint: 'Length of the room, 5ft per square (read as a D10).' },
};

/** The order results are listed in, matching v1 */
export const DISPLAY_ORDER: readonly Die[] = ['D4', 'D6', 'D8', 'D10', 'D100', 'D12', 'D20'];

/**
 * Dice whose roll value drives the room drawing. Their table text describes
 * the value, so it can be edited but isn't randomized.
 */
export const STRUCTURAL_DICE: readonly Die[] = ['D4', 'D6', 'D10', 'D100'];

export const CLASSIC_TABLES: TableSet = classic;

function isValidEntries(entries: unknown, length: number): entries is string[] {
  return (
    Array.isArray(entries) &&
    entries.length === length &&
    entries.every((entry) => typeof entry === 'string' && entry.trim() !== '')
  );
}

/**
 * Overlay custom tables on the defaults, die by die. A custom table is used
 * only if it still has the same number of entries as the default, so tables
 * saved by an older version with a different shape are ignored.
 */
export function mergeTables(defaults: TableSet, custom: unknown): TableSet {
  const merged = { ...defaults };
  if (typeof custom !== 'object' || custom === null) return merged;
  const candidate = custom as Record<string, unknown>;
  for (const die of DICE) {
    const entries = candidate[die];
    if (isValidEntries(entries, defaults[die].length)) {
      merged[die] = [...entries];
    }
  }
  return merged;
}

export type ImportResult = { ok: true; tables: TableSet } | { ok: false; error: string };

/** Strict check for an imported tables file: every die must be present and valid */
export function parseTablesFile(text: string, defaults: TableSet = CLASSIC_TABLES): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'The file does not contain roll tables.' };
  }
  const candidate = data as Record<string, unknown>;
  for (const die of DICE) {
    if (!isValidEntries(candidate[die], defaults[die].length)) {
      return {
        ok: false,
        error: `${die} must have ${defaults[die].length} non-empty entries.`,
      };
    }
  }
  return { ok: true, tables: mergeTables(defaults, candidate) };
}

/** Returns the first problem with a table, or null if every entry is filled in */
export function findEmptyEntry(die: Die, entries: string[]): string | null {
  const index = entries.findIndex((entry) => entry.trim() === '');
  return index === -1 ? null : `${die}: entry ${index + 1} cannot be empty.`;
}
