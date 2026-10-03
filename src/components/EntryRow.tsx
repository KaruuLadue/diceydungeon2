import { useState } from 'react';
import { DICE, type Die } from '../core/dice';
import { describeEffect, type Entry } from '../core/tables';

interface Props {
  die: Die;
  index: number;
  entry: Entry;
  onChange: (entry: Entry) => void;
  /** Omitted for dice without random entries */
  onRandomize?: () => void;
}

/** One table entry: its text, optional randomize button and effect editor */
export function EntryRow({ die, index, entry, onChange, onRandomize }: Props) {
  const [showEffect, setShowEffect] = useState(false);
  const id = `${die}-${index}`;
  const effect = describeEffect(entry);

  const toggleReroll = (target: Die) => {
    const current = entry.reroll ?? [];
    const reroll = current.includes(target)
      ? current.filter((d) => d !== target)
      : DICE.filter((d) => d === target || current.includes(d));
    const { reroll: _, ...rest } = entry;
    onChange(reroll.length > 0 ? { ...rest, reroll } : rest);
  };

  return (
    <li className="entry-row">
      <div className="entry-main">
        <label htmlFor={id}>{index + 1}</label>
        <input
          id={id}
          type="text"
          value={entry.text}
          aria-invalid={entry.text.trim() === ''}
          onChange={(event) => onChange({ ...entry, text: event.target.value })}
        />
        {onRandomize && (
          <button
            type="button"
            className="icon-button"
            aria-label={`Randomize ${die} entry ${index + 1}`}
            onClick={onRandomize}
          >
            🎲
          </button>
        )}
        <button
          type="button"
          className={effect ? 'effect-button has-effect' : 'effect-button'}
          aria-expanded={showEffect}
          aria-controls={`${id}-effect`}
          aria-label={`Effect for ${die} entry ${index + 1}${effect ? `: ${effect}` : ''}`}
          onClick={() => setShowEffect((open) => !open)}
        >
          {effect ? `↻ ${entry.reroll!.join(' ')}` : 'Effect'}
        </button>
      </div>
      {showEffect && (
        <fieldset id={`${id}-effect`} className="effect-editor">
          <legend>When this comes up, also roll:</legend>
          {DICE.map((target) => (
            <label key={target}>
              <input
                type="checkbox"
                checked={entry.reroll?.includes(target) ?? false}
                onChange={() => toggleReroll(target)}
              />
              {target}
            </label>
          ))}
        </fieldset>
      )}
    </li>
  );
}
