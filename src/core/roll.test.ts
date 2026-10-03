import { describe, expect, it } from 'vitest';
import { DICE } from './dice';
import { historyToText, matchingValues, orderedResults, rollRoom, type RollRecord } from './roll';
import { DEFAULT_SETTINGS } from './settings';
import { CLASSIC_TABLES } from './tables';

const allDice = DEFAULT_SETTINGS.enabledDice;
const at = new Date('2026-10-03T12:00:00.000Z');

function record(values: Partial<Record<(typeof DICE)[number], number>>): RollRecord {
  const results = Object.fromEntries(
    Object.entries(values).map(([die, value]) => [die, { value, description: `${die} text` }]),
  );
  return { id: 'r', timestamp: at.toISOString(), seed: 1, results };
}

describe('rollRoom', () => {
  it('is reproducible from its seed', () => {
    expect(rollRoom(CLASSIC_TABLES, allDice, 42, at)).toEqual(
      rollRoom(CLASSIC_TABLES, allDice, 42, at),
    );
  });

  it('rolls each die against its table and looks up the description', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { results } = rollRoom(CLASSIC_TABLES, allDice, seed, at);
      for (const die of DICE) {
        const result = results[die];
        expect(result).toBeDefined();
        expect(result!.value).toBeGreaterThanOrEqual(1);
        expect(result!.value).toBeLessThanOrEqual(CLASSIC_TABLES[die].length);
        expect(result!.description).toBe(CLASSIC_TABLES[die][result!.value - 1]);
      }
    }
  });

  it('reads the D100 as a D10, like v1', () => {
    const values = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      values.add(rollRoom(CLASSIC_TABLES, allDice, seed, at).results.D100!.value);
    }
    expect(Math.max(...values)).toBe(10);
  });

  it('skips disabled dice', () => {
    const enabled = { ...allDice, D8: false, D20: false };
    const { results } = rollRoom(CLASSIC_TABLES, enabled, 7, at);
    expect(Object.keys(results).sort()).toEqual(['D10', 'D100', 'D12', 'D4', 'D6']);
  });

  it('records when and how it was rolled', () => {
    const roll = rollRoom(CLASSIC_TABLES, allDice, 99, at);
    expect(roll.seed).toBe(99);
    expect(roll.timestamp).toBe('2026-10-03T12:00:00.000Z');
    expect(roll.id).toBe(`${at.getTime()}-99`);
  });
});

describe('matchingValues', () => {
  it('finds values rolled by more than one die', () => {
    expect(matchingValues(record({ D4: 3, D6: 3, D8: 5, D10: 5, D12: 1 }))).toEqual(
      new Set([3, 5]),
    );
    expect(matchingValues(record({ D4: 1, D6: 2 }))).toEqual(new Set());
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
});
