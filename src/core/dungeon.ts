import { roomLayout } from './layout';
import { createRng, type Rng } from './rng';
import type { RollRecord } from './roll';

/**
 * The connected dungeon map.
 *
 * Coordinates are grid cells (5ft squares), x to the right and y downward.
 * The map is never stored: it's rebuilt by replaying the roll history, where
 * each roll remembers the door it was rolled through. Placement uses a random
 * stream derived from each roll's seed, so the same history always produces
 * the same map.
 */

export type Dir = 'N' | 'E' | 'S' | 'W';

export interface Cell {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a door leads: a room (by roll number), the dungeon entrance, or a dead end */
export type DoorTarget =
  { kind: 'room'; roll: number } | { kind: 'outside' } | { kind: 'dead-end' };

export interface Door {
  id: string;
  /** Roll number of the room this door is in */
  roll: number;
  wall: Dir;
  /** Position along the wall: cells from the left (N/S walls) or top (E/W walls) */
  offset: number;
  /** Undefined while unexplored */
  leadsTo?: DoorTarget;
}

export interface PlacedRoom {
  /** Roll number (1-based position in the history) that created this room */
  roll: number;
  recordId: string;
  rect: Rect;
  /** Direction travelled to enter the room */
  travel: Dir;
  /** Size the dice asked for, in squares (width across the direction of travel) */
  rolled: { width: number; length: number };
  /** True if the room had to be made smaller to fit */
  shrunk: boolean;
  /** The door you enter through */
  entrance: Door;
  /** Every other door: extra exits, plus doors made when a passage joined this room */
  exits: Door[];
}

export interface Hallway {
  /** Roll that created it */
  roll: number;
  cells: Cell[];
  /** The hallway ends without reaching a room */
  deadEnd: boolean;
}

export type RollOutcome =
  { kind: 'room'; roll: number } | { kind: 'joined'; joinedRoll: number } | { kind: 'dead-end' };

export interface Dungeon {
  rooms: PlacedRoom[];
  hallways: Hallway[];
  /** What each roll produced, by record id */
  outcomes: Record<string, RollOutcome>;
  /** Door each roll came through, by record id (absent for starting rooms) */
  cameThrough: Record<string, string>;
}

const STEP: Record<Dir, Cell> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };
const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** Most attempts at finding a free spot for one extra exit */
const EXIT_ATTEMPTS = 20;

const add = (a: Cell, b: Cell, times = 1): Cell => ({ x: a.x + b.x * times, y: a.y + b.y * times });
const inRect = (c: Cell, r: Rect) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  w: r.w + by * 2,
  h: r.h + by * 2,
});

/** Number of cells along a wall */
export function wallLength(rect: Rect, wall: Dir): number {
  return wall === 'N' || wall === 'S' ? rect.w : rect.h;
}

/** The cell inside the room next to a door */
export function doorInsideCell(rect: Rect, wall: Dir, offset: number): Cell {
  switch (wall) {
    case 'N':
      return { x: rect.x + offset, y: rect.y };
    case 'S':
      return { x: rect.x + offset, y: rect.y + rect.h - 1 };
    case 'W':
      return { x: rect.x, y: rect.y + offset };
    case 'E':
      return { x: rect.x + rect.w - 1, y: rect.y + offset };
  }
}

/** Offset of a cell along a room's wall */
function offsetOf(rect: Rect, wall: Dir, cell: Cell): number {
  return wall === 'N' || wall === 'S' ? cell.x - rect.x : cell.y - rect.y;
}

/**
 * Rectangle for a room entered at `start` (its first cell) while travelling
 * `travel`, with `entranceOffset` cells of the room to the entrance's left/top.
 */
function roomRect(
  start: Cell,
  travel: Dir,
  width: number,
  length: number,
  entranceOffset: number,
): Rect {
  switch (travel) {
    case 'N':
      return { x: start.x - entranceOffset, y: start.y - length + 1, w: width, h: length };
    case 'S':
      return { x: start.x - entranceOffset, y: start.y, w: width, h: length };
    case 'E':
      return { x: start.x, y: start.y - entranceOffset, w: length, h: width };
    case 'W':
      return { x: start.x - length + 1, y: start.y - entranceOffset, w: length, h: width };
  }
}

/**
 * Sizes to try: every size up to the rolled one, largest area first. Ties go
 * to the size whose shape is closest to the rolled one, so a room blocked in
 * one direction keeps its full size in the other.
 */
function sizesToTry(width: number, length: number): Array<[number, number]> {
  const sizes: Array<[number, number]> = [];
  for (let w = 1; w <= width; w++) {
    for (let l = 1; l <= length; l++) sizes.push([w, l]);
  }
  const shapeChange = ([w, l]: [number, number]) => Math.abs(w / l - width / length);
  return sizes.sort((a, b) => b[0] * b[1] - a[0] * a[1] || shapeChange(a) - shapeChange(b));
}

/** Entrance offsets to try, nearest the centre first */
function offsetsToTry(width: number): number[] {
  const centre = Math.floor(width / 2);
  return Array.from({ length: width }, (_, i) => i).sort(
    (a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b,
  );
}

export function emptyDungeon(): Dungeon {
  return { rooms: [], hallways: [], outcomes: {}, cameThrough: {} };
}

export function allDoors(dungeon: Dungeon): Door[] {
  return dungeon.rooms.flatMap((room) => [room.entrance, ...room.exits]);
}

export function findDoor(dungeon: Dungeon, id: string): Door | undefined {
  return allDoors(dungeon).find((door) => door.id === id);
}

export function findRoom(dungeon: Dungeon, roll: number): PlacedRoom | undefined {
  return dungeon.rooms.find((room) => room.roll === roll);
}

/** Unexplored doors, newest room first */
export function unexploredDoors(dungeon: Dungeon): Door[] {
  return [...dungeon.rooms]
    .reverse()
    .flatMap((room) => room.exits.filter((door) => door.leadsTo === undefined));
}

/** The door the Roll button explores: the newest room's first unexplored door */
export function nextDoor(dungeon: Dungeon): Door | undefined {
  return unexploredDoors(dungeon)[0];
}

/** Bounding box of everything on the map, or null if it's empty */
export function dungeonBounds(dungeon: Dungeon): Rect | null {
  const rects = [
    ...dungeon.rooms.map((room) => room.rect),
    ...dungeon.hallways.flatMap((h) => h.cells.map((c) => ({ x: c.x, y: c.y, w: 1, h: 1 }))),
  ];
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function roomAt(dungeon: Dungeon, cell: Cell): PlacedRoom | undefined {
  return dungeon.rooms.find((room) => inRect(cell, room.rect));
}

function hallwayAt(dungeon: Dungeon, cell: Cell): boolean {
  return dungeon.hallways.some((h) => h.cells.some((c) => c.x === cell.x && c.y === cell.y));
}

/** A room fits if it overlaps nothing and keeps a 1-square gap from other rooms */
function fits(dungeon: Dungeon, rect: Rect, parent: PlacedRoom | undefined): boolean {
  for (const room of dungeon.rooms) {
    const keepClear = room === parent ? room.rect : grow(room.rect, 1);
    if (overlaps(rect, keepClear)) return false;
  }
  return !dungeon.hallways.some((h) => h.cells.some((c) => inRect(c, rect)));
}

/** Add extra exits on random walls (never the entrance wall), at distinct spots */
function placeExits(room: PlacedRoom, count: number, rng: Rng): void {
  const walls = DIRS.filter((dir) => dir !== room.entrance.wall);
  for (let n = 0; n < count; n++) {
    for (let attempt = 0; attempt < EXIT_ATTEMPTS; attempt++) {
      const wall = walls[rng.int(0, walls.length - 1)] as Dir;
      const offset = rng.int(0, wallLength(room.rect, wall) - 1);
      const taken = room.exits.some((d) => d.wall === wall && d.offset === offset);
      if (!taken) {
        room.exits.push({ id: `${room.roll}-${wall}${offset}`, roll: room.roll, wall, offset });
        break;
      }
    }
  }
}

/** Add (or reuse) a door on `room` where a passage arrives, linking it back */
function joinRoom(room: PlacedRoom, wall: Dir, cell: Cell, from: DoorTarget): Door {
  const offset = offsetOf(room.rect, wall, cell);
  const existing = [room.entrance, ...room.exits].find(
    (d) => d.wall === wall && d.offset === offset,
  );
  if (existing) {
    existing.leadsTo ??= from;
    return existing;
  }
  const door: Door = {
    id: `${room.roll}-${wall}${offset}`,
    roll: room.roll,
    wall,
    offset,
    leadsTo: from,
  };
  room.exits.push(door);
  return door;
}

/** Start point for a room with no door to come through: the origin, or east of the map */
function startingPoint(dungeon: Dungeon): Cell {
  const bounds = dungeonBounds(dungeon);
  return bounds ? { x: bounds.x + bounds.w + 6, y: bounds.y + bounds.h - 1 } : { x: 0, y: 0 };
}

/**
 * Add one roll to the dungeon, through `door` (or as a new starting room if
 * there's no door). Mutates and returns the dungeon.
 */
export function addRoll(
  dungeon: Dungeon,
  record: RollRecord,
  roll: number,
  door: Door | undefined,
): Dungeon {
  // Separate random stream from the dice, so placement doesn't change the results
  const rng = createRng((record.seed ^ 0x5bd1e995) >>> 0);
  const layout = roomLayout(record);
  const parent = door ? findRoom(dungeon, door.roll) : undefined;
  const travel: Dir = door ? door.wall : 'N';
  const step = STEP[travel];
  const fromParent: DoorTarget = parent ? { kind: 'room', roll: parent.roll } : { kind: 'outside' };

  // First hallway cell: just outside the door, or the dungeon entrance
  const first =
    door && parent
      ? add(doorInsideCell(parent.rect, door.wall, door.offset), step)
      : startingPoint(dungeon);
  if (door) dungeon.cameThrough[record.id] = door.id;

  // Walk the hallway; it can run into an existing room or hallway
  const cells: Cell[] = [];
  for (let i = 0; i <= layout.hallway; i++) {
    const cell = add(first, step, i);
    const hitRoom = roomAt(dungeon, cell);
    if (hitRoom) {
      joinRoom(hitRoom, OPPOSITE[travel], cell, fromParent);
      if (door) door.leadsTo = { kind: 'room', roll: hitRoom.roll };
      if (cells.length > 0) dungeon.hallways.push({ roll, cells, deadEnd: false });
      dungeon.outcomes[record.id] = { kind: 'joined', joinedRoll: hitRoom.roll };
      return dungeon;
    }
    if (hallwayAt(dungeon, cell)) break;
    if (i < layout.hallway) cells.push(cell);
  }

  // The room starts where the hallway ends
  const start = add(first, step, cells.length);
  if (cells.length === layout.hallway && !hallwayAt(dungeon, start)) {
    for (const [width, length] of sizesToTry(layout.width, layout.length)) {
      for (const offset of offsetsToTry(width)) {
        const rect = roomRect(start, travel, width, length, offset);
        if (!fits(dungeon, rect, parent)) continue;

        const entranceWall = OPPOSITE[travel];
        const entrance: Door = {
          id: `${roll}-${entranceWall}${offsetOf(rect, entranceWall, start)}`,
          roll,
          wall: entranceWall,
          offset: offsetOf(rect, entranceWall, start),
          leadsTo: fromParent,
        };
        const room: PlacedRoom = {
          roll,
          recordId: record.id,
          rect,
          travel,
          rolled: { width: layout.width, length: layout.length },
          shrunk: width !== layout.width || length !== layout.length,
          entrance,
          exits: [],
        };
        placeExits(room, layout.exits.length, rng);
        dungeon.rooms.push(room);
        if (cells.length > 0) dungeon.hallways.push({ roll, cells, deadEnd: false });
        if (door) door.leadsTo = { kind: 'room', roll };
        dungeon.outcomes[record.id] = { kind: 'room', roll };
        return dungeon;
      }
    }
  }

  // Nowhere to go: the passage collapses
  dungeon.hallways.push({ roll, cells, deadEnd: true });
  if (door) door.leadsTo = { kind: 'dead-end' };
  dungeon.outcomes[record.id] = { kind: 'dead-end' };
  return dungeon;
}

/**
 * Rebuild the dungeon from the roll history. Each roll goes through the door
 * it recorded if that door is still unexplored; otherwise (older saves, or the
 * door was used) through the default next door, or as a new starting room.
 */
export function buildDungeon(history: RollRecord[]): Dungeon {
  const dungeon = emptyDungeon();
  history.forEach((record, index) => {
    const recorded = record.door ? findDoor(dungeon, record.door) : undefined;
    const door = recorded && recorded.leadsTo === undefined ? recorded : nextDoor(dungeon);
    addRoll(dungeon, record, index + 1, door);
  });
  return dungeon;
}

const WALL_NAMES: Record<Dir, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };

/**
 * Name of a door, e.g. "Room 3, north door". Doors sharing a wall are
 * numbered from the west (north and south walls) or north (east and west walls),
 * e.g. "Room 3, north door 2 (from west)", so every door has a unique name.
 */
export function describeDoor(dungeon: Dungeon, door: Door): string {
  const base = `Room ${door.roll}, ${WALL_NAMES[door.wall]} door`;
  const room = findRoom(dungeon, door.roll);
  if (!room) return base;
  const sameWall = [room.entrance, ...room.exits]
    .filter((d) => d.wall === door.wall)
    .sort((a, b) => a.offset - b.offset);
  if (sameWall.length < 2) return base;
  const from = door.wall === 'N' || door.wall === 'S' ? 'west' : 'north';
  return `${base} ${sameWall.indexOf(door) + 1} (from ${from})`;
}

/** Room size in feet as width x length, relative to the direction of travel */
export function roomSizeFeet(room: PlacedRoom): { width: number; length: number } {
  const sideways = room.travel === 'E' || room.travel === 'W';
  return {
    width: (sideways ? room.rect.h : room.rect.w) * 5,
    length: (sideways ? room.rect.w : room.rect.h) * 5,
  };
}

/** Plain-language summary of where a roll ended up on the map */
export function placementNotes(dungeon: Dungeon, record: RollRecord, roll: number): string[] {
  const notes: string[] = [];
  const doorId = dungeon.cameThrough[record.id];
  const door = doorId ? findDoor(dungeon, doorId) : undefined;
  notes.push(
    door ? `Through ${describeDoor(dungeon, door)}.` : 'Start of a new section of the dungeon.',
  );

  const outcome = dungeon.outcomes[record.id];
  if (outcome?.kind === 'joined') {
    notes.push(`The passage leads into Room ${outcome.joinedRoll}. No new room.`);
  } else if (outcome?.kind === 'dead-end') {
    notes.push('The passage collapses. Dead end, no new room.');
  } else {
    const room = findRoom(dungeon, roll);
    if (room?.shrunk) {
      const { width, length } = roomSizeFeet(room);
      notes.push(
        `Rolled ${room.rolled.width * 5}ft x ${room.rolled.length * 5}ft, but only ${width}ft x ${length}ft fits here.`,
      );
    }
  }
  return notes;
}
