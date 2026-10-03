import { roomLayout } from '../core/layout';
import { matchingValues, orderedResults, type RollRecord } from '../core/roll';
import { DieIcon } from './DieIcon';
import { RoomMap } from './RoomMap';

interface Props {
  record: RollRecord;
  number: number;
  highlightMatches: boolean;
  showRoomMap: boolean;
}

export function RollCard({ record, number, highlightMatches, showRoomMap }: Props) {
  const matches = highlightMatches ? matchingValues(record) : new Set<number>();
  const results = orderedResults(record);

  return (
    <article className="roll-card" aria-labelledby={`roll-${record.id}`}>
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
        </ul>
      )}
      {showRoomMap && <RoomMap layout={roomLayout(record)} />}
    </article>
  );
}
