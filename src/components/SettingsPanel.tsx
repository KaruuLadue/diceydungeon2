import { DICE } from '../core/dice';
import type { Settings } from '../core/settings';
import { DIE_INFO } from '../core/tables';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const toggle = (key: 'highlightMatches' | 'soundEnabled' | 'showRoomMaps' | 'applyEffects') =>
    onChange({ ...settings, [key]: !settings[key] });

  return (
    <section id="settings-panel" className="panel settings-panel" aria-label="Settings">
      <fieldset>
        <legend>Features</legend>
        <label>
          <input
            type="checkbox"
            checked={settings.highlightMatches}
            onChange={() => toggle('highlightMatches')}
          />
          Highlight matching rolls
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={() => toggle('soundEnabled')}
          />
          Sound
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.showRoomMaps}
            onChange={() => toggle('showRoomMaps')}
          />
          Room drawings
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.applyEffects}
            onChange={() => toggle('applyEffects')}
          />
          Table effects (roll again)
        </label>
      </fieldset>

      <fieldset>
        <legend>Active dice</legend>
        <div className="dice-toggles">
          {DICE.map((die) => (
            <label key={die}>
              <input
                type="checkbox"
                checked={settings.enabledDice[die]}
                onChange={() =>
                  onChange({
                    ...settings,
                    enabledDice: { ...settings.enabledDice, [die]: !settings.enabledDice[die] },
                  })
                }
              />
              {die} ({DIE_INFO[die].label})
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
