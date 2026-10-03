import { describe, expect, it } from 'vitest';
import type { Die } from './dice';
import {
  addRoll,
  allDoors,
  buildDungeon,
  describeDoor,
  doorInsideCell,
  dungeonBounds,
  emptyDungeon,
  findDoor,
  findRoom,
  nextDoor,
  placementNotes,
  unexploredDoors,
  wallLength,
  type Dungeon,
  type Rect,
} from './dungeon';
import { rollRoom, type RollRecord } from './roll';
import { createRng } from './rng';
import { DEFAULT_SETTINGS } from './settings';
import { CLASSIC_TABLES } from './tables';

let nextId = 0;

/** A roll with chosen dice values (D10 = width, D100 = length, D4 = hallway, D6 = exits) */
function roll(values: Partial<Record<Die, number>>, seed = 1, door?: string): RollRecord {
  const results = Object.fromEntries(
    Object.entries(values).map(([die, value]) => [die, { value, description: '' }]),
  );
  return { id: `r${nextId++}`, timestamp: '', seed, results, ...(door && { door }) };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Invariants every dungeon must satisfy */
function checkDungeon(dungeon: Dungeon) {
  const { rooms, hallways } = dungeon;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      expect(overlaps(rooms[i]!.rect, rooms[j]!.rect), `rooms ${i} and ${j} overlap`).toBe(false);
    }
  }
  for (const hallway of hallways) {
    for (const cell of hallway.cells) {
      const inside = rooms.some(
        (r) =>
          cell.x >= r.rect.x &&
          cell.x < r.rect.x + r.rect.w &&
          cell.y >= r.rect.y &&
          cell.y < r.rect.y + r.rect.h,
      );
      expect(inside, 'hallway runs through a room').toBe(false);
    }
  }
  const names = allDoors(dungeon).map((door) => describeDoor(dungeon, door));
  expect(new Set(names).size, 'door names must be unique').toBe(names.length);
  const ids = new Set<string>();
  for (const door of allDoors(dungeon)) {
    expect(ids.has(door.id), `duplicate door ${door.id}`).toBe(false);
    ids.add(door.id);
    const room = findRoom(dungeon, door.roll)!;
    expect(door.offset).toBeGreaterThanOrEqual(0);
    expect(door.offset).toBeLessThan(wallLength(room.rect, door.wall));
    if (door.leadsTo?.kind === 'room') {
      expect(findRoom(dungeon, door.leadsTo.roll), `door ${door.id} leads nowhere`).toBeDefined();
    }
  }
}

describe('starting room', () => {
  it('places the first roll at the origin with the entrance hallway below it', () => {
    const dungeon = buildDungeon([roll({ D10: 3, D100: 4, D4: 3, D6: 0 })]);
    const room = dungeon.rooms[0]!;
    expect(room.travel).toBe('N');
    // Hallway cells (0,0), (0,-1), (0,-2); room starts at y = -3 and extends 4 up
    expect(dungeon.hallways[0]!.cells).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: -2 },
    ]);
    expect(room.rect).toEqual({ x: -1, y: -6, w: 3, h: 4 });
    expect(room.entrance).toMatchObject({ wall: 'S', offset: 1, leadsTo: { kind: 'outside' } });
    expect(dungeon.outcomes[dungeon.rooms[0]!.recordId]).toEqual({ kind: 'room', roll: 1 });
  });

  it('has no hallway for an immediate doorway (D4 = 1)', () => {
    const dungeon = buildDungeon([roll({ D10: 2, D100: 2, D4: 1 })]);
    expect(dungeon.hallways).toEqual([]);
    expect(dungeon.rooms[0]!.rect).toEqual({ x: -1, y: -1, w: 2, h: 2 });
  });
});

describe('exits', () => {
  it('places D6 ÷ 2 exits on walls other than the entrance wall, at distinct spots', () => {
    for (let seed = 0; seed < 200; seed++) {
      const dungeon = buildDungeon([roll({ D10: 4, D100: 4, D4: 2, D6: 6 }, seed)]);
      const room = dungeon.rooms[0]!;
      expect(room.exits).toHaveLength(3);
      expect(room.exits.every((door) => door.wall !== 'S')).toBe(true);
      const spots = new Set(room.exits.map((door) => `${door.wall}${door.offset}`));
      expect(spots.size).toBe(3);
    }
  });

  it('uses all three walls across many rolls (random walls)', () => {
    const walls = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      buildDungeon([roll({ D10: 3, D100: 3, D6: 1 }, seed)]).rooms[0]!.exits.forEach((d) =>
        walls.add(d.wall),
      );
    }
    expect([...walls].sort()).toEqual(['E', 'N', 'W']);
  });
});

describe('attaching rooms', () => {
  it('goes straight out through the chosen door and centres the room on the hallway', () => {
    const first = roll({ D10: 5, D100: 5, D4: 1, D6: 2 }, 3);
    let dungeon = buildDungeon([first]);
    const door = dungeon.rooms[0]!.exits[0]!;
    const second = roll({ D10: 3, D100: 2, D4: 2, D6: 0 }, 4, door.id);
    dungeon = buildDungeon([first, second]);

    const parent = dungeon.rooms[0]!;
    const room = dungeon.rooms[1]!;
    expect(room.travel).toBe(door.wall);
    expect(findDoor(dungeon, door.id)?.leadsTo).toEqual({ kind: 'room', roll: 2 });
    expect(room.entrance.leadsTo).toEqual({ kind: 'room', roll: 1 });
    expect(dungeon.cameThrough[second.id]).toBe(door.id);

    // The hallway starts just outside the door and runs 2 squares in the door's direction
    const inside = doorInsideCell(parent.rect, door.wall, door.offset);
    const hallway = dungeon.hallways.find((h) => h.roll === 2)!;
    expect(hallway.cells).toHaveLength(2);
    const step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[door.wall];
    expect(hallway.cells[0]).toEqual({ x: inside.x + step[0]!, y: inside.y + step[1]! });
    // Room's entrance is right after the hallway
    const entranceCell = doorInsideCell(room.rect, room.entrance.wall, room.entrance.offset);
    expect(entranceCell).toEqual({ x: inside.x + step[0]! * 3, y: inside.y + step[1]! * 3 });
  });

  it('defaults to the newest room’s first unexplored door', () => {
    const history = [roll({ D10: 5, D100: 5, D6: 4 }, 1), roll({ D10: 3, D100: 3, D6: 2 }, 2)];
    const dungeon = buildDungeon(history);
    expect(dungeon.rooms).toHaveLength(2);
    expect(nextDoor(dungeon)?.roll).toBe(2);
    expect(unexploredDoors(dungeon).map((d) => d.roll)).toEqual([2, 1]);
  });

  it('shrinks only the blocked direction when a room does not fit, and says so', () => {
    const dungeon = emptyDungeon();
    // Room 1 is the single square (0,0) with a door north
    addRoll(dungeon, roll({ D10: 1, D100: 1, D4: 1 }), 1, undefined);
    dungeon.rooms[0]!.exits.push({ id: '1-N0', roll: 1, wall: 'N', offset: 0 });
    // A long room across row -8 leaves rows -6 to -3 free (with the 1-square gap)
    dungeon.rooms.push({
      ...dungeon.rooms[0]!,
      roll: 50,
      rect: { x: -30, y: -8, w: 60, h: 1 },
      exits: [],
    });
    // A 10 x 10 room through a 2-square hallway: only 4 squares of length fit
    addRoll(dungeon, roll({ D10: 10, D100: 10, D4: 2 }), 2, findDoor(dungeon, '1-N0'));
    const room = findRoom(dungeon, 2)!;
    expect(room.rect).toEqual({ x: -5, y: -6, w: 10, h: 4 });
    expect(room.rolled).toEqual({ width: 10, length: 10 });
    expect(room.shrunk).toBe(true);
  });

  it('joins an existing room when a hallway runs into it', () => {
    const dungeon = emptyDungeon();
    addRoll(dungeon, roll({ D10: 5, D100: 5, D4: 1 }), 1, undefined);
    // A fake unexplored door on room 1's north wall, then a room placed north of it
    const room1 = dungeon.rooms[0]!;
    room1.exits.push({ id: '1-N2', roll: 1, wall: 'N', offset: 2 });
    room1.exits.push({ id: '1-N0', roll: 1, wall: 'N', offset: 0 });
    addRoll(dungeon, roll({ D10: 5, D100: 3, D4: 3 }), 2, findDoor(dungeon, '1-N2'));
    const room2 = dungeon.rooms[1]!;
    // Now explore the other north door: its hallway runs into room 2
    addRoll(dungeon, roll({ D10: 2, D100: 2, D4: 4 }), 3, findDoor(dungeon, '1-N0'));

    const outcome = Object.values(dungeon.outcomes)[2];
    expect(outcome).toEqual({ kind: 'joined', joinedRoll: 2 });
    expect(findDoor(dungeon, '1-N0')?.leadsTo).toEqual({ kind: 'room', roll: 2 });
    expect(room2.exits.some((d) => d.wall === 'S' && d.leadsTo?.kind === 'room')).toBe(true);
    checkDungeon(dungeon);
  });

  it('collapses into a dead end when a hallway hits another hallway', () => {
    const dungeon = emptyDungeon();
    addRoll(dungeon, roll({ D10: 1, D100: 1, D4: 1 }), 1, undefined);
    const room = dungeon.rooms[0]!;
    room.exits.push({ id: '1-E0', roll: 1, wall: 'E', offset: 0 });
    // Room 1 is the single square (0,0); a hallway crosses the path east of it
    dungeon.hallways.push({ roll: 99, cells: [{ x: 2, y: 0 }], deadEnd: true });
    addRoll(dungeon, roll({ D10: 2, D100: 2, D4: 4 }), 2, findDoor(dungeon, '1-E0'));
    expect(Object.values(dungeon.outcomes)[1]).toEqual({ kind: 'dead-end' });
    expect(findDoor(dungeon, '1-E0')?.leadsTo).toEqual({ kind: 'dead-end' });
  });

  it('starts a new section east of the map when no doors are left', () => {
    const history = [roll({ D10: 2, D100: 2, D4: 1, D6: 0 }), roll({ D10: 2, D100: 2, D4: 1 })];
    const dungeon = buildDungeon(history);
    expect(dungeon.rooms).toHaveLength(2);
    expect(dungeon.rooms[1]!.rect.x).toBeGreaterThan(dungeon.rooms[0]!.rect.x + 2);
    expect(dungeon.rooms[1]!.entrance.leadsTo).toEqual({ kind: 'outside' });
  });

  it('falls back to the next door when a recorded door is unknown or already used', () => {
    const history = [
      roll({ D10: 4, D100: 4, D6: 2 }, 1),
      roll({ D10: 2, D100: 2 }, 2, 'no-such-door'),
    ];
    expect(buildDungeon(history).rooms).toHaveLength(2);
  });
});

describe('buildDungeon', () => {
  it('is reproducible', () => {
    const history = Array.from({ length: 20 }, (_, i) =>
      rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, i * 7919),
    );
    expect(buildDungeon(history)).toEqual(buildDungeon(history));
  });

  it('keeps every dungeon consistent across many random explorations', () => {
    for (let trial = 0; trial < 150; trial++) {
      const choose = createRng(trial);
      const history: RollRecord[] = [];
      let dungeon = buildDungeon(history);
      for (let n = 0; n < 25; n++) {
        const doors = unexploredDoors(dungeon);
        const door = doors.length > 0 ? doors[choose.int(0, doors.length - 1)] : undefined;
        const record = {
          ...rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, trial * 1000 + n),
          ...(door && { door: door.id }),
        };
        history.push(record);
        dungeon = addRoll(dungeon, record, history.length, door);
      }
      checkDungeon(dungeon);
      // Replaying the history gives the same map
      expect(buildDungeon(history)).toEqual(dungeon);
      expect(Object.keys(dungeon.outcomes)).toHaveLength(25);
    }
  });

  it('works with dice switched off', () => {
    const enabled = {
      ...DEFAULT_SETTINGS.enabledDice,
      D4: false,
      D6: false,
      D10: false,
      D100: false,
    };
    const history = [1, 2, 3].map((seed) => rollRoom(CLASSIC_TABLES, enabled, seed));
    const dungeon = buildDungeon(history);
    // No exits, so each roll starts a new 5 x 1 section
    expect(dungeon.rooms.map((r) => [r.rect.w, r.rect.h])).toEqual([
      [5, 1],
      [5, 1],
      [5, 1],
    ]);
    checkDungeon(dungeon);
  });
});

describe('dungeonBounds', () => {
  it('covers rooms and hallways', () => {
    expect(dungeonBounds(emptyDungeon())).toBeNull();
    const dungeon = buildDungeon([roll({ D10: 3, D100: 4, D4: 3 })]);
    expect(dungeonBounds(dungeon)).toEqual({ x: -1, y: -6, w: 3, h: 7 });
  });
});

describe('placementNotes', () => {
  it('describes where each roll went', () => {
    const dungeon = emptyDungeon();
    const first = roll({ D10: 1, D100: 1, D4: 1 });
    addRoll(dungeon, first, 1, undefined);
    expect(placementNotes(dungeon, first, 1)).toEqual(['Start of a new section of the dungeon.']);

    dungeon.rooms[0]!.exits.push({ id: '1-E0', roll: 1, wall: 'E', offset: 0 });
    dungeon.hallways.push({ roll: 99, cells: [{ x: 2, y: 0 }], deadEnd: true });
    const collapsed = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(dungeon, collapsed, 2, findDoor(dungeon, '1-E0'));
    expect(placementNotes(dungeon, collapsed, 2)).toEqual([
      'Through Room 1, east door.',
      'The passage collapses. Dead end, no new room.',
    ]);
  });

  it('mentions joins and shrinking', () => {
    const dungeon = emptyDungeon();
    addRoll(dungeon, roll({ D10: 1, D100: 1, D4: 1 }), 1, undefined);
    dungeon.rooms[0]!.exits.push({ id: '1-N0', roll: 1, wall: 'N', offset: 0 });
    dungeon.rooms.push({
      ...dungeon.rooms[0]!,
      roll: 50,
      rect: { x: -30, y: -8, w: 60, h: 1 },
      exits: [],
    });
    const big = roll({ D10: 10, D100: 10, D4: 2 });
    addRoll(dungeon, big, 2, findDoor(dungeon, '1-N0'));
    expect(placementNotes(dungeon, big, 2)).toEqual([
      'Through Room 1, north door.',
      'Rolled 50ft x 50ft, but only 50ft x 20ft fits here.',
    ]);

    dungeon.rooms[1]!.exits.push({ id: '2-N4', roll: 2, wall: 'N', offset: 4 });
    // Room 2 is rows -6 to -3, room 50 is row -8: a 1-square hallway (D4 = 2) reaches it
    const joined = roll({ D10: 2, D100: 2, D4: 2 });
    addRoll(dungeon, joined, 3, findDoor(dungeon, '2-N4'));
    expect(placementNotes(dungeon, joined, 3)[1]).toBe(
      'The passage leads into Room 50. No new room.',
    );
  });
});

describe('describeDoor', () => {
  it('numbers doors that share a wall', () => {
    const dungeon = emptyDungeon();
    addRoll(dungeon, roll({ D10: 4, D100: 4, D4: 1 }), 1, undefined);
    const room = dungeon.rooms[0]!;
    room.exits.push({ id: '1-N3', roll: 1, wall: 'N', offset: 3 });
    room.exits.push({ id: '1-N0', roll: 1, wall: 'N', offset: 0 });
    room.exits.push({ id: '1-E1', roll: 1, wall: 'E', offset: 1 });
    expect(describeDoor(dungeon, findDoor(dungeon, '1-N0')!)).toBe(
      'Room 1, north door 1 (from west)',
    );
    expect(describeDoor(dungeon, findDoor(dungeon, '1-N3')!)).toBe(
      'Room 1, north door 2 (from west)',
    );
    expect(describeDoor(dungeon, findDoor(dungeon, '1-E1')!)).toBe('Room 1, east door');
  });
});
