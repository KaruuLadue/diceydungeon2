import { describe, expect, it } from 'vitest';
import type { Die } from './dice';
import {
  addRoll,
  allDoors,
  buildDungeon,
  canExplore,
  describeDoor,
  doorInsideCell,
  dungeonBounds,
  emptyDungeon,
  extendDungeon,
  findDoor,
  findRoom,
  nextDoor,
  placementNotes,
  unexploredDoors,
  wallLength,
  type Dungeon,
  type PlacedRoom,
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

/** An obstacle room for setting up tight spots, entered from the north */
function obstacle(dungeon: Dungeon, rollNumber: number, rect: Rect): PlacedRoom {
  const room: PlacedRoom = {
    ...dungeon.rooms[0]!,
    roll: rollNumber,
    recordId: `obstacle-${rollNumber}`,
    rect,
    entrance: {
      id: `${rollNumber}-N0`,
      roll: rollNumber,
      wall: 'N',
      offset: 0,
      leadsTo: { kind: 'outside' },
    },
    exits: [],
  };
  dungeon.rooms.push(room);
  return room;
}

/** A dungeon whose room 1 is the single square (0,0) with one door on `wall` */
function tinyStart(wall: 'N' | 'E' | 'W'): Dungeon {
  const dungeon = emptyDungeon();
  addRoll(dungeon, roll({ D10: 1, D100: 1, D4: 1 }), 1, undefined);
  dungeon.rooms[0]!.exits.push({ id: `1-${wall}0`, roll: 1, wall, offset: 0 });
  return dungeon;
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
  for (const room of rooms) {
    const walls = [room.entrance, ...room.exits].map((door) => door.wall);
    expect(new Set(walls).size, `room ${room.roll} has two doors on one wall`).toBe(walls.length);
  }
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
  for (const door of unexploredDoors(dungeon)) {
    expect(canExplore(dungeon, door), `${describeDoor(door)} can't be explored`).toBe(true);
  }
}

describe('starting room', () => {
  it('places the first roll at the origin with the entrance hallway below it', () => {
    const dungeon = buildDungeon([roll({ D10: 3, D100: 4, D4: 3, D6: 0 })]);
    const room = dungeon.rooms[0]!;
    expect(room.travel).toBe('N');
    expect(dungeon.hallways[0]!.cells).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: -2 },
    ]);
    expect(room.rect).toEqual({ x: -1, y: -6, w: 3, h: 4 });
    expect(room.entrance).toMatchObject({ wall: 'S', offset: 1, leadsTo: { kind: 'outside' } });
    expect(room).toMatchObject({
      shrunk: false,
      rotated: false,
      hallway: { rolled: 3, actual: 3 },
    });
    expect(dungeon.outcomes[room.recordId]).toEqual({ kind: 'room', roll: 1 });
  });

  it('has no hallway for an immediate doorway (D4 = 1)', () => {
    const dungeon = buildDungeon([roll({ D10: 2, D100: 2, D4: 1 })]);
    expect(dungeon.hallways).toEqual([]);
    expect(dungeon.rooms[0]!.rect).toEqual({ x: -1, y: -1, w: 2, h: 2 });
  });
});

describe('exits', () => {
  it('puts at most one door on each wall, never on the entrance wall', () => {
    for (let seed = 0; seed < 200; seed++) {
      const dungeon = buildDungeon([roll({ D10: 4, D100: 4, D4: 2, D6: 6 }, seed)]);
      const room = dungeon.rooms[0]!;
      expect(room.exits.map((d) => d.wall).sort()).toEqual(['E', 'N', 'W']);
      expect(room.exitsPlaced).toBe(3);
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

  it('never puts a door where no room could follow', () => {
    const dungeon = tinyStart('E');
    // A wide obstacle ending at row -2: its 1-square gap covers row -1, right above room 2
    obstacle(dungeon, 50, { x: -12, y: -20, w: 30, h: 19 }); // rows -20..-2
    // Room 2 east of room 1, three exits rolled; north has no space for even a 1-square room
    addRoll(dungeon, roll({ D10: 1, D100: 1, D4: 2, D6: 6 }, 4), 2, findDoor(dungeon, '1-E0'));
    const room = findRoom(dungeon, 2)!;
    expect(room.exits.some((d) => d.wall === 'N')).toBe(false);
    expect(room.exitsPlaced).toBeLessThan(room.exitsRolled);
    checkDungeon(dungeon);
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

    const inside = doorInsideCell(parent.rect, door.wall, door.offset);
    const hallway = dungeon.hallways.find((h) => h.roll === 2)!;
    expect(hallway.cells).toHaveLength(2);
    const step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[door.wall];
    expect(hallway.cells[0]).toEqual({ x: inside.x + step[0]!, y: inside.y + step[1]! });
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

  it('turns a room 90° when that lets it keep its full size', () => {
    const dungeon = tinyStart('N');
    // A long obstacle across row -8 leaves rows -6 to -3 free (with the 1-square gap)
    obstacle(dungeon, 50, { x: -30, y: -8, w: 60, h: 1 });
    // 10ft wide, 40ft long: too long for the space, but fits turned sideways
    addRoll(dungeon, roll({ D10: 2, D100: 8, D4: 2 }), 2, findDoor(dungeon, '1-N0'));
    const room = findRoom(dungeon, 2)!;
    expect(room).toMatchObject({ rotated: true, shrunk: false });
    expect(room.rect).toMatchObject({ w: 8, h: 2 });
    checkDungeon(dungeon);
  });

  it('shrinks only the blocked direction when a room does not fit', () => {
    const dungeon = tinyStart('N');
    obstacle(dungeon, 50, { x: -30, y: -8, w: 60, h: 1 });
    // A 10 x 10 room through a 2-square hallway: only 4 squares of length fit
    addRoll(dungeon, roll({ D10: 10, D100: 10, D4: 2 }), 2, findDoor(dungeon, '1-N0'));
    const room = findRoom(dungeon, 2)!;
    expect(room.rect).toEqual({ x: -5, y: -6, w: 10, h: 4 });
    expect(room).toMatchObject({ shrunk: true, hallway: { rolled: 2, actual: 2 } });
  });

  it('shortens the hallway when its rolled length is blocked', () => {
    const dungeon = tinyStart('N');
    // An old hallway crosses the path 3 squares north of room 1
    dungeon.hallways.push({ roll: 99, cells: [{ x: 0, y: -3 }], deadEnd: false });
    addRoll(dungeon, roll({ D10: 3, D100: 3, D4: 4 }), 2, findDoor(dungeon, '1-N0'));
    const room = findRoom(dungeon, 2)!;
    expect(room.hallway).toEqual({ rolled: 4, actual: 1 });
    expect(dungeon.outcomes[room.recordId]).toEqual({ kind: 'room', roll: 2 });
    checkDungeon(dungeon);
  });

  it('leads into a room it runs into when that wall has no door', () => {
    const dungeon = tinyStart('N');
    const target = obstacle(dungeon, 50, { x: -5, y: -6, w: 11, h: 3 }); // rows -6..-4
    const record = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(dungeon, record, 2, findDoor(dungeon, '1-N0'));
    expect(dungeon.outcomes[record.id]).toEqual({ kind: 'joined', joinedRoll: 50 });
    expect(target.exits).toEqual([
      expect.objectContaining({ wall: 'S', offset: 5, leadsTo: { kind: 'room', roll: 1 } }),
    ]);
    checkDungeon(dungeon);
  });

  it('does not add a second door to a wall; the room goes elsewhere instead', () => {
    const dungeon = tinyStart('N');
    const target = obstacle(dungeon, 50, { x: -5, y: -6, w: 11, h: 3 });
    target.exits.push({ id: '50-S0', roll: 50, wall: 'S', offset: 0 });
    const record = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(dungeon, record, 2, findDoor(dungeon, '1-N0'));
    expect(dungeon.outcomes[record.id]).toEqual({ kind: 'room', roll: 2 });
    expect(target.exits.map((d) => d.id)).toEqual(['50-S0']);
    // Obstacle 50's own door must still be usable
    expect(canExplore(dungeon, findDoor(dungeon, '50-S0')!)).toBe(true);
    checkDungeon(dungeon);
  });

  it('collapses only when there is no space at all', () => {
    const dungeon = tinyStart('E');
    dungeon.hallways.push({ roll: 99, cells: [{ x: 1, y: 0 }], deadEnd: true });
    const record = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(dungeon, record, 2, findDoor(dungeon, '1-E0'));
    expect(dungeon.outcomes[record.id]).toEqual({ kind: 'dead-end' });
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

  it('keeps every dungeon consistent and explorable across many random explorations', () => {
    for (let trial = 0; trial < 120; trial++) {
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
      const outcomes = Object.values(dungeon.outcomes);
      expect(
        outcomes.filter((o) => o.kind === 'dead-end'),
        `trial ${trial}`,
      ).toEqual([]);
      expect(buildDungeon(history)).toEqual(dungeon);
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
  it('describes the start, a collapse and a join', () => {
    const dungeon = tinyStart('E');
    const first = dungeon.rooms[0]!;
    expect(placementNotes(dungeon, { id: first.recordId } as RollRecord, 1)).toEqual([
      'Start of a new section of the dungeon.',
    ]);
    dungeon.hallways.push({ roll: 99, cells: [{ x: 1, y: 0 }], deadEnd: true });
    const collapsed = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(dungeon, collapsed, 2, findDoor(dungeon, '1-E0'));
    expect(placementNotes(dungeon, collapsed, 2)).toEqual([
      'Through Room 1, east door.',
      'The passage collapses. Dead end, no new room.',
    ]);

    const joining = tinyStart('N');
    obstacle(joining, 50, { x: -5, y: -6, w: 11, h: 3 });
    const joined = roll({ D10: 2, D100: 2, D4: 4 });
    addRoll(joining, joined, 2, findDoor(joining, '1-N0'));
    expect(placementNotes(joining, joined, 2)[1]).toBe(
      'The passage leads into Room 50. No new room.',
    );
  });

  it('mentions turning, shrinking and hallway changes', () => {
    const turned = tinyStart('N');
    obstacle(turned, 50, { x: -30, y: -8, w: 60, h: 1 });
    const long = roll({ D10: 2, D100: 8, D4: 2 });
    addRoll(turned, long, 2, findDoor(turned, '1-N0'));
    expect(placementNotes(turned, long, 2)[1]).toBe(
      'Turned sideways to fit: 40ft x 10ft instead of 10ft x 40ft.',
    );

    const shrunk = tinyStart('N');
    obstacle(shrunk, 50, { x: -30, y: -8, w: 60, h: 1 });
    const big = roll({ D10: 10, D100: 10, D4: 2 });
    addRoll(shrunk, big, 2, findDoor(shrunk, '1-N0'));
    expect(placementNotes(shrunk, big, 2)[1]).toBe(
      'Rolled 50ft x 50ft, but only 50ft x 20ft fits here.',
    );

    const short = tinyStart('N');
    short.hallways.push({ roll: 99, cells: [{ x: 0, y: -3 }], deadEnd: false });
    const blocked = roll({ D10: 3, D100: 3, D4: 4 });
    addRoll(short, blocked, 2, findDoor(short, '1-N0'));
    expect(placementNotes(short, blocked, 2)).toContain(
      'Hallway is 1 square instead of 4 squares so the room fits.',
    );
  });
});

describe('describeDoor', () => {
  it('names the room and wall', () => {
    const dungeon = tinyStart('E');
    expect(describeDoor(findDoor(dungeon, '1-E0')!)).toBe('Room 1, east door');
  });
});

describe('extendDungeon', () => {
  it('matches a full rebuild and leaves the original untouched', () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      rollRoom(CLASSIC_TABLES, DEFAULT_SETTINGS.enabledDice, i * 31),
    );
    let dungeon = buildDungeon([]);
    history.forEach((record, i) => {
      const before = structuredClone(dungeon);
      const next = extendDungeon(dungeon, record, i + 1);
      expect(dungeon).toEqual(before);
      dungeon = next;
    });
    expect(dungeon).toEqual(buildDungeon(history));
  });
});
