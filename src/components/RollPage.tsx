import { useState } from 'react';
import { describeDoor, nextDoor, unexploredDoors, type Door, type Dungeon } from '../core/dungeon';
import type { RollRecord } from '../core/roll';
import type { Settings } from '../core/settings';
import { DungeonMap } from './DungeonMap';
import { RollCard } from './RollCard';
import { SettingsPanel } from './SettingsPanel';

export type RollView = 'map' | 'rooms';

interface Props {
  view: RollView;
  settings: Settings;
  history: RollRecord[];
  dungeon: Dungeon;
  canRedo: boolean;
  onSettingsChange: (settings: Settings) => void;
  /** Roll through a door, or through the default next door when omitted */
  onRoll: (door?: Door) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export function RollPage({
  view,
  settings,
  history,
  dungeon,
  canRedo,
  onSettingsChange,
  onRoll,
  onUndo,
  onRedo,
  onExport,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);
  // A choice of room only lasts until the next roll, which is then selected
  const [choice, setChoice] = useState<{ roll: number; atLength: number } | null>(null);
  const selectedRoll =
    choice && choice.atLength === history.length ? choice.roll : history.length || null;
  const setSelectedRoll = (roll: number) => setChoice({ roll, atLength: history.length });

  const next = nextDoor(dungeon);
  const doors = unexploredDoors(dungeon);
  const selectedRecord = selectedRoll ? history[selectedRoll - 1] : undefined;

  const card = (record: RollRecord, number: number) => (
    <RollCard
      key={record.id}
      record={record}
      number={number}
      dungeon={dungeon}
      highlightMatches={settings.highlightMatches}
      showRoomMap={settings.showRoomMaps}
    />
  );

  return (
    <>
      <div className="controls">
        <button type="button" className="primary" onClick={() => onRoll()}>
          Roll
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={history.length === 0}
          aria-keyshortcuts="Control+Z"
        >
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-keyshortcuts="Control+Y">
          Redo
        </button>
        <button type="button" onClick={onExport} disabled={history.length === 0}>
          Export Log
        </button>
        <a className="button" href="#/tables">
          Edit Tables
        </a>
        <button
          type="button"
          aria-expanded={showSettings}
          aria-controls="settings-panel"
          onClick={() => setShowSettings((open) => !open)}
        >
          Settings
        </button>
      </div>

      {showSettings && <SettingsPanel settings={settings} onChange={onSettingsChange} />}

      {history.length === 0 ? (
        <p className="panel empty-state">
          Press <strong>Roll</strong> to place the entrance room of a new dungeon.
        </p>
      ) : (
        <>
          <nav className="view-tabs" aria-label="View">
            <a href="#/" aria-current={view === 'map' ? 'page' : undefined}>
              Map
            </a>
            <a href="#/rooms" aria-current={view === 'rooms' ? 'page' : undefined}>
              Rooms ({history.length})
            </a>
          </nav>

          <p className="next-door-hint">
            {next ? (
              <>
                <strong>Roll</strong> explores {describeDoor(next)}.{' '}
                {view === 'map' && 'Click any gold door to explore it instead.'}
              </>
            ) : (
              <>
                No unexplored doors. <strong>Roll</strong> starts a new section of the dungeon.
              </>
            )}
          </p>

          {view === 'map' ? (
            <div className="map-layout">
              <DungeonMap
                dungeon={dungeon}
                selectedRoll={selectedRoll}
                nextDoorId={next?.id}
                onSelectRoom={setSelectedRoll}
                onExplore={onRoll}
              />
              <aside className="map-side" aria-label="Room details">
                {selectedRecord && selectedRoll && card(selectedRecord, selectedRoll)}
                {doors.length > 0 && (
                  <section className="panel door-list">
                    <h2>Unexplored doors ({doors.length})</h2>
                    <ul>
                      {doors.map((door) => (
                        <li key={door.id}>
                          <button type="button" onClick={() => onRoll(door)}>
                            Explore {describeDoor(door)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          ) : (
            <section className="history" aria-label="Roll history">
              {/* Newest first, numbered in the order they were rolled */}
              {history.map((record, index) => card(record, index + 1)).reverse()}
            </section>
          )}
        </>
      )}
    </>
  );
}
