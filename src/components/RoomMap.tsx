import type { RoomLayout } from '../core/layout';

const CELL = 40;
const PAD = 40;
const TITLE_HEIGHT = 40;
const LEGEND_HEIGHT = 50;
const MIN_WIDTH = 400;
const DOOR_THICKNESS = 10;
const DOOR_INSET = 5;

interface Props {
  layout: RoomLayout;
}

/** Door bar centred on a horizontal wall line */
function HorizontalDoor({ x, y }: { x: number; y: number }) {
  return (
    <rect
      className="map-door"
      x={x + DOOR_INSET}
      y={y - DOOR_THICKNESS / 2}
      width={CELL - DOOR_INSET * 2}
      height={DOOR_THICKNESS}
    />
  );
}

/** Door bar centred on a vertical wall line */
function VerticalDoor({ x, y }: { x: number; y: number }) {
  return (
    <rect
      className="map-door"
      x={x - DOOR_THICKNESS / 2}
      y={y + DOOR_INSET}
      width={DOOR_THICKNESS}
      height={CELL - DOOR_INSET * 2}
    />
  );
}

function GridLines({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) {
  const d = [
    ...Array.from({ length: cols - 1 }, (_, i) => {
      const lx = x + (i + 1) * CELL;
      return `M${lx},${y}V${y + rows * CELL}`;
    }),
    ...Array.from({ length: rows - 1 }, (_, i) => {
      const ly = y + (i + 1) * CELL;
      return `M${x},${ly}H${x + cols * CELL}`;
    }),
  ].join('');
  return d ? <path className="map-gridline" d={d} /> : null;
}

/**
 * Top-down drawing of one room: the grid, the hallway leading in from below,
 * the entrance and the extra exits. Uses v1's layout rules (see roomLayout).
 */
export function RoomMap({ layout }: Props) {
  const { width, length, hallway, exits } = layout;
  const gridWidth = width * CELL;
  const svgWidth = Math.max(MIN_WIDTH, gridWidth + PAD * 2);
  const svgHeight = TITLE_HEIGHT + PAD + (length + hallway) * CELL + PAD + LEGEND_HEIGHT;

  const gridX = (svgWidth - gridWidth) / 2;
  const gridY = TITLE_HEIGHT + PAD;
  const roomBottom = gridY + length * CELL;
  const entranceX = gridX + Math.floor(width / 2) * CELL;
  const middleRowY = gridY + Math.floor(length / 2) * CELL;

  const exitWord = exits.length === 1 ? 'exit' : 'exits';
  const description =
    `Room ${width * 5}ft wide by ${length * 5}ft long with ${exits.length} extra ${exitWord}` +
    (hallway === 0
      ? ', entered directly through a door.'
      : `, reached by a ${hallway}-square hallway.`);

  // Entrance triangle sits in the room's bottom cell above the entrance door
  const triangleSize = CELL * 0.5;
  const triangleCx = entranceX + CELL / 2;
  const triangleBase = roomBottom - CELL * 0.2;
  const triangle = `${triangleCx},${triangleBase - triangleSize * 0.87} ${triangleCx - triangleSize / 2},${triangleBase} ${triangleCx + triangleSize / 2},${triangleBase}`;

  const legendY = svgHeight - LEGEND_HEIGHT / 2;
  const legendX = svgWidth / 2 - 95;

  return (
    <svg
      className="room-map"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth}
      role="img"
      aria-label={description}
    >
      <rect className="map-background" width={svgWidth} height={svgHeight} rx={6} />

      <text className="map-title" x={svgWidth / 2} y={TITLE_HEIGHT}>
        Room Size: {width * 5}ft x {length * 5}ft
      </text>

      {/* Room */}
      <rect className="map-floor" x={gridX} y={gridY} width={gridWidth} height={length * CELL} />
      <GridLines x={gridX} y={gridY} cols={width} rows={length} />
      <rect className="map-wall" x={gridX} y={gridY} width={gridWidth} height={length * CELL} />

      {/* Hallway */}
      {hallway > 0 && (
        <>
          <rect
            className="map-floor"
            x={entranceX}
            y={roomBottom}
            width={CELL}
            height={hallway * CELL}
          />
          <GridLines x={entranceX} y={roomBottom} cols={1} rows={hallway} />
          <rect
            className="map-wall"
            x={entranceX}
            y={roomBottom}
            width={CELL}
            height={hallway * CELL}
          />
          <HorizontalDoor x={entranceX} y={roomBottom + hallway * CELL} />
        </>
      )}
      <HorizontalDoor x={entranceX} y={roomBottom} />
      <polygon className="map-entrance" points={triangle} />

      {/* Extra exits */}
      {exits.map((wall) => {
        if (wall === 'top') return <HorizontalDoor key={wall} x={entranceX} y={gridY} />;
        if (wall === 'left') return <VerticalDoor key={wall} x={gridX} y={middleRowY} />;
        return <VerticalDoor key={wall} x={gridX + gridWidth} y={middleRowY} />;
      })}

      {/* Legend */}
      <g className="map-legend" aria-hidden="true">
        <polygon
          className="map-entrance"
          points={`${legendX + 8},${legendY - 8} ${legendX},${legendY + 6} ${legendX + 16},${legendY + 6}`}
        />
        <text x={legendX + 26} y={legendY}>
          Entrance
        </text>
        <rect className="map-door" x={legendX + 125} y={legendY - 4} width={22} height={8} />
        <text x={legendX + 155} y={legendY}>
          Exit
        </text>
      </g>
    </svg>
  );
}
