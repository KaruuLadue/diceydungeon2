import { useState } from 'react';
import type { RollRecord } from '../core/roll';
import type { Settings } from '../core/settings';
import { RollCard } from './RollCard';
import { SettingsPanel } from './SettingsPanel';

interface Props {
  settings: Settings;
  history: RollRecord[];
  onSettingsChange: (settings: Settings) => void;
  onRoll: () => void;
  onReset: () => void;
  onExport: () => void;
}

export function RollPage({
  settings,
  history,
  onSettingsChange,
  onRoll,
  onReset,
  onExport,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  const handleReset = () => {
    if (history.length === 0) return;
    if (confirm('Clear the whole roll history?')) onReset();
  };

  return (
    <>
      <div className="controls">
        <button type="button" className="primary" onClick={onRoll}>
          Roll
        </button>
        <button type="button" onClick={handleReset} disabled={history.length === 0}>
          Reset
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

      <section className="history" aria-label="Roll history">
        {history.length === 0 ? (
          <p className="panel empty-state">
            Press <strong>Roll</strong> to generate your first room.
          </p>
        ) : (
          // Newest first, numbered in the order they were rolled
          history
            .map((record, index) => (
              <RollCard
                key={record.id}
                record={record}
                number={index + 1}
                highlightMatches={settings.highlightMatches}
                showRoomMap={settings.showRoomMaps}
              />
            ))
            .reverse()
        )}
      </section>
    </>
  );
}
