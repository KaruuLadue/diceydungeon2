import { describe, expect, it } from 'vitest';
import { DICE } from './dice';
import {
  CLASSIC_TABLES,
  describeEffect,
  findEmptyEntry,
  mergeTables,
  normalizeEntry,
  parseTablesFile,
  sameTable,
} from './tables';

const texts = (...values: string[]) => values.map((text) => ({ text }));

describe('CLASSIC_TABLES', () => {
  it('has v1’s table sizes (D100 has 10 entries)', () => {
    expect(DICE.map((die) => CLASSIC_TABLES[die].length)).toEqual([4, 6, 8, 10, 12, 20, 10]);
  });

  it('gives the two "roll again" D20 entries their effects', () => {
    expect(CLASSIC_TABLES.D20[6]).toEqual({
      text: 'False Safety - Harmless appears dangerous; roll again.',
      reroll: ['D20'],
    });
    expect(CLASSIC_TABLES.D20[19]?.reroll).toEqual(['D8', 'D12']);
    const withEffects = DICE.flatMap((die) => CLASSIC_TABLES[die]).filter((e) => e.reroll);
    expect(withEffects).toHaveLength(2);
  });
});

describe('normalizeEntry', () => {
  it('accepts plain text and objects', () => {
    expect(normalizeEntry('Dusty room')).toEqual({ text: 'Dusty room' });
    expect(normalizeEntry({ text: 'Twist', reroll: ['D12', 'D8'] })).toEqual({
      text: 'Twist',
      reroll: ['D8', 'D12'],
    });
  });

  it('drops unknown dice and empty effect lists', () => {
    expect(normalizeEntry({ text: 'A', reroll: ['D7', 'D8', 'D8'] })).toEqual({
      text: 'A',
      reroll: ['D8'],
    });
    expect(normalizeEntry({ text: 'A', reroll: [] })).toEqual({ text: 'A' });
    expect(normalizeEntry({ text: 'A', reroll: 'D8' })).toEqual({ text: 'A' });
  });

  it('rejects empty or malformed entries', () => {
    expect(normalizeEntry('  ')).toBeNull();
    expect(normalizeEntry({ text: '' })).toBeNull();
    expect(normalizeEntry(42)).toBeNull();
    expect(normalizeEntry(null)).toBeNull();
  });
});

describe('mergeTables', () => {
  it('uses custom tables that match the default shape, in either format', () => {
    expect(mergeTables(CLASSIC_TABLES, { D4: ['a', 'b', 'c', 'd'] }).D4).toEqual(
      texts('a', 'b', 'c', 'd'),
    );
    const withEffect = [{ text: 'a', reroll: ['D8'] }, 'b', 'c', 'd'];
    expect(mergeTables(CLASSIC_TABLES, { D4: withEffect }).D4[0]).toEqual({
      text: 'a',
      reroll: ['D8'],
    });
  });

  it('ignores custom tables with the wrong length, per die', () => {
    const custom = {
      D4: ['a', 'b', 'c', 'd'],
      D100: Array.from({ length: 100 }, (_, i) => `old ${i}`),
    };
    const merged = mergeTables(CLASSIC_TABLES, custom);
    expect(merged.D4).toEqual(texts('a', 'b', 'c', 'd'));
    expect(merged.D100).toEqual(CLASSIC_TABLES.D100);
  });

  it('ignores empty entries and non-objects', () => {
    expect(mergeTables(CLASSIC_TABLES, { D4: ['a', '', 'c', 'd'] }).D4).toEqual(CLASSIC_TABLES.D4);
    expect(mergeTables(CLASSIC_TABLES, null)).toEqual(CLASSIC_TABLES);
    expect(mergeTables(CLASSIC_TABLES, 'nope')).toEqual(CLASSIC_TABLES);
  });
});

describe('parseTablesFile', () => {
  it('accepts a complete v2 tables file', () => {
    const result = parseTablesFile(JSON.stringify(CLASSIC_TABLES));
    expect(result).toEqual({ ok: true, tables: CLASSIC_TABLES });
  });

  it('accepts a v1 tables file (plain text entries)', () => {
    const v1 = Object.fromEntries(
      DICE.map((die) => [die, CLASSIC_TABLES[die].map((entry) => entry.text)]),
    );
    const result = parseTablesFile(JSON.stringify(v1));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tables.D20[6]).toEqual({ text: CLASSIC_TABLES.D20[6]!.text });
  });

  it('rejects invalid JSON', () => {
    expect(parseTablesFile('{')).toEqual({ ok: false, error: 'The file is not valid JSON.' });
  });

  it('names the first invalid die', () => {
    const { D8: _, ...missingD8 } = CLASSIC_TABLES;
    const result = parseTablesFile(JSON.stringify(missingD8));
    expect(result).toEqual({ ok: false, error: 'D8 must have 8 non-empty entries.' });
  });
});

describe('findEmptyEntry', () => {
  it('reports the first empty entry', () => {
    expect(findEmptyEntry('D4', texts('a', ' ', '', 'd'))).toBe('D4: entry 2 cannot be empty.');
    expect(findEmptyEntry('D4', texts('a', 'b', 'c', 'd'))).toBeNull();
  });
});

describe('sameTable', () => {
  it('compares text and effects', () => {
    expect(sameTable(texts('a', 'b'), texts('a', 'b'))).toBe(true);
    expect(sameTable(texts('a', 'b'), texts('a', 'c'))).toBe(false);
    expect(sameTable([{ text: 'a', reroll: ['D8'] }], [{ text: 'a' }])).toBe(false);
  });
});

describe('describeEffect', () => {
  it('describes reroll effects', () => {
    expect(describeEffect({ text: 'a' })).toBeNull();
    expect(describeEffect({ text: 'a', reroll: ['D20'] })).toBe('Rolls D20 again');
    expect(describeEffect({ text: 'a', reroll: ['D8', 'D12'] })).toBe('Rolls D8 and D12 again');
    expect(describeEffect({ text: 'a', reroll: ['D4', 'D8', 'D12'] })).toBe(
      'Rolls D4, D8 and D12 again',
    );
  });
});
