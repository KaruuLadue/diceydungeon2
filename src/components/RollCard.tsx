import { findRoom, placementNotes, type Dungeon } from '../core/dungeon';
import { extraLabel, matchingValues, orderedResults, type RollRecord } from '../core/roll';
import { DieIcon } from './DieIcon';
import { RoomMap } from './RoomMap';

interface Props {
  record: RollRecord;
  number: number;
  dungeon: Dungeon;
  highlightMatches: boolean;
  showRoomMap: boolean;
  selected?: boolean;
}

export function RollCard({
  record,
  number,
  dungeon,
  highlightMatches,
  showRoomMap,
  selected,
}: Props) {
  const matches = highlightMatches ? matchingValues(record) : new Set<number>();
  const results = orderedResults(record);
  const room = findRoom(dungeon, number);
  const hallway = dungeon.hallways.find((h) => h.roll === number);

  return (
    <article
      className={selected ? 'roll-card selected' : 'roll-card'}
      aria-labelledby={`roll-${record.id}`}
    >
      <h2 id={`roll-${record.id}`} className="roll-title">
        Roll {number}
      </h2>
      {results.length === 0 ? (
        <p className="muted">No dice were enabled for this roll.</p>
      ) : (
        <ul className="result-list">
          {results.map(([die, result]) => (
            <li
              key={die}
              className={matches.has(result.value) ? 'result-line match' : 'result-line'}
              data-die={die}
            >
              <DieIcon die={die} />
              <span>
                {die}: {result.value} {result.description && `(${result.description})`}
              </span>
            </li>
          ))}
          {record.extra?.map((extra, index) => (
            <li key={`extra-${index}`} className="result-line extra" data-die={extra.die}>
              <span className="extra-arrow" aria-hidden="true">
                ↳
              </span>
              <DieIcon die={extra.die} />
              <span>
                {extraLabel(extra)}: {extra.value} {extra.description && `(${extra.description})`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="placement-notes">
        {placementNotes(dungeon, record, number).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      {showRoomMap && room && <RoomMap room={room} hallway={hallway} />}
    </article>
  );
}
