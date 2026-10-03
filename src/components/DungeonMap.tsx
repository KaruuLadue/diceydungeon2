import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { describeDoor, dungeonBounds, type Door, type Dungeon } from '../core/dungeon';
import { CELL, DoorShape, EntranceMark, HallwayShape, RoomShape } from './mapShapes';

interface Props {
  dungeon: Dungeon;
  selectedRoll: number | null;
  nextDoorId: string | undefined;
  onSelectRoom: (roll: number) => void;
  onExplore: (door: Door) => void;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const FIT_PADDING = CELL * 2;
/** Pointer movement (px) before a press becomes a drag instead of a click */
const DRAG_THRESHOLD = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DungeonMap({ dungeon, selectedRoll, nextDoorId, onSelectRoom, onExplore }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Null until the map has been fitted to its container for the first time
  const [view, setView] = useState<View | null>(null);
  const [seenRooms, setSeenRooms] = useState(dungeon.rooms.length);
  const drag = useRef<{ startX: number; startY: number; view: View; dragging: boolean } | null>(
    null,
  );

  // Track the container size
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitView = useCallback((): View | null => {
    const bounds = dungeonBounds(dungeon);
    if (!bounds || size.width === 0) return null;
    const w = bounds.w * CELL + FIT_PADDING * 2;
    const h = bounds.h * CELL + FIT_PADDING * 2;
    const scale = clamp(Math.min(size.width / w, size.height / h), MIN_SCALE, 1.5);
    return {
      scale,
      x: size.width / 2 - (bounds.x + bounds.w / 2) * CELL * scale,
      y: size.height / 2 - (bounds.y + bounds.h / 2) * CELL * scale,
    };
  }, [dungeon, size]);

  /** Pan so the newest room is on screen, keeping the zoom */
  const showNewest = (current: View): View => {
    const newest = dungeon.rooms[dungeon.rooms.length - 1];
    if (!newest) return current;
    const { x, y, w, h } = newest.rect;
    const s = current.scale;
    const margin = CELL * s;
    const visible =
      x * CELL * s + current.x >= margin &&
      y * CELL * s + current.y >= margin &&
      (x + w) * CELL * s + current.x <= size.width - margin &&
      (y + h) * CELL * s + current.y <= size.height - margin;
    if (visible) return current;
    return {
      ...current,
      x: size.width / 2 - (x + w / 2) * CELL * s,
      y: size.height / 2 - (y + h / 2) * CELL * s,
    };
  };

  // Adjust the view during render (React's pattern for state that depends on
  // changed props): fit once the size is known, then follow new rooms
  let shown = view;
  if (shown === null && size.width > 0) {
    shown = fitView();
    if (shown) setView(shown);
  }
  if (dungeon.rooms.length !== seenRooms) {
    setSeenRooms(dungeon.rooms.length);
    if (shown) {
      const panned = showNewest(shown);
      if (panned !== shown) {
        shown = panned;
        setView(panned);
      }
    }
  }
  const current: View = shown ?? { x: 0, y: 0, scale: 1 };

  const fit = () => setView(fitView());

  const zoomAt = (factor: number, px = size.width / 2, py = size.height / 2) =>
    setView((previous) => {
      const from = previous ?? current;
      const scale = clamp(from.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = scale / from.scale;
      return { scale, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio };
    });

  // Wheel zoom needs a non-passive listener to stop the page scrolling
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - box.left, event.clientY - box.top);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, view: current, dragging: false };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Capture only once dragging, so plain clicks still reach doors and rooms
      state.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setView({ ...state.view, x: state.view.x + dx, y: state.view.y + dy });
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.dragging) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      // Swallow the click that follows a drag
      const swallow = (e: Event) => e.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag.current = null;
  };

  return (
    <div className="dungeon-map">
      <div className="map-toolbar" role="toolbar" aria-label="Map view">
        <button type="button" onClick={() => zoomAt(1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={fit}>
          Fit
        </button>
      </div>
      <div ref={container} className="map-viewport">
        <svg
          className="map-svg"
          width={size.width}
          height={size.height}
          role="group"
          aria-label="Dungeon map. Drag to pan, scroll or use the buttons to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <g transform={`translate(${current.x} ${current.y}) scale(${current.scale})`}>
            {dungeon.hallways.map((hallway, i) => (
              <HallwayShape key={`h${i}`} hallway={hallway} />
            ))}
            {dungeon.rooms.map((room) => (
              <g
                key={room.roll}
                className="map-room-hit"
                onClick={() => onSelectRoom(room.roll)}
                data-room={room.roll}
              >
                <RoomShape room={room} selected={room.roll === selectedRoll} />
              </g>
            ))}
            {dungeon.rooms.map((room) => (
              <g key={`doors-${room.roll}`}>
                {room.entrance.leadsTo?.kind === 'outside' && <EntranceMark room={room} />}
                {[room.entrance, ...room.exits].map((door) => (
                  <DoorShape
                    key={door.id}
                    room={room}
                    door={door}
                    isNext={door.id === nextDoorId}
                    onExplore={onExplore}
                    name={describeDoor(dungeon, door)}
                  />
                ))}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
