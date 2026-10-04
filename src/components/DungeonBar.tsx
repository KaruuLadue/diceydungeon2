import { useRef, type ChangeEvent } from 'react';
import type { Library } from '../core/library';

interface Props {
  library: Library;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

const rollCount = (n: number) => `${n} ${n === 1 ? 'roll' : 'rolls'}`;

export function DungeonBar({
  library,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onShare,
  onExport,
  onImport,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImport(file);
  };

  return (
    <section className="dungeon-bar" aria-label="Dungeons">
      <div className="dungeon-select">
        <label htmlFor="dungeon-select">Dungeon</label>
        <select
          id="dungeon-select"
          value={library.current}
          onChange={(event) => onSwitch(event.target.value)}
        >
          {library.dungeons.map((dungeon) => (
            <option key={dungeon.id} value={dungeon.id}>
              {dungeon.name} ({rollCount(dungeon.history.length)})
            </option>
          ))}
        </select>
      </div>
      <div className="dungeon-actions">
        <button type="button" onClick={onNew}>
          New
        </button>
        <button type="button" onClick={onRename}>
          Rename
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
        <button type="button" onClick={onShare}>
          Share Link
        </button>
        <button type="button" onClick={onExport}>
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
          onChange={importFile}
          data-testid="dungeon-import-input"
        />
      </div>
    </section>
  );
}
