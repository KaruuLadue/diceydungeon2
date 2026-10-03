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
 *
 * Rules that keep the map growing:
 * - Every wall has at most one door.
 * - A door is only created where a room could be placed through it, and a new
 *   room or hallway may not take the space an unexplored door needs. So every
 *   unexplored door can always be explored.
 * - Rooms are tried at their rolled orientation and turned 90°, largest first.
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
  /** True if the room is smaller than rolled */
  shrunk: boolean;
  /** True if the room was turned 90° to fit */
  rotated: boolean;
  /** Hallway length the D4 asked for, and the length used */
  hallway: { rolled: number; actual: number };
  /** Number of extra exits the D6 asked for, and how many had room */
  exitsRolled: number;
  exitsPlaced: number;
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

/** Longest hallway the D4 can give, in squares */
export const MAX_HALLWAY = 4;

const STEP: Record<Dir, Cell> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };
const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

const add = (a: Cell, b: Cell, times = 1): Cell => ({ x: a.x + b.x * times, y: a.y + b.y * times });
const inRect = (c: Cell, r: Rect) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;

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

interface Size {
  width: number;
  length: number;
  /** Only possible by turning the rolled room 90° */
  rotated: boolean;
}

/**
 * Sizes to try, best first: largest area, then the rolled orientation before
 * the turned one, then the shape closest to the rolled one. So a room keeps
 * its full size by turning before it is made smaller.
 */
function sizesToTry(width: number, length: number): Size[] {
  const sizes = new Map<string, Size>();
  const consider = (w: number, l: number, rotated: boolean) => {
    const key = `${w}x${l}`;
    if (!sizes.has(key)) sizes.set(key, { width: w, length: l, rotated });
  };
  for (let w = 1; w <= width; w++) for (let l = 1; l <= length; l++) consider(w, l, false);
  for (let w = 1; w <= length; w++) for (let l = 1; l <= width; l++) consider(w, l, true);
  const shapeChange = (s: Size) =>
    Math.abs(s.width / s.length - (s.rotated ? length / width : width / length));
  return [...sizes.values()].sort(
    (a, b) =>
      b.width * b.length - a.width * a.length ||
      Number(a.rotated) - Number(b.rotated) ||
      shapeChange(a) - shapeChange(b),
  );
}

/** Entrance offsets to try, nearest the centre first */
function offsetsToTry(width: number): number[] {
  const centre = Math.floor(width / 2);
  return Array.from({ length: width }, (_, i) => i).sort(
    (a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b,
  );
}

/** Hallway lengths to try: the rolled one, then shorter, then longer */
function hallwaysToTry(rolled: number): number[] {
  const lengths = [];
  for (let h = rolled; h >= 0; h--) lengths.push(h);
  for (let h = rolled + 1; h <= MAX_HALLWAY; h++) lengths.push(h);
  return lengths;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
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

/**
 * Which room or hallway occupies each grid cell, for fast space checks.
 * Built fresh from the dungeon at the start of each roll, then kept in step
 * with the rooms and hallways that roll adds or tries out.
 */
class Occupancy {
  private rooms = new Map<number, PlacedRoom>();
  private hallways = new Map<number, number>();

  // Coordinates stay far below ±32768 squares
  private static key(c: Cell): number {
    return (c.x + 32768) * 65536 + (c.y + 32768);
  }

  constructor(dungeon: Dungeon) {
    dungeon.rooms.forEach((room) => this.addRoom(room));
    dungeon.hallways.forEach((h) => this.addCells(h.cells));
  }

  addRoom(room: PlacedRoom, present = true): void {
    const { x, y, w, h } = room.rect;
    for (let i = x; i < x + w; i++) {
      for (let j = y; j < y + h; j++) {
        const key = Occupancy.key({ x: i, y: j });
        if (present) this.rooms.set(key, room);
        else this.rooms.delete(key);
      }
    }
  }

  addCells(cells: Cell[], present = true): void {
    for (const cell of cells) {
      const key = Occupancy.key(cell);
      const count = (this.hallways.get(key) ?? 0) + (present ? 1 : -1);
      if (count > 0) this.hallways.set(key, count);
      else this.hallways.delete(key);
    }
  }

  roomAt(cell: Cell): PlacedRoom | undefined {
    return this.rooms.get(Occupancy.key(cell));
  }

  hallwayAt(cell: Cell): boolean {
    return this.hallways.has(Occupancy.key(cell));
  }

  isFree(cell: Cell): boolean {
    return !this.roomAt(cell) && !this.hallwayAt(cell);
  }
}

/**
 * A room fits if it overlaps no room or hallway and keeps a 1-square gap from
 * rooms other than its parent (which it may touch, through the door)
 */
function fits(occ: Occupancy, rect: Rect, parent: PlacedRoom | undefined): boolean {
  for (let x = rect.x - 1; x <= rect.x + rect.w; x++) {
    for (let y = rect.y - 1; y <= rect.y + rect.h; y++) {
      const inside = inRect({ x, y }, rect);
      const room = occ.roomAt({ x, y });
      if (room && (room !== parent || inside)) return false;
      if (inside && occ.hallwayAt({ x, y })) return false;
    }
  }
  return true;
}

/**
 * A door can be explored if, with some hallway length the D4 allows, the
 * hallway is clear and at least a 1-square room fits at its end.
 */
function doorIsViable(occ: Occupancy, room: PlacedRoom, wall: Dir, offset: number): boolean {
  const step = STEP[wall];
  const first = add(doorInsideCell(room.rect, wall, offset), step);
  for (let h = 0; h <= MAX_HALLWAY; h++) {
    const start = add(first, step, h);
    // Each longer hallway needs the previous room square as a clear hallway square
    if (!occ.isFree(start)) return false;
    if (fits(occ, roomRect(start, wall, 1, 1, 0), room)) return true;
  }
  return false;
}

/** Unexplored doors that could no longer be explored */
function blockedDoors(dungeon: Dungeon, occ: Occupancy, except?: Door): Door[] {
  return dungeon.rooms.flatMap((room) =>
    room.exits.filter(
      (door) =>
        door !== except &&
        door.leadsTo === undefined &&
        !doorIsViable(occ, room, door.wall, door.offset),
    ),
  );
}

/** Would adding this room (if any) and these hallway cells block any unexplored door? */
function wouldBlockDoors(
  dungeon: Dungeon,
  occ: Occupancy,
  room: PlacedRoom | undefined,
  cells: Cell[],
  except?: Door,
): boolean {
  if (room) occ.addRoom(room);
  occ.addCells(cells);
  const blocked = blockedDoors(dungeon, occ, except).length > 0;
  occ.addCells(cells, false);
  if (room) occ.addRoom(room, false);
  return blocked;
}

/** Extra exits: one per wall, never the entrance wall, only where a room could follow */
function placeExits(occ: Occupancy, room: PlacedRoom, count: number, rng: Rng): void {
  const walls = shuffled(
    DIRS.filter((dir) => dir !== room.entrance.wall),
    rng,
  );
  for (const wall of walls) {
    if (room.exits.length >= count) break;
    const offsets = shuffled(
      Array.from({ length: wallLength(room.rect, wall) }, (_, i) => i),
      rng,
    );
    const offset = offsets.find((o) => doorIsViable(occ, room, wall, o));
    if (offset !== undefined) {
      room.exits.push({ id: `${room.roll}-${wall}${offset}`, roll: room.roll, wall, offset });
    }
  }
}

/**
 * Join an existing room where a passage arrives, if that keeps one door per
 * wall: the wall has no door yet, or its door is unexplored and right here.
 */
function tryJoin(room: PlacedRoom, wall: Dir, cell: Cell, from: DoorTarget): boolean {
  const offset = offsetOf(room.rect, wall, cell);
  const onWall = [room.entrance, ...room.exits].find((d) => d.wall === wall);
  if (onWall) {
    if (onWall.offset !== offset || onWall.leadsTo !== undefined) return false;
    onWall.leadsTo = from;
    return true;
  }
  room.exits.push({
    id: `${room.roll}-${wall}${offset}`,
    roll: room.roll,
    wall,
    offset,
    leadsTo: from,
  });
  return true;
}

/** Start point for a room with no door to come through: the origin, or east of the map */
function startingPoint(dungeon: Dungeon): Cell {
  const bounds = dungeonBounds(dungeon);
  return bounds ? { x: bounds.x + bounds.w + 6, y: bounds.y + bounds.h - 1 } : { x: 0, y: 0 };
}

interface Placement {
  cells: Cell[];
  room: PlacedRoom;
}

/**
 * Find where the new room goes: hallway lengths from the rolled one outward,
 * and for each, sizes from best to worst (including turned 90°) and entrance
 * positions from the centre out. With `protectDoors`, skip spots that would
 * block another unexplored door.
 */
function findPlacement(
  dungeon: Dungeon,
  occ: Occupancy,
  first: Cell,
  travel: Dir,
  parent: PlacedRoom | undefined,
  door: Door | undefined,
  base: Omit<PlacedRoom, 'rect' | 'entrance' | 'shrunk' | 'rotated' | 'hallway'>,
  rolledHallway: number,
  protectDoors: boolean,
): Placement | null {
  const step = STEP[travel];
  const { width, length } = base.rolled;
  const sizes = sizesToTry(width, length);
  const entranceWall = OPPOSITE[travel];

  for (const h of hallwaysToTry(rolledHallway)) {
    const cells = Array.from({ length: h }, (_, i) => add(first, step, i));
    const start = add(first, step, h);
    if (!cells.every((c) => occ.isFree(c)) || !occ.isFree(start)) continue;
    for (const size of sizes) {
      for (const offset of offsetsToTry(size.width)) {
        const rect = roomRect(start, travel, size.width, size.length, offset);
        if (!fits(occ, rect, parent)) continue;
        const entranceOffset = offsetOf(rect, entranceWall, start);
        const room: PlacedRoom = {
          ...base,
          rect,
          shrunk: size.width * size.length < width * length,
          rotated: size.rotated,
          hallway: { rolled: rolledHallway, actual: h },
          entrance: {
            id: `${base.roll}-${entranceWall}${entranceOffset}`,
            roll: base.roll,
            wall: entranceWall,
            offset: entranceOffset,
            leadsTo: parent ? { kind: 'room', roll: parent.roll } : { kind: 'outside' },
          },
        };
        if (protectDoors && wouldBlockDoors(dungeon, occ, room, cells, door)) continue;
        return { cells, room };
      }
    }
  }
  return null;
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
  const occ = new Occupancy(dungeon);

  // A passage at its rolled length that runs into a room can lead into it
  for (let i = 0; i <= layout.hallway; i++) {
    const cell = add(first, step, i);
    if (occ.hallwayAt(cell)) break;
    const hitRoom = occ.roomAt(cell);
    if (!hitRoom) continue;
    const cells = Array.from({ length: i }, (_, k) => add(first, step, k));
    const wall = OPPOSITE[travel];
    const joinedDoorIsFree = !wouldBlockDoors(dungeon, occ, undefined, cells, door);
    if (joinedDoorIsFree && tryJoin(hitRoom, wall, cell, fromParent)) {
      if (door) door.leadsTo = { kind: 'room', roll: hitRoom.roll };
      if (cells.length > 0) dungeon.hallways.push({ roll, cells, deadEnd: false });
      dungeon.outcomes[record.id] = { kind: 'joined', joinedRoll: hitRoom.roll };
      return dungeon;
    }
    break;
  }

  const base = {
    roll,
    recordId: record.id,
    travel,
    rolled: { width: layout.width, length: layout.length },
    exitsRolled: layout.exits.length,
    exitsPlaced: 0,
    exits: [],
  };
  // Prefer spots that leave every other door usable; if none, take any spot and
  // drop the unexplored doors it blocks, so no door ever leads nowhere
  const placement =
    findPlacement(dungeon, occ, first, travel, parent, door, base, layout.hallway, true) ??
    findPlacement(dungeon, occ, first, travel, parent, door, base, layout.hallway, false);

  if (placement) {
    const { cells, room } = placement;
    dungeon.rooms.push(room);
    occ.addRoom(room);
    if (cells.length > 0) dungeon.hallways.push({ roll, cells, deadEnd: false });
    occ.addCells(cells);
    if (door) door.leadsTo = { kind: 'room', roll };
    for (const blocked of blockedDoors(dungeon, occ)) {
      const owner = findRoom(dungeon, blocked.roll);
      if (owner) owner.exits = owner.exits.filter((d) => d !== blocked);
    }
    placeExits(occ, room, layout.exits.length, rng);
    room.exitsPlaced = room.exits.length;
    dungeon.outcomes[record.id] = { kind: 'room', roll };
    return dungeon;
  }

  // Nowhere to go (only possible for doors from older maps): the passage collapses
  const cells: Cell[] = [];
  for (let i = 0; i < layout.hallway && occ.isFree(add(first, step, i)); i++) {
    cells.push(add(first, step, i));
  }
  dungeon.hallways.push({ roll, cells, deadEnd: true });
  if (door) door.leadsTo = { kind: 'dead-end' };
  dungeon.outcomes[record.id] = { kind: 'dead-end' };
  return dungeon;
}

/**
 * Add a roll through the door it recorded if that door is still unexplored;
 * otherwise (older saves, or the door was used) through the default next
 * door, or as a new starting room. Mutates the dungeon.
 */
function replayRoll(dungeon: Dungeon, record: RollRecord, roll: number): void {
  const recorded = record.door ? findDoor(dungeon, record.door) : undefined;
  const door = recorded && recorded.leadsTo === undefined ? recorded : nextDoor(dungeon);
  addRoll(dungeon, record, roll, door);
}

/** Rebuild the dungeon from the whole roll history */
export function buildDungeon(history: RollRecord[]): Dungeon {
  const dungeon = emptyDungeon();
  history.forEach((record, index) => replayRoll(dungeon, record, index + 1));
  return dungeon;
}

/**
 * A copy of the dungeon with one more roll added, the same as rebuilding
 * from the history with that roll on the end, but without replaying it all
 */
export function extendDungeon(dungeon: Dungeon, record: RollRecord, roll: number): Dungeon {
  const next = structuredClone(dungeon);
  replayRoll(next, record, roll);
  return next;
}

const WALL_NAMES: Record<Dir, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };

/** Name of a door, e.g. "Room 3, north door" (each wall has at most one door) */
export function describeDoor(door: Door): string {
  return `Room ${door.roll}, ${WALL_NAMES[door.wall]} door`;
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
  notes.push(door ? `Through ${describeDoor(door)}.` : 'Start of a new section of the dungeon.');

  const outcome = dungeon.outcomes[record.id];
  if (outcome?.kind === 'joined') {
    notes.push(`The passage leads into Room ${outcome.joinedRoll}. No new room.`);
    return notes;
  }
  if (outcome?.kind === 'dead-end') {
    notes.push('The passage collapses. Dead end, no new room.');
    return notes;
  }
  const room = findRoom(dungeon, roll);
  if (!room) return notes;
  const { width, length } = roomSizeFeet(room);
  const rolled = `${room.rolled.width * 5}ft x ${room.rolled.length * 5}ft`;
  if (room.shrunk) {
    notes.push(`Rolled ${rolled}, but only ${width}ft x ${length}ft fits here.`);
  } else if (room.rotated) {
    notes.push(`Turned sideways to fit: ${width}ft x ${length}ft instead of ${rolled}.`);
  }
  const { rolled: rolledHall, actual } = room.hallway;
  if (actual !== rolledHall) {
    const squares = (n: number) => `${n} ${n === 1 ? 'square' : 'squares'}`;
    notes.push(
      actual === 0
        ? `No hallway (rolled ${squares(rolledHall)}) so the room fits.`
        : `Hallway is ${squares(actual)} instead of ${squares(rolledHall)} so the room fits.`,
    );
  }
  if (room.exitsPlaced < room.exitsRolled) {
    notes.push(
      room.exitsPlaced === 0
        ? `No room for exits here (rolled ${room.exitsRolled}).`
        : `Only ${room.exitsPlaced} of ${room.exitsRolled} exits have room here.`,
    );
  }
  return notes;
}

/** Whether a room could still be placed through this door */
export function canExplore(dungeon: Dungeon, door: Door): boolean {
  const room = findRoom(dungeon, door.roll);
  return room !== undefined && doorIsViable(new Occupancy(dungeon), room, door.wall, door.offset);
}
