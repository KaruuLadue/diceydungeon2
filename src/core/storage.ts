import { DICE } from './dice';
import { addDungeon, newDungeon, parseLibrary, type Library } from './library';
import { isRollRecord } from './roll';
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
  library: { key: 'dd2.library', version: 1 },
  // v2: entries can be objects with effects. v1 (plain text entries) still loads.
  tables: { key: 'dd2.tables', version: 2 },
} as const;

/** Where 0.2–0.5 saved the one roll history, before there were multiple dungeons */
const OLD_HISTORY_KEY = 'dd2.history';

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

/**
 * The saved dungeons. The first time, a roll history saved before there were
 * multiple dungeons becomes "Dungeon 1", and with nothing saved there is one
 * empty dungeon. `seed` is the new dungeon's seed in either case.
 */
export function loadLibrary(store: KeyValueStore, seed: number, now = new Date()): Library {
  const saved = parseLibrary(read(store, KEYS.library.key)?.data);
  if (saved) return saved;
  const old = read(store, OLD_HISTORY_KEY)?.data;
  const history = Array.isArray(old) ? old.filter(isRollRecord) : [];
  return addDungeon({ current: '', dungeons: [] }, newDungeon('Dungeon 1', seed, history, now));
}

/** Save the dungeons. The old single history is removed once they're safely saved. */
export function saveLibrary(store: KeyValueStore, library: Library): boolean {
  if (!write(store, KEYS.library.key, KEYS.library.version, library)) return false;
  try {
    store.removeItem(OLD_HISTORY_KEY);
  } catch {
    // Harmless: the saved library takes priority
  }
  return true;
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
