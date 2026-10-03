import { roomSizeFeet, type Hallway, type PlacedRoom } from '../core/dungeon';
import { CELL, DoorShape, EntranceMark, HallwayShape, RoomShape } from './mapShapes';

const PAD = CELL * 1.5;
const TITLE_HEIGHT = 40;
const LEGEND_HEIGHT = 44;
const MIN_WIDTH = 360;

interface Props {
  room: PlacedRoom;
  hallway?: Hallway;
}

/**
 * One room as it sits on the map: grid, the hallway that led to it, the
 * entrance triangle and every door. Map north is up.
 */
export function RoomMap({ room, hallway }: Props) {
  const cells = [room.rect, ...(hallway?.cells.map((c) => ({ x: c.x, y: c.y, w: 1, h: 1 })) ?? [])];
  const minX = Math.min(...cells.map((r) => r.x));
  const minY = Math.min(...cells.map((r) => r.y));
  const maxX = Math.max(...cells.map((r) => r.x + r.w));
  const maxY = Math.max(...cells.map((r) => r.y + r.h));

  const contentWidth = (maxX - minX) * CELL + PAD * 2;
  const width = Math.max(MIN_WIDTH, contentWidth);
  const height = TITLE_HEIGHT + (maxY - minY) * CELL + PAD * 2 + LEGEND_HEIGHT;
  // Shift so the content is centred horizontally below the title
  const offsetX = (width - (maxX - minX) * CELL) / 2 - minX * CELL;
  const offsetY = TITLE_HEIGHT + PAD - minY * CELL;

  const { width: widthFt, length: lengthFt } = roomSizeFeet(room);
  const exits = room.exits.length;
  const description =
    `Room ${room.roll}: ${widthFt}ft wide by ${lengthFt}ft long with ` +
    `${exits} other ${exits === 1 ? 'door' : 'doors'}.`;
  const legendX = width / 2 - 135;
  const legendY = height - LEGEND_HEIGHT / 2;

  return (
    <svg
      className="room-map"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      role="img"
      aria-label={description}
    >
      <rect className="map-background" width={width} height={height} rx={6} />
      <text className="map-title" x={width / 2} y={TITLE_HEIGHT * 0.7}>
        Room Size: {widthFt}ft x {lengthFt}ft
      </text>
      <g transform={`translate(${offsetX} ${offsetY})`}>
        {hallway && <HallwayShape hallway={hallway} />}
        <RoomShape room={room} label={false} />
        <EntranceMark room={room} />
        {[room.entrance, ...room.exits].map((door) => (
          <DoorShape key={door.id} room={room} door={door} />
        ))}
      </g>
      <g className="map-legend" aria-hidden="true">
        <polygon
          className="map-entrance"
          points={`${legendX + 7},${legendY - 7} ${legendX},${legendY + 6} ${legendX + 14},${legendY + 6}`}
        />
        <text x={legendX + 22} y={legendY}>
          Entrance
        </text>
        <rect className="map-door" x={legendX + 110} y={legendY - 4} width={20} height={7} />
        <text x={legendX + 136} y={legendY}>
          Door
        </text>
        <rect
          className="map-door unexplored"
          x={legendX + 190}
          y={legendY - 4}
          width={20}
          height={7}
        />
        <text x={legendX + 216} y={legendY}>
          New
        </text>
      </g>
    </svg>
  );
}
