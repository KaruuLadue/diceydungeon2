import { describe, expect, it } from 'vitest';
import { DICE, type Die } from './dice';
import {
  MAX_EXTRA_ROLLS,
  historyToText,
  matchingValues,
  orderedResults,
  rollRoom,
  type RollRecord,
} from './roll';
import { DEFAULT_SETTINGS } from './settings';
import { CLASSIC_TABLES, type Entry, type TableSet } from './tables';

const allDice = DEFAULT_SETTINGS.enabledDice;
const at = new Date('2026-10-03T12:00:00.000Z');

function record(values: Partial<Record<Die, number>>): RollRecord {
  const results = Object.fromEntries(
    Object.entries(values).map(([die, value]) => [die, { value, description: `${die} text` }]),
  );
  return { id: 'r', timestamp: at.toISOString(), seed: 1, results };
}

/** Classic tables with every entry of one die given the same effect */
function withEffect(die: Die, reroll: Die[]): TableSet {
  return {
    ...CLASSIC_TABLES,
    [die]: CLASSIC_TABLES[die].map((entry): Entry => ({ text: entry.text, reroll })),
  };
}

describe('rollRoom', () => {
  it('is reproducible from its seed', () => {
    expect(rollRoom(CLASSIC_TABLES, allDice, 42, { now: at })).toEqual(
      rollRoom(CLASSIC_TABLES, allDice, 42, { now: at }),
    );
  });

  it('rolls each die against its table and looks up the description', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { results } = rollRoom(CLASSIC_TABLES, allDice, seed, { now: at });
      for (const die of DICE) {
        const result = results[die];
        expect(result).toBeDefined();
        expect(result!.value).toBeGreaterThanOrEqual(1);
        expect(result!.value).toBeLessThanOrEqual(CLASSIC_TABLES[die].length);
        expect(result!.description).toBe(CLASSIC_TABLES[die][result!.value - 1]!.text);
      }
    }
  });

  it('reads the D100 as a D10, like v1', () => {
    const values = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      values.add(rollRoom(CLASSIC_TABLES, allDice, seed, { now: at }).results.D100!.value);
    }
    expect(Math.max(...values)).toBe(10);
  });

  it('skips disabled dice', () => {
    const enabled = { ...allDice, D8: false, D20: false };
    const { results } = rollRoom(CLASSIC_TABLES, enabled, 7, { now: at });
    expect(Object.keys(results).sort()).toEqual(['D10', 'D100', 'D12', 'D4', 'D6']);
  });

  it('records when and how it was rolled', () => {
    const roll = rollRoom(CLASSIC_TABLES, allDice, 99, { now: at });
    expect(roll.seed).toBe(99);
    expect(roll.timestamp).toBe('2026-10-03T12:00:00.000Z');
    expect(roll.id).toBe(`${at.getTime()}-99`);
  });
});

describe('table effects', () => {
  it('rolls the listed dice again, in order, labelled with their cause', () => {
    const roll = rollRoom(withEffect('D4', ['D8', 'D12']), allDice, 3, { now: at });
    expect(roll.extra?.map(({ die, from }) => [die, from])).toEqual([
      ['D8', 'D4'],
      ['D12', 'D4'],
    ]);
    for (const extra of roll.extra ?? []) {
      expect(extra.description).toBe(CLASSIC_TABLES[extra.die][extra.value - 1]!.text);
    }
  });

  it('adds no extra rolls when nothing has an effect', () => {
    const plain = withEffect('D20', []);
    expect(rollRoom(plain, allDice, 3).extra).toBeUndefined();
  });

  it('stops chained effects at the limit', () => {
    // Every D20 rolls the D20 again, forever
    const roll = rollRoom(withEffect('D20', ['D20']), allDice, 3);
    expect(roll.extra).toHaveLength(MAX_EXTRA_ROLLS);
    expect(roll.extra?.every((extra) => extra.die === 'D20' && extra.from === 'D20')).toBe(true);
  });

  it('never rolls disabled dice again', () => {
    const roll = rollRoom(withEffect('D4', ['D8', 'D12']), { ...allDice, D8: false }, 3);
    expect(roll.extra?.map((extra) => extra.die)).toEqual(['D12']);
  });

  it('can be switched off', () => {
    const tables = withEffect('D4', ['D8']);
    const roll = rollRoom(tables, allDice, 3, { applyEffects: false });
    expect(roll.extra).toBeUndefined();
  });

  it('keeps the main results the same whether or not effects apply', () => {
    const tables = withEffect('D4', ['D8']);
    expect(rollRoom(tables, allDice, 3, { applyEffects: false, now: at }).results).toEqual(
      rollRoom(tables, allDice, 3, { now: at }).results,
    );
  });

  it('triggers the Classic Chaotic Event (D20 = 20)', () => {
    const seed = Array.from({ length: 5000 }, (_, i) => i).find(
      (s) => rollRoom(CLASSIC_TABLES, allDice, s).results.D20?.value === 20,
    );
    expect(seed).toBeDefined();
    const roll = rollRoom(CLASSIC_TABLES, allDice, seed!);
    expect(roll.extra?.slice(0, 2).map((extra) => extra.die)).toEqual(['D8', 'D12']);
  });
});

describe('matchingValues', () => {
  it('finds values rolled by more than one die', () => {
    expect(matchingValues(record({ D4: 3, D6: 3, D8: 5, D10: 5, D12: 1 }))).toEqual(
      new Set([3, 5]),
    );
    expect(matchingValues(record({ D4: 1, D6: 2 }))).toEqual(new Set());
  });

  it('ignores extra rolls', () => {
    const roll = {
      ...record({ D4: 1, D6: 2 }),
      extra: [{ die: 'D8', from: 'D4', value: 1, description: '' }],
    };
    expect(matchingValues(roll as RollRecord)).toEqual(new Set());
  });
});

describe('orderedResults', () => {
  it('lists results in v1’s display order', () => {
    const dice = orderedResults(record({ D20: 1, D4: 2, D100: 3, D10: 4 })).map(([die]) => die);
    expect(dice).toEqual(['D4', 'D10', 'D100', 'D20']);
  });
});

describe('historyToText', () => {
  it('uses v1’s export format', () => {
    expect(historyToText([record({ D4: 2, D6: 5 })])).toBe(
      'Roll History:\n\n' +
        'Roll 1 (2026-10-03T12:00:00.000Z):\n' +
        'D4: 2 (D4 text)\n' +
        'D6: 5 (D6 text)\n\n',
    );
  });

  it('adds extra rolls after the main results', () => {
    const roll: RollRecord = {
      ...record({ D20: 20 }),
      extra: [{ die: 'D8', from: 'D20', value: 4, description: 'Roaming' }],
    };
    expect(historyToText([roll])).toContain(
      'D20: 20 (D20 text)\nD8 again (from D20): 4 (Roaming)\n',
    );
  });
});

describe('historyToText notes', () => {
  it('adds notes after each roll', () => {
    const text = historyToText([record({ D4: 2 })], (_, n) => [`Note for roll ${n}.`]);
    expect(text).toContain('D4: 2 (D4 text)\nNote for roll 1.\n\n');
  });
});
