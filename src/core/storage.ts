import { DICE } from './dice';
import type { RollRecord } from './roll';
import { parseSettings, type Settings } from './settings';
import { CLASSIC_TABLES, mergeTables, type TableSet } from './tables';

/** The subset of localStorage we use, so tests can pass an in-memory store */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Every saved value is wrapped as { version, data }. When a format changes,
 * bump its version and teach its parser to upgrade older versions.
 */
const KEYS = {
  settings: { key: 'dd2.settings', version: 1 },
  history: { key: 'dd2.history', version: 1 },
  // v2: entries can be objects with effects. v1 (plain text entries) still loads.
  tables: { key: 'dd2.tables', version: 2 },
} as const;

/** Where v1 saved custom tables (same origin, so v2 can read them) */
const V1_TABLES_KEY = 'customRollTables';

function read(store: KeyValueStore, key: string): { version: number; data: unknown } | null {
  try {
    const raw = store.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) return null;
    return parsed as { version: number; data: unknown };
  } catch {
    return null;
  }
}

function write(store: KeyValueStore, key: string, version: number, data: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify({ version, data }));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(store: KeyValueStore): Settings {
  return parseSettings(read(store, KEYS.settings.key)?.data);
}

export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  return write(store, KEYS.settings.key, KEYS.settings.version, settings);
}

function isRollRecord(value: unknown): value is RollRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.timestamp !== 'string' ||
    typeof record.seed !== 'number' ||
    typeof record.results !== 'object' ||
    record.results === null
  ) {
    return false;
  }
  const results = record.results as Record<string, unknown>;
  const validResults = Object.entries(results).every(
    ([die, result]) => isDie(die) && isDieResult(result),
  );
  // Records saved before table effects existed have no `extra`
  const validExtra =
    record.extra === undefined ||
    (Array.isArray(record.extra) &&
      record.extra.every((extra: Record<string, unknown> | null) => {
        return isDieResult(extra) && isDie(extra?.die) && isDie(extra?.from);
      }));
  const validDoor = record.door === undefined || typeof record.door === 'string';
  return validResults && validExtra && validDoor;
}

const isDie = (value: unknown) => (DICE as readonly unknown[]).includes(value);

function isDieResult(value: unknown): boolean {
  const r = value as Record<string, unknown> | null;
  return typeof r?.value === 'number' && typeof r.description === 'string';
}

export function loadHistory(store: KeyValueStore): RollRecord[] {
  const data = read(store, KEYS.history.key)?.data;
  return Array.isArray(data) ? data.filter(isRollRecord) : [];
}

export function saveHistory(store: KeyValueStore, history: RollRecord[]): boolean {
  return write(store, KEYS.history.key, KEYS.history.version, history);
}

export function loadTables(store: KeyValueStore): TableSet {
  return mergeTables(CLASSIC_TABLES, read(store, KEYS.tables.key)?.data);
}

export function saveTables(store: KeyValueStore, tables: TableSet): boolean {
  return write(store, KEYS.tables.key, KEYS.tables.version, tables);
}

/**
 * Custom tables saved by Dicey Dungeon 1, or null if there are none usable or
 * they match the Classic text. v1 entries are plain text, so an entry whose
 * text is unchanged keeps the Classic entry's effect.
 */
export function loadV1Tables(store: KeyValueStore): TableSet | null {
  try {
    const raw = store.getItem(V1_TABLES_KEY);
    if (raw === null) return null;
    const merged = mergeTables(CLASSIC_TABLES, JSON.parse(raw));
    let changed = false;
    for (const die of DICE) {
      merged[die] = merged[die].map((entry, i) => {
        const classic = CLASSIC_TABLES[die][i];
        if (classic && entry.text === classic.text) return classic;
        changed = true;
        return entry;
      });
    }
    return changed ? merged : null;
  } catch {
    return null;
  }
}

/** localStorage if available; it can throw in private windows or sandboxes */
export function browserStore(): KeyValueStore {
  try {
    const probe = '__dd2_probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStore();
  }
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
