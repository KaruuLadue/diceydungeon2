import { DICE, type Die } from './dice';
import { newDungeon, parseSavedDungeon, type SavedDungeon } from './library';
import { rollSeed } from './rng';
import {
  isRollRecord,
  rollRoom,
  type DieResult,
  type EnabledDice,
  type ExtraResult,
  type RollRecord,
} from './roll';
import { CLASSIC_TABLES, mergeTables, sameTable, type Entry, type TableSet } from './tables';

/**
 * Moving dungeons between browsers: as a file (the whole saved dungeon) or as
 * a share link.
 *
 * A share link doesn't carry the dice results, only what's needed to roll
 * them again: the dungeon's seed, the door each roll went through, and any
 * tables that differ from Classic. A roll that can't be reproduced that way
 * (say the tables were edited after it) carries its results instead.
 */

const FILE_FORMAT = 'dicey-dungeon-2/dungeon';
const FILE_VERSION = 1;

export function dungeonToFile(dungeon: SavedDungeon): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, dungeon }, null, 2);
}

export type DungeonImport = { ok: true; dungeon: SavedDungeon } | { ok: false; error: string };

/** Read an exported dungeon file. The dungeon gets a new id, so it's added as a copy. */
export function parseDungeonFile(text: string, now = new Date()): DungeonImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  const raw = data as Record<string, unknown> | null;
  if (raw?.format !== FILE_FORMAT) {
    return { ok: false, error: 'The file is not a Dicey Dungeon 2 dungeon.' };
  }
  if (typeof raw.version !== 'number' || raw.version > FILE_VERSION) {
    return { ok: false, error: 'The file is from a newer version of Dicey Dungeon 2.' };
  }
  const dungeon = parseSavedDungeon(raw.dungeon);
  if (!dungeon) return { ok: false, error: 'The dungeon in the file is incomplete.' };
  const copy = newDungeon(dungeon.name, dungeon.seed, dungeon.history, now);
  return { ok: true, dungeon: { ...copy, createdAt: dungeon.createdAt } };
}

// ---- Share links ----

const LINK_VERSION = 1;
/** Limits on what a link may unpack to, so a hostile link can't hang the page */
const MAX_LINK_BYTES = 1_000_000;
const MAX_LINK_ROLLS = 5_000;

/** A roll in a link: just its door id when it's a plain roll, otherwise the details */
type LinkRoll =
  | string
  | {
      /** Door id */
      d?: string;
      /** Seed, if not the one the dungeon seed gives */
      s?: number;
      /** Active dice as bits in DICE order, if not all */
      e?: number;
      /** 0 if table effects were off */
      f?: 0;
      /** The results themselves, if they can't be rolled again */
      x?: Pick<RollRecord, 'results' | 'extra'>;
    };

interface LinkData {
  v: number;
  /** Name */
  n: string;
  /** Seed */
  s: number;
  /** Tables that differ from Classic */
  t?: Partial<TableSet>;
  r: LinkRoll[];
}

const ALL_DICE_MASK = (1 << DICE.length) - 1;

function diceMask(results: RollRecord['results']): number {
  return DICE.reduce((mask, die, i) => (die in results ? mask | (1 << i) : mask), 0);
}

function enabledFromMask(mask: number): EnabledDice {
  return Object.fromEntries(DICE.map((die, i) => [die, (mask & (1 << i)) !== 0])) as EnabledDice;
}

const sameResult = (a: DieResult | undefined, b: DieResult | undefined) =>
  a?.value === b?.value && a?.description === b?.description;

function sameDice(a: RollRecord, b: RollRecord): boolean {
  const extraA = a.extra ?? [];
  const extraB = b.extra ?? [];
  return (
    DICE.every((die) => sameResult(a.results[die], b.results[die])) &&
    extraA.length === extraB.length &&
    extraA.every((x: ExtraResult, i) => {
      const y = extraB[i] as ExtraResult;
      return x.die === y.die && x.from === y.from && sameResult(x, y);
    })
  );
}

function encodeRoll(
  record: RollRecord,
  n: number,
  dungeonSeed: number,
  tables: TableSet,
): LinkRoll {
  const mask = diceMask(record.results);
  const enabled = enabledFromMask(mask);
  const door = record.door ?? '';
  const effects = [true, false].find((applyEffects) =>
    sameDice(record, rollRoom(tables, enabled, record.seed, { applyEffects })),
  );
  if (effects === undefined) {
    return {
      ...(door && { d: door }),
      s: record.seed,
      x: { results: record.results, ...(record.extra && { extra: record.extra }) },
    };
  }
  const roll = {
    ...(door && { d: door }),
    ...(record.seed !== rollSeed(dungeonSeed, n) && { s: record.seed }),
    ...(mask !== ALL_DICE_MASK && { e: mask }),
    ...(!effects && { f: 0 as const }),
  };
  const fields = Object.keys(roll).length;
  if (fields === 0) return '';
  // A plain roll is just its door id
  return fields === 1 && roll.d ? roll.d : roll;
}

function tablesData(tables: TableSet): Partial<TableSet> | undefined {
  const changed = DICE.filter((die) => !sameTable(tables[die], CLASSIC_TABLES[die]));
  if (changed.length === 0) return undefined;
  return Object.fromEntries(changed.map((die) => [die, tables[die]])) as Partial<
    Record<Die, Entry[]>
  >;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function streamBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  limit = Infinity,
): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('Too large');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * The part of a share link after "#/share/". `tables` are the tables the
 * dungeon was rolled with (the current ones).
 */
export async function encodeShareLink(dungeon: SavedDungeon, tables: TableSet): Promise<string> {
  const rolls = dungeon.history.map((record, i) => encodeRoll(record, i + 1, dungeon.seed, tables));
  const rerolled = rolls.some((roll) => typeof roll === 'string' || !roll.x);
  const t = rerolled ? tablesData(tables) : undefined;
  const data: LinkData = {
    v: LINK_VERSION,
    n: dungeon.name,
    s: dungeon.seed,
    ...(t && { t }),
    r: rolls,
  };
  const json = new TextEncoder().encode(JSON.stringify(data));
  return toBase64Url(await streamBytes(json, new CompressionStream('deflate-raw')));
}

function decodeRoll(
  roll: unknown,
  n: number,
  data: LinkData,
  tables: TableSet,
  now: Date,
): RollRecord | null {
  if (typeof roll !== 'string' && (typeof roll !== 'object' || roll === null)) return null;
  const r: Exclude<LinkRoll, string> = typeof roll === 'string' ? { d: roll } : roll;
  const seed = typeof r.s === 'number' ? r.s >>> 0 : rollSeed(data.s, n);
  const base = { id: `${now.getTime()}-${n}`, timestamp: now.toISOString(), seed };
  const door = typeof r.d === 'string' && r.d !== '' ? { door: r.d } : {};
  if (r.x !== undefined) {
    const record = { ...base, ...r.x, ...door };
    return isRollRecord(record) ? record : null;
  }
  const mask = typeof r.e === 'number' ? r.e & ALL_DICE_MASK : ALL_DICE_MASK;
  const rolled = rollRoom(tables, enabledFromMask(mask), seed, { applyEffects: r.f !== 0, now });
  return { ...rolled, ...base, ...door };
}

export type ShareImport = DungeonImport;

/** Unpack a share link back into a dungeon */
export async function decodeShareLink(payload: string, now = new Date()): Promise<ShareImport> {
  const broken = { ok: false as const, error: 'The share link is broken or incomplete.' };
  let data: LinkData;
  try {
    const bytes = await streamBytes(
      fromBase64Url(payload),
      new DecompressionStream('deflate-raw'),
      MAX_LINK_BYTES,
    );
    data = JSON.parse(new TextDecoder().decode(bytes)) as LinkData;
  } catch {
    return broken;
  }
  if (typeof data !== 'object' || data === null) return broken;
  if (typeof data.v !== 'number' || data.v > LINK_VERSION) {
    return { ok: false, error: 'The link is from a newer version of Dicey Dungeon 2.' };
  }
  if (typeof data.s !== 'number' || !Array.isArray(data.r) || data.r.length > MAX_LINK_ROLLS) {
    return broken;
  }
  const tables = mergeTables(CLASSIC_TABLES, data.t);
  const history: RollRecord[] = [];
  for (const [i, roll] of data.r.entries()) {
    const record = decodeRoll(roll, i + 1, data, tables, now);
    if (!record) return broken;
    history.push(record);
  }
  const name = typeof data.n === 'string' && data.n.trim() ? data.n.trim() : 'Shared dungeon';
  return { ok: true, dungeon: newDungeon(name, data.s >>> 0, history, now) };
}
