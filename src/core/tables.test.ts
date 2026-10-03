import { describe, expect, it } from 'vitest';
import { DICE } from './dice';
import { CLASSIC_TABLES, findEmptyEntry, mergeTables, parseTablesFile } from './tables';

describe('CLASSIC_TABLES', () => {
  it('has v1’s table sizes (D100 has 10 entries)', () => {
    expect(DICE.map((die) => CLASSIC_TABLES[die].length)).toEqual([4, 6, 8, 10, 12, 20, 10]);
  });
});

describe('mergeTables', () => {
  it('uses custom tables that match the default shape', () => {
    const custom = { D4: ['a', 'b', 'c', 'd'] };
    expect(mergeTables(CLASSIC_TABLES, custom).D4).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores custom tables with the wrong length, per die', () => {
    const custom = {
      D4: ['a', 'b', 'c', 'd'],
      D100: Array.from({ length: 100 }, (_, i) => `old ${i}`),
    };
    const merged = mergeTables(CLASSIC_TABLES, custom);
    expect(merged.D4).toEqual(['a', 'b', 'c', 'd']);
    expect(merged.D100).toEqual(CLASSIC_TABLES.D100);
  });

  it('ignores empty entries and non-objects', () => {
    expect(mergeTables(CLASSIC_TABLES, { D4: ['a', '', 'c', 'd'] }).D4).toEqual(CLASSIC_TABLES.D4);
    expect(mergeTables(CLASSIC_TABLES, null)).toEqual(CLASSIC_TABLES);
    expect(mergeTables(CLASSIC_TABLES, 'nope')).toEqual(CLASSIC_TABLES);
  });

  it('does not share arrays with the input', () => {
    const custom = { D4: ['a', 'b', 'c', 'd'] };
    const merged = mergeTables(CLASSIC_TABLES, custom);
    custom.D4[0] = 'changed';
    expect(merged.D4[0]).toBe('a');
  });
});

describe('parseTablesFile', () => {
  it('accepts a complete tables file', () => {
    const result = parseTablesFile(JSON.stringify(CLASSIC_TABLES));
    expect(result).toEqual({ ok: true, tables: CLASSIC_TABLES });
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
    expect(findEmptyEntry('D4', ['a', ' ', '', 'd'])).toBe('D4: entry 2 cannot be empty.');
    expect(findEmptyEntry('D4', ['a', 'b', 'c', 'd'])).toBeNull();
  });
});
