import { isRollRecord, type RollRecord } from './roll';

/**
 * Saved dungeons. Each dungeon is just its roll history plus a seed and a
 * name: the map is rebuilt from the history.
 */

export interface SavedDungeon {
  id: string;
  name: string;
  /** Decides every roll's dice (see rollSeed) */
  seed: number;
  createdAt: string;
  updatedAt: string;
  history: RollRecord[];
}

export interface Library {
  /** Id of the dungeon being played */
  current: string;
  /** Never empty */
  dungeons: SavedDungeon[];
}

export function newDungeon(
  name: string,
  seed: number,
  history: RollRecord[] = [],
  now = new Date(),
): SavedDungeon {
  return {
    id: `${now.getTime().toString(36)}-${seed.toString(36)}`,
    name,
    seed,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history,
  };
}

/** "Dungeon N", with the lowest N not already taken */
export function defaultName(library: Pick<Library, 'dungeons'>): string {
  const names = new Set(library.dungeons.map((d) => d.name));
  let n = 1;
  while (names.has(`Dungeon ${n}`)) n++;
  return `Dungeon ${n}`;
}

/** A name not already used, adding " (2)", " (3)"... if needed */
export function uniqueName(library: Pick<Library, 'dungeons'>, name: string): string {
  const names = new Set(library.dungeons.map((d) => d.name));
  if (!names.has(name)) return name;
  let n = 2;
  while (names.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

export function currentDungeon(library: Library): SavedDungeon {
  return (
    library.dungeons.find((d) => d.id === library.current) ?? (library.dungeons[0] as SavedDungeon)
  );
}

/** A copy of the library with the current dungeon changed */
export function updateCurrent(
  library: Library,
  change: Partial<Pick<SavedDungeon, 'name' | 'history'>>,
  now = new Date(),
): Library {
  const current = currentDungeon(library);
  return {
    ...library,
    dungeons: library.dungeons.map((d) =>
      d.id === current.id ? { ...d, ...change, updatedAt: now.toISOString() } : d,
    ),
  };
}

/** Add a dungeon and switch to it */
export function addDungeon(library: Library, dungeon: SavedDungeon): Library {
  return { current: dungeon.id, dungeons: [...library.dungeons, dungeon] };
}

/**
 * Remove a dungeon. Removing the last one leaves a fresh empty dungeon, so
 * there's always one to play.
 */
export function removeDungeon(
  library: Library,
  id: string,
  seed: number,
  now = new Date(),
): Library {
  const dungeons = library.dungeons.filter((d) => d.id !== id);
  if (dungeons.length === 0) {
    const fresh = newDungeon('Dungeon 1', seed, [], now);
    return { current: fresh.id, dungeons: [fresh] };
  }
  const current = dungeons.some((d) => d.id === library.current)
    ? library.current
    : // The most recently played of the rest
      [...dungeons].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!.id;
  return { current, dungeons };
}

export function parseSavedDungeon(value: unknown): SavedDungeon | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.seed !== 'number' ||
    !Number.isInteger(raw.seed) ||
    !Array.isArray(raw.history)
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: raw.id,
    name: raw.name.trim() || 'Untitled dungeon',
    seed: raw.seed >>> 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    history: raw.history.filter(isRollRecord),
  };
}

/** A library from saved data, or null if there's nothing usable */
export function parseLibrary(data: unknown): Library | null {
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.dungeons)) return null;
  const seen = new Set<string>();
  const dungeons = raw.dungeons
    .map(parseSavedDungeon)
    .filter((d): d is SavedDungeon => d !== null && !seen.has(d.id) && !!seen.add(d.id));
  if (dungeons.length === 0) return null;
  const current =
    typeof raw.current === 'string' && seen.has(raw.current) ? raw.current : dungeons[0]!.id;
  return { current, dungeons };
}
