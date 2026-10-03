import type { KeyboardEvent } from 'react';
import type { Cell, Door, Hallway, PlacedRoom } from '../core/dungeon';

/** Pixels per 5ft square in map drawings */
export const CELL = 24;
const DOOR_THICKNESS = 0.3;
const DOOR_INSET = 0.15;

/** Grid lines inside a rectangle of cells */
function gridPath(x: number, y: number, w: number, h: number): string {
  let d = '';
  for (let i = 1; i < w; i++) d += `M${(x + i) * CELL},${y * CELL}v${h * CELL}`;
  for (let i = 1; i < h; i++) d += `M${x * CELL},${(y + i) * CELL}h${w * CELL}`;
  return d;
}

export function RoomShape({
  room,
  selected = false,
  label = true,
}: {
  room: PlacedRoom;
  selected?: boolean;
  label?: boolean;
}) {
  const { x, y, w, h } = room.rect;
  return (
    <g className={selected ? 'map-room selected' : 'map-room'}>
      <rect className="map-floor" x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
      <path className="map-gridline" d={gridPath(x, y, w, h)} />
      <rect className="map-wall" x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
      {label && (
        <text className="map-room-label" x={(x + w / 2) * CELL} y={(y + h / 2) * CELL}>
          {room.roll}
        </text>
      )}
    </g>
  );
}

/** Hallway cells as a floor strip with walls along its sides */
export function HallwayShape({ hallway }: { hallway: Hallway }) {
  if (hallway.cells.length === 0) return <DeadEndMark hallway={hallway} />;
  const xs = hallway.cells.map((c) => c.x);
  const ys = hallway.cells.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x + 1;
  const h = Math.max(...ys) - y + 1;
  return (
    <g className="map-hallway">
      <rect className="map-floor" x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
      <path className="map-gridline" d={gridPath(x, y, w, h)} />
      <rect className="map-wall" x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
      {hallway.deadEnd && <DeadEndMark hallway={hallway} />}
    </g>
  );
}

/** A red cross at the end of a collapsed passage */
function DeadEndMark({ hallway }: { hallway: Hallway }) {
  const end: Cell | undefined = hallway.cells[hallway.cells.length - 1];
  if (!end) return null;
  const cx = (end.x + 0.5) * CELL;
  const cy = (end.y + 0.5) * CELL;
  const r = CELL * 0.3;
  return (
    <path
      className="map-dead-end"
      d={`M${cx - r},${cy - r}L${cx + r},${cy + r}M${cx + r},${cy - r}L${cx - r},${cy + r}`}
    >
      <title>Collapsed passage</title>
    </path>
  );
}

/** Door rectangle geometry in pixels, centred on the wall line */
function doorBox(room: PlacedRoom, door: Door) {
  const { x, y, w, h } = room.rect;
  const along = (door.offset + DOOR_INSET) * CELL;
  const length = (1 - DOOR_INSET * 2) * CELL;
  const thick = DOOR_THICKNESS * CELL;
  switch (door.wall) {
    case 'N':
      return { x: x * CELL + along, y: y * CELL - thick / 2, width: length, height: thick };
    case 'S':
      return { x: x * CELL + along, y: (y + h) * CELL - thick / 2, width: length, height: thick };
    case 'W':
      return { x: x * CELL - thick / 2, y: y * CELL + along, width: thick, height: length };
    case 'E':
      return { x: (x + w) * CELL - thick / 2, y: y * CELL + along, width: thick, height: length };
  }
}

/** Centre of the square just outside a door, where its hit target goes */
function outsideCentre(room: PlacedRoom, door: Door): { cx: number; cy: number } {
  const box = doorBox(room, door);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const half = CELL / 2;
  switch (door.wall) {
    case 'N':
      return { cx, cy: cy - half };
    case 'S':
      return { cx, cy: cy + half };
    case 'W':
      return { cx: cx - half, cy };
    case 'E':
      return { cx: cx + half, cy };
  }
}

interface DoorProps {
  room: PlacedRoom;
  door: Door;
  /** Highlight as the door the Roll button will explore */
  isNext?: boolean;
  /** Makes unexplored doors clickable */
  onExplore?: (door: Door) => void;
  /** Door name for clickable doors, e.g. "Room 3, north door" */
  name?: string;
}

export function DoorShape({ room, door, isNext = false, onExplore, name }: DoorProps) {
  const box = doorBox(room, door);
  const unexplored = door.leadsTo === undefined;
  if (!unexplored || !onExplore) {
    const className = unexplored ? 'map-door unexplored' : 'map-door';
    return <rect className={className} {...box} />;
  }

  const { cx, cy } = outsideCentre(room, door);
  const label = `Explore ${name ?? `Room ${door.roll} door`}`;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onExplore(door);
    }
  };
  return (
    <g
      className={isNext ? 'map-door-button next' : 'map-door-button'}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-door={door.id}
      onClick={() => onExplore(door)}
      onKeyDown={onKeyDown}
    >
      <title>{label}</title>
      <circle className="map-door-target" cx={cx} cy={cy} r={CELL * 0.6} />
      <circle className="map-door-halo" cx={cx} cy={cy} r={CELL * 0.32} />
      <rect className="map-door unexplored" {...box} />
    </g>
  );
}

/** Gold triangle in the square inside the dungeon's entrance */
export function EntranceMark({ room }: { room: PlacedRoom }) {
  const box = doorBox(room, room.entrance);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const s = CELL * 0.28;
  // Point into the room
  const points = {
    N: `${cx},${cy + s * 2.2} ${cx - s},${cy + s * 0.6} ${cx + s},${cy + s * 0.6}`,
    S: `${cx},${cy - s * 2.2} ${cx - s},${cy - s * 0.6} ${cx + s},${cy - s * 0.6}`,
    W: `${cx + s * 2.2},${cy} ${cx + s * 0.6},${cy - s} ${cx + s * 0.6},${cy + s}`,
    E: `${cx - s * 2.2},${cy} ${cx - s * 0.6},${cy - s} ${cx - s * 0.6},${cy + s}`,
  }[room.entrance.wall];
  return <polygon className="map-entrance" points={points} />;
}
