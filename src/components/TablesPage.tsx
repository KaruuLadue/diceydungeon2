import { useRef, useState, type ChangeEvent } from 'react';
import { DICE, type Die } from '../core/dice';
import { canRandomize, randomEntry } from '../core/generators';
import { createRng, randomSeed } from '../core/rng';
import {
  CLASSIC_TABLES,
  DIE_INFO,
  findEmptyEntry,
  parseTablesFile,
  sameTable,
  type Entry,
  type TableSet,
} from '../core/tables';
import { downloadFile } from '../lib/download';
import { DieIcon } from './DieIcon';
import { EntryRow } from './EntryRow';
import type { Notify } from './Toast';

interface Props {
  tables: TableSet;
  v1Tables: TableSet | null;
  onSave: (tables: TableSet) => void;
  notify: Notify;
}

const trimmed = (entries: Entry[]): Entry[] =>
  entries.map((entry) => ({ ...entry, text: entry.text.trim() }));

export function TablesPage({ tables, v1Tables, onSave, notify }: Props) {
  // Edits stay in this draft until saved
  const [draft, setDraft] = useState<TableSet>(tables);
  const fileInput = useRef<HTMLInputElement>(null);

  const setEntry = (die: Die, index: number, entry: Entry) =>
    setDraft((current) => ({
      ...current,
      [die]: current[die].map((existing, i) => (i === index ? entry : existing)),
    }));

  const setTable = (die: Die, entries: Entry[]) =>
    setDraft((current) => ({ ...current, [die]: entries }));

  // Random entries replace the text and clear any effect
  const randomize = (die: Die, index?: number) => {
    const rng = createRng(randomSeed());
    setDraft((current) => ({
      ...current,
      [die]: current[die].map((entry, i) =>
        index === undefined || i === index ? { text: randomEntry(die, rng) } : entry,
      ),
    }));
  };

  const saveTable = (die: Die) => {
    const problem = findEmptyEntry(die, draft[die]);
    if (problem) return notify(problem, 'error');
    const next = { ...tables, [die]: trimmed(draft[die]) };
    onSave(next);
    setTable(die, next[die]);
    notify(`${die} table saved.`);
  };

  const saveAll = () => {
    for (const die of DICE) {
      const problem = findEmptyEntry(die, draft[die]);
      if (problem) return notify(problem, 'error');
    }
    const next = Object.fromEntries(DICE.map((die) => [die, trimmed(draft[die])])) as TableSet;
    onSave(next);
    setDraft(next);
    notify('All tables saved.');
  };

  const exportTables = () => {
    downloadFile('dicey_dungeon_tables.json', JSON.stringify(tables, null, 2), 'application/json');
    notify('Saved tables exported.');
  };

  const importTables = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = parseTablesFile(await file.text());
    if (!result.ok) return notify(`Couldn't import: ${result.error}`, 'error');
    if (!confirm('Replace all your tables with the imported ones?')) return;
    onSave(result.tables);
    setDraft(result.tables);
    notify('Tables imported.');
  };

  const loadV1 = () => {
    if (!v1Tables) return;
    setDraft(v1Tables);
    notify('Loaded your Dicey Dungeon 1 tables. Save to keep them.');
  };

  const unsavedCount = DICE.filter((die) => !sameTable(draft[die], tables[die])).length;

  return (
    <>
      <div className="controls sticky-controls">
        <a className="button" href="#/">
          Back to Rolling
        </a>
        <button type="button" className="primary" onClick={saveAll}>
          Save All
        </button>
        <button type="button" onClick={exportTables}>
          Export
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importTables}
          data-testid="import-input"
        />
      </div>

      <p className="panel muted">
        Edit what each roll means. Use <strong>Effect</strong> to make an entry roll other dice
        again when it comes up. Changes are kept in this browser once saved.
        {unsavedCount > 0 && (
          <strong className="unsaved">
            {' '}
            {unsavedCount} {unsavedCount === 1 ? 'table has' : 'tables have'} unsaved changes.
          </strong>
        )}
      </p>

      {v1Tables && (
        <p className="panel v1-import">
          Found custom tables from Dicey Dungeon 1 in this browser.{' '}
          <button type="button" onClick={loadV1}>
            Load them
          </button>
        </p>
      )}

      {DICE.map((die) => {
        const dirty = !sameTable(draft[die], tables[die]);
        return (
          <section key={die} className="panel table-section" aria-labelledby={`table-${die}`}>
            <header className="table-header">
              <h2 id={`table-${die}`}>
                <DieIcon die={die} /> {die}: {DIE_INFO[die].label}
                {dirty && <span className="unsaved-tag">unsaved</span>}
              </h2>
              <div className="table-buttons">
                <button type="button" onClick={() => setTable(die, CLASSIC_TABLES[die])}>
                  Defaults
                </button>
                {canRandomize(die) && (
                  <button type="button" onClick={() => randomize(die)}>
                    Randomize
                  </button>
                )}
                <button type="button" className="primary" onClick={() => saveTable(die)}>
                  Save Table
                </button>
              </div>
            </header>
            <p className="muted">{DIE_INFO[die].hint}</p>
            <ol className="entry-list">
              {draft[die].map((entry, index) => (
                <EntryRow
                  key={index}
                  die={die}
                  index={index}
                  entry={entry}
                  onChange={(next) => setEntry(die, index, next)}
                  onRandomize={canRandomize(die) ? () => randomize(die, index) : undefined}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </>
  );
}
