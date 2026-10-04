import { describe, expect, it } from 'vitest';
import { buildDungeon, extendDungeon, emptyDungeon, unexploredDoors } from './dungeon';
import { newDungeon, type SavedDungeon } from './library';
import { createRng, rollSeed } from './rng';
import { rollRoom, type EnabledDice, type RollRecord } from './roll';
import { DEFAULT_SETTINGS } from './settings';
import { decodeShareLink, dungeonToFile, encodeShareLink, parseDungeonFile } from './share';
import { CLASSIC_TABLES, type TableSet } from './tables';

const now = new Date('2026-10-03T12:00:00Z');
const ALL = DEFAULT_SETTINGS.enabledDice;

/** Play a dungeon the way the app does, choosing random doors */
function play(
  seed: number,
  rolls: number,
  options: { tables?: TableSet; enabled?: (n: number) => EnabledDice; effects?: boolean } = {},
): SavedDungeon {
  const { tables = CLASSIC_TABLES, enabled = () => ALL, effects = true } = options;
  const pick = createRng(seed + 1);
  let map = emptyDungeon();
  const history: RollRecord[] = [];
  for (let n = 1; n <= rolls; n++) {
    const doors = unexploredDoors(map);
    const door = doors.length > 0 ? doors[pick.int(0, doors.length - 1)] : undefined;
    const record: RollRecord = {
      ...rollRoom(tables, enabled(n), rollSeed(seed, n), { applyEffects: effects, now }),
      ...(door && { door: door.id }),
    };
    history.push(record);
    map = extendDungeon(map, record, n);
  }
  return newDungeon('The Sunken Crypt', seed, history, now);
}

/** What matters about a roll when it's shared: everything but its id and time */
const dice = (history: RollRecord[]) =>
  history.map(({ seed, results, extra, door }) => ({ seed, results, extra, door }));

async function roundTrip(dungeon: SavedDungeon, tables = CLASSIC_TABLES) {
  const payload = await encodeShareLink(dungeon, tables);
  expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  const result = await decodeShareLink(payload, now);
  if (!result.ok) throw new Error(result.error);
  return { payload, shared: result.dungeon };
}

describe('share links', () => {
  it('reproduce the dungeon, its rolls and its map', async () => {
    const dungeon = play(1234, 30);
    const { payload, shared } = await roundTrip(dungeon);
    expect(shared.name).toBe('The Sunken Crypt');
    expect(shared.seed).toBe(1234);
    expect(dice(shared.history)).toEqual(dice(dungeon.history));
    expect(buildDungeon(shared.history).rooms.map((r) => r.rect)).toEqual(
      buildDungeon(dungeon.history).rooms.map((r) => r.rect),
    );
    // Plain rolls are just door ids, so links stay short
    expect(payload.length).toBeLessThan(400);
  });

  it('carry custom tables, switched-off dice and effects switched off', async () => {
    const tables: TableSet = {
      ...CLASSIC_TABLES,
      D12: CLASSIC_TABLES.D12.map((_, i) => ({ text: `Custom room ${i + 1}` })),
    };
    const dungeon = play(99, 12, {
      tables,
      enabled: (n) => (n % 3 === 0 ? { ...ALL, D20: false } : ALL),
      effects: false,
    });
    const { shared } = await roundTrip(dungeon, tables);
    expect(dice(shared.history)).toEqual(dice(dungeon.history));
    expect(shared.history[0]!.results.D12!.description).toMatch(/^Custom room/);
  });

  it('carry the results of rolls that can no longer be rolled again', async () => {
    const dungeon = play(5, 6);
    // Rolls from before dungeons had seeds, and rolls made with tables edited since
    dungeon.history[0] = rollRoom(CLASSIC_TABLES, ALL, 777, { now });
    dungeon.history[2] = {
      ...dungeon.history[2]!,
      results: { ...dungeon.history[2]!.results, D8: { value: 1, description: 'Old text' } },
    };
    const { shared } = await roundTrip(dungeon);
    expect(dice(shared.history)).toEqual(dice(dungeon.history));
  });

  it('reject broken links', async () => {
    for (const payload of ['', 'not-a-link', 'AAAA']) {
      const result = await decodeShareLink(payload, now);
      expect(result.ok).toBe(false);
    }
  });
});

describe('dungeon files', () => {
  it('round-trip as a copy with a new id', () => {
    const dungeon = play(42, 5);
    const later = new Date('2026-10-04T12:00:00Z');
    const result = parseDungeonFile(dungeonToFile(dungeon), later);
    if (!result.ok) throw new Error(result.error);
    expect(result.dungeon.id).not.toBe(dungeon.id);
    expect(result.dungeon).toMatchObject({
      name: dungeon.name,
      seed: dungeon.seed,
      createdAt: dungeon.createdAt,
      history: dungeon.history,
    });
  });

  it('reject other files', () => {
    expect(parseDungeonFile('nope')).toEqual({ ok: false, error: 'The file is not valid JSON.' });
    expect(parseDungeonFile(JSON.stringify(CLASSIC_TABLES))).toMatchObject({ ok: false });
    expect(
      parseDungeonFile(JSON.stringify({ format: 'dicey-dungeon-2/dungeon', version: 99 })),
    ).toMatchObject({ ok: false, error: 'The file is from a newer version of Dicey Dungeon 2.' });
  });
});
