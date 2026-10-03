import { describe, expect, it } from 'vitest';
import { rollRoom } from './roll';
import { DEFAULT_SETTINGS } from './settings';
import {
  loadHistory,
  loadSettings,
  loadTables,
  loadV1Tables,
  memoryStore,
  saveHistory,
  saveSettings,
  saveTables,
} from './storage';
import { CLASSIC_TABLES } from './tables';

describe('settings storage', () => {
  it('returns defaults when nothing is saved or the data is corrupt', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStore({ 'dd2.settings': '{oops' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips and fills in missing fields', () => {
    const store = memoryStore();
    saveSettings(store, { ...DEFAULT_SETTINGS, soundEnabled: false });
    expect(loadSettings(store).soundEnabled).toBe(false);

    const partial = memoryStore({
      'dd2.settings': JSON.stringify({ version: 1, data: { enabledDice: { D8: false } } }),
    });
    const loaded = loadSettings(partial);
    expect(loaded.enabledDice.D8).toBe(false);
    expect(loaded.enabledDice.D4).toBe(true);
    expect(loaded.highlightMatches).toBe(true);
  });
});

describe('history storage', () => {
  it('round-trips roll records', () => {
    const store = memoryStore();
    const history = [1, 2, 3].map((seed) =>
      rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, seed),
    );
    saveHistory(store, history);
    expect(loadHistory(store)).toEqual(history);
  });

  it('drops malformed records', () => {
    const good = rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, 1);
    const store = memoryStore({
      'dd2.history': JSON.stringify({ version: 1, data: [good, { id: 5 }, null] }),
    });
    expect(loadHistory(store)).toEqual([good]);
  });

  it('round-trips extra rolls and drops records with malformed ones', () => {
    const withExtra = {
      ...rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, 1),
      extra: [{ die: 'D8', from: 'D20', value: 3, description: 'x' }],
    };
    const broken = {
      ...withExtra,
      extra: [{ die: 'D9', from: 'D20', value: 3, description: 'x' }],
    };
    const store = memoryStore({
      'dd2.history': JSON.stringify({ version: 1, data: [withExtra, broken] }),
    });
    expect(loadHistory(store)).toEqual([withExtra]);
  });
});

describe('tables storage', () => {
  it('returns the Classic tables when nothing is saved', () => {
    expect(loadTables(memoryStore())).toEqual(CLASSIC_TABLES);
  });

  it('round-trips custom tables with effects', () => {
    const store = memoryStore();
    const custom = {
      ...CLASSIC_TABLES,
      D4: [{ text: 'w', reroll: ['D8' as const] }, { text: 'x' }, { text: 'y' }, { text: 'z' }],
    };
    saveTables(store, custom);
    expect(loadTables(store)).toEqual(custom);
  });

  it('still loads tables saved in the older plain-text format', () => {
    const store = memoryStore({
      'dd2.tables': JSON.stringify({ version: 1, data: { D4: ['w', 'x', 'y', 'z'] } }),
    });
    expect(loadTables(store).D4).toEqual([
      { text: 'w' },
      { text: 'x' },
      { text: 'y' },
      { text: 'z' },
    ]);
  });
});

describe('loadV1Tables', () => {
  it('reads tables saved by Dicey Dungeon 1, skipping outdated ones', () => {
    const store = memoryStore({
      customRollTables: JSON.stringify({
        D8: Array.from({ length: 8 }, (_, i) => `v1 encounter ${i}`),
        D100: Array.from({ length: 100 }, (_, i) => `${i}`),
      }),
    });
    const tables = loadV1Tables(store);
    expect(tables?.D8[0]).toEqual({ text: 'v1 encounter 0' });
    expect(tables?.D100).toEqual(CLASSIC_TABLES.D100);
  });

  it('treats v1’s default tables (plain text) as unchanged, keeping Classic effects', () => {
    const v1Defaults = Object.fromEntries(
      Object.entries(CLASSIC_TABLES).map(([die, entries]) => [die, entries.map((e) => e.text)]),
    );
    expect(loadV1Tables(memoryStore({ customRollTables: JSON.stringify(v1Defaults) }))).toBeNull();

    v1Defaults.D8![0] = 'My encounter';
    const tables = loadV1Tables(memoryStore({ customRollTables: JSON.stringify(v1Defaults) }));
    expect(tables?.D8[0]).toEqual({ text: 'My encounter' });
    expect(tables?.D20[19]).toEqual(CLASSIC_TABLES.D20[19]);
  });

  it('returns null when v1 has nothing different from the defaults', () => {
    expect(loadV1Tables(memoryStore())).toBeNull();
    expect(
      loadV1Tables(memoryStore({ customRollTables: JSON.stringify(CLASSIC_TABLES) })),
    ).toBeNull();
    expect(loadV1Tables(memoryStore({ customRollTables: 'not json' }))).toBeNull();
  });
});
