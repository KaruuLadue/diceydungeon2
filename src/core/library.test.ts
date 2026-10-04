import { describe, expect, it } from 'vitest';
import {
  addDungeon,
  currentDungeon,
  defaultName,
  newDungeon,
  removeDungeon,
  uniqueName,
  updateCurrent,
  type Library,
} from './library';
import { rollSeed } from './rng';

const at = (day: number) => new Date(`2026-10-0${day}T12:00:00Z`);

function library(): Library {
  const first = newDungeon('Dungeon 1', 1, [], at(1));
  return addDungeon(
    addDungeon({ current: '', dungeons: [first] }, newDungeon('Crypt', 2, [], at(2))),
    newDungeon('Sewer', 3, [], at(3)),
  );
}

describe('library', () => {
  it('adds a dungeon and switches to it', () => {
    const lib = library();
    expect(lib.dungeons.map((d) => d.name)).toEqual(['Dungeon 1', 'Crypt', 'Sewer']);
    expect(currentDungeon(lib).name).toBe('Sewer');
  });

  it('changes only the current dungeon', () => {
    const lib = updateCurrent(library(), { name: 'Deep Sewer' }, at(4));
    expect(lib.dungeons.map((d) => d.name)).toEqual(['Dungeon 1', 'Crypt', 'Deep Sewer']);
    expect(currentDungeon(lib).updatedAt).toBe(at(4).toISOString());
  });

  it('suggests names that aren’t taken', () => {
    const lib = library();
    expect(defaultName(lib)).toBe('Dungeon 2');
    expect(uniqueName(lib, 'Crypt')).toBe('Crypt (2)');
    expect(uniqueName(lib, 'Tower')).toBe('Tower');
  });

  it('after deleting the current dungeon, switches to the most recently played', () => {
    let lib = library();
    lib = updateCurrent({ ...lib, current: lib.dungeons[0]!.id }, { name: 'Dungeon 1' }, at(5));
    lib = removeDungeon({ ...lib, current: lib.dungeons[2]!.id }, lib.dungeons[2]!.id, 9);
    expect(currentDungeon(lib).name).toBe('Dungeon 1');
  });

  it('always keeps one dungeon', () => {
    const only = newDungeon('Only', 1, [], at(1));
    const lib = removeDungeon({ current: only.id, dungeons: [only] }, only.id, 9, at(2));
    expect(lib.dungeons).toHaveLength(1);
    expect(currentDungeon(lib)).toMatchObject({ name: 'Dungeon 1', seed: 9, history: [] });
  });
});

describe('rollSeed', () => {
  it('gives each roll of a dungeon its own repeatable seed', () => {
    const seeds = Array.from({ length: 1000 }, (_, i) => rollSeed(1234, i + 1));
    expect(new Set(seeds).size).toBe(1000);
    expect(rollSeed(1234, 5)).toBe(seeds[4]);
    expect(rollSeed(1235, 5)).not.toBe(seeds[4]);
    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s < 2 ** 32)).toBe(true);
  });
});
