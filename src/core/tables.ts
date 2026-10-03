import { DICE, type Die } from './dice';
import classic from './packs/classic.json';

/** One result on a roll table */
export interface Entry {
  text: string;
  /** Dice to roll again when this entry comes up */
  reroll?: Die[];
}

/** One roll table per die. A die is rolled against its table's length. */
export type TableSet = Record<Die, Entry[]>;

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

/**
 * Accepts an entry as plain text (v1 and older v2 saves) or as an object with
 * effects. Returns null if it isn't a usable entry.
 */
export function normalizeEntry(value: unknown): Entry | null {
  if (typeof value === 'string') {
    return value.trim() === '' ? null : { text: value };
  }
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || raw.text.trim() === '') return null;
  const entry: Entry = { text: raw.text };
  if (Array.isArray(raw.reroll)) {
    // Keep valid dice once each, in standard order; ignore anything else
    const reroll = DICE.filter((die) => (raw.reroll as unknown[]).includes(die));
    if (reroll.length > 0) entry.reroll = reroll;
  }
  return entry;
}

function normalizeTable(entries: unknown, length: number): Entry[] | null {
  if (!Array.isArray(entries) || entries.length !== length) return null;
  const normalized = entries.map(normalizeEntry);
  return normalized.every((entry) => entry !== null) ? (normalized as Entry[]) : null;
}

function buildClassic(): TableSet {
  const tables = {} as TableSet;
  const raw = classic as Record<string, unknown[]>;
  for (const die of DICE) {
    const table = normalizeTable(raw[die], raw[die]?.length ?? 0);
    if (!table) throw new Error(`Classic pack has an invalid ${die} table`);
    tables[die] = table;
  }
  return tables;
}

export const CLASSIC_TABLES: TableSet = buildClassic();

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
    const table = normalizeTable(candidate[die], defaults[die].length);
    if (table) merged[die] = table;
  }
  return merged;
}

export type ImportResult = { ok: true; tables: TableSet } | { ok: false; error: string };

/**
 * Strict check for an imported tables file: every die must be present and
 * valid. Accepts v1's format (plain text entries) as well as v2's.
 */
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
    if (!normalizeTable(candidate[die], defaults[die].length)) {
      return {
        ok: false,
        error: `${die} must have ${defaults[die].length} non-empty entries.`,
      };
    }
  }
  return { ok: true, tables: mergeTables(defaults, candidate) };
}

/** Returns the first problem with a table, or null if every entry is filled in */
export function findEmptyEntry(die: Die, entries: Entry[]): string | null {
  const index = entries.findIndex((entry) => entry.text.trim() === '');
  return index === -1 ? null : `${die}: entry ${index + 1} cannot be empty.`;
}

export function sameEntry(a: Entry, b: Entry): boolean {
  return a.text === b.text && (a.reroll ?? []).join() === (b.reroll ?? []).join();
}

export function sameTable(a: Entry[], b: Entry[]): boolean {
  return a.length === b.length && a.every((entry, i) => sameEntry(entry, b[i] as Entry));
}

/** Short description of an entry's effect, e.g. "Rolls D8 and D12 again" */
export function describeEffect(entry: Entry): string | null {
  const dice = entry.reroll;
  if (!dice || dice.length === 0) return null;
  const list =
    dice.length === 1 ? dice[0] : `${dice.slice(0, -1).join(', ')} and ${dice[dice.length - 1]}`;
  return `Rolls ${list} again`;
}
