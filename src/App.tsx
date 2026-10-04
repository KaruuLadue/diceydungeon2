import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/logo.png';
import { DungeonBar } from './components/DungeonBar';
import { HelpPage } from './components/HelpPage';
import { RollPage, type RollView } from './components/RollPage';
import { TablesPage } from './components/TablesPage';
import { Toast, type Notify, type ToastMessage } from './components/Toast';
import { buildDungeon, extendDungeon, nextDoor, placementNotes, type Door } from './core/dungeon';
import {
  addDungeon,
  currentDungeon,
  defaultName,
  newDungeon,
  removeDungeon,
  uniqueName,
  updateCurrent,
  type SavedDungeon,
} from './core/library';
import { historyToText, rollRoom, type RollRecord } from './core/roll';
import { randomSeed, rollSeed } from './core/rng';
import type { Settings } from './core/settings';
import { decodeShareLink, dungeonToFile, encodeShareLink, parseDungeonFile } from './core/share';
import {
  browserStore,
  loadLibrary,
  loadSettings,
  loadTables,
  loadV1Tables,
  saveLibrary,
  saveSettings,
  saveTables,
} from './core/storage';
import type { TableSet } from './core/tables';
import { downloadFile } from './lib/download';
import { playRollSound } from './lib/sound';

type Route = RollView | 'tables' | 'help';

const SHARE_PREFIX = '#/share/';

function routeFromHash(): Route {
  if (location.hash === '#/tables') return 'tables';
  if (location.hash === '#/help') return 'help';
  if (location.hash === '#/rooms') return 'rooms';
  return 'map';
}

function useRoute(): Route {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** A file name from a dungeon name, e.g. "The Sunken Crypt" -> "the-sunken-crypt" */
function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'dungeon';
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function App() {
  const store = useMemo(() => browserStore(), []);
  const route = useRoute();
  const [settings, setSettings] = useState(() => loadSettings(store));
  const [library, setLibrary] = useState(() => loadLibrary(store, randomSeed()));
  const [tables, setTables] = useState(() => loadTables(store));
  const v1Tables = useMemo(() => loadV1Tables(store), [store]);
  const current = currentDungeon(library);
  const history = current.history;
  // Rolls taken back by Undo, newest last, for the dungeon they came from
  const [redo, setRedo] = useState<{ id: string; records: RollRecord[] }>({ id: '', records: [] });
  const redoRecords = redo.id === current.id ? redo.records : [];

  // The map is rebuilt from the roll history, so it never needs saving. A new
  // roll extends the map; anything else (undo, switching dungeon) rebuilds it.
  const [built, setBuilt] = useState(() => ({ history, dungeon: buildDungeon(history) }));
  let dungeon = built.dungeon;
  if (built.history !== history) {
    const extended =
      history.length === built.history.length + 1 &&
      built.history.every((record, i) => record === history[i]);
    dungeon = extended
      ? extendDungeon(built.dungeon, history[history.length - 1] as RollRecord, history.length)
      : buildDungeon(history);
    setBuilt({ history, dungeon });
  }

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const notify: Notify = useCallback((message, kind = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const saveFailed = useCallback(
    () => notify('Couldn’t save to this browser. Storage may be full.', 'error'),
    [notify],
  );

  // Save the dungeons whenever they change. The first save also moves a
  // history saved before there were multiple dungeons into the list.
  useEffect(() => {
    // Writing to storage is the external system here; the toast only shows on failure
    // oxlint-disable-next-line react/set-state-in-effect
    if (!saveLibrary(store, library)) saveFailed();
  }, [store, library, saveFailed]);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    if (!saveSettings(store, next)) saveFailed();
  };

  const updateTables = (next: TableSet) => {
    setTables(next);
    if (!saveTables(store, next)) saveFailed();
  };

  const setHistory = (next: RollRecord[]) => setLibrary(updateCurrent(library, { history: next }));

  const roll = (door: Door | undefined = nextDoor(dungeon)) => {
    if (settings.soundEnabled) playRollSound();
    const seed = rollSeed(current.seed, history.length + 1);
    const record: RollRecord = {
      ...rollRoom(tables, settings.enabledDice, seed, { applyEffects: settings.applyEffects }),
      ...(door && { door: door.id }),
    };
    setHistory([...history, record]);
    setRedo({ id: current.id, records: [] });
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setRedo({ id: current.id, records: [...redoRecords, last] });
  };

  const redoRoll = () => {
    const record = redoRecords[redoRecords.length - 1];
    if (!record) return;
    setHistory([...history, record]);
    setRedo({ id: current.id, records: redoRecords.slice(0, -1) });
  };

  // Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y, on the rolling pages
  const shortcuts = useRef({ undo, redo: redoRoll });
  useEffect(() => {
    shortcuts.current = { undo, redo: redoRoll };
  });
  const onRollPage = route === 'map' || route === 'rooms';
  useEffect(() => {
    if (!onRollPage) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) shortcuts.current.undo();
      else if (key === 'z' || key === 'y') shortcuts.current.redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRollPage]);

  const add = useCallback(
    (saved: SavedDungeon) =>
      setLibrary((lib) => addDungeon(lib, { ...saved, name: uniqueName(lib, saved.name) })),
    [],
  );

  const createDungeon = () => {
    const name = prompt('Name the new dungeon:', defaultName(library));
    if (name === null) return;
    add(newDungeon(name.trim() || defaultName(library), randomSeed()));
  };

  const renameDungeon = () => {
    const name = prompt('Rename this dungeon:', current.name)?.trim();
    if (!name || name === current.name) return;
    setLibrary(updateCurrent(library, { name: uniqueName(library, name) }));
  };

  const deleteDungeon = () => {
    if (!confirm(`Delete “${current.name}” and all its rolls? This can’t be undone.`)) return;
    setLibrary(removeDungeon(library, current.id, randomSeed()));
  };

  const switchDungeon = (id: string) => setLibrary({ ...library, current: id });

  const exportDungeon = () =>
    downloadFile(
      `${fileSlug(current.name)}.dungeon.json`,
      dungeonToFile(current),
      'application/json',
    );

  const importDungeon = async (file: File) => {
    const result = parseDungeonFile(await file.text());
    if (!result.ok) return notify(`Couldn't import: ${result.error}`, 'error');
    add(result.dungeon);
    notify(`Imported “${result.dungeon.name}”.`);
  };

  const shareDungeon = async () => {
    const payload = await encodeShareLink(current, tables);
    const link = `${location.origin}${location.pathname}${SHARE_PREFIX}${payload}`;
    try {
      await navigator.clipboard.writeText(link);
      notify('Share link copied. Anyone who opens it gets their own copy of this dungeon.');
    } catch {
      prompt('Copy this link to share the dungeon:', link);
    }
  };

  // Opening a share link adds the dungeon it carries and switches to it
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    const open = async () => {
      if (!location.hash.startsWith(SHARE_PREFIX)) return;
      const payload = location.hash.slice(SHARE_PREFIX.length);
      location.replace('#/');
      // Effects run twice in development; open each link once
      if (openedLink.current === payload) return;
      openedLink.current = payload;
      const result = await decodeShareLink(payload);
      if (!result.ok) return notify(`Couldn't open the link: ${result.error}`, 'error');
      add(result.dungeon);
      notify(`Opened the shared dungeon “${result.dungeon.name}”.`);
    };
    void open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [add, notify]);

  const exportLog = () =>
    downloadFile(
      'roll_history.txt',
      historyToText(history, (record, n) => placementNotes(dungeon, record, n)),
    );

  return (
    <div className="app">
      <header className="app-header">
        <a href="#/" aria-label="Dicey Dungeon 2 home">
          <img src={logo} alt="Dicey Dungeon" className="logo" />
        </a>
        <p className="subtitle">Dicey Dungeon 2</p>
      </header>

      <main>
        {onRollPage && (
          <>
            <DungeonBar
              library={library}
              onSwitch={switchDungeon}
              onNew={createDungeon}
              onRename={renameDungeon}
              onDelete={deleteDungeon}
              onShare={shareDungeon}
              onExport={exportDungeon}
              onImport={importDungeon}
            />
            <RollPage
              // A fresh page (selected room, map view) for each dungeon
              key={current.id}
              view={route}
              dungeon={dungeon}
              settings={settings}
              history={history}
              canRedo={redoRecords.length > 0}
              onSettingsChange={updateSettings}
              onRoll={roll}
              onUndo={undo}
              onRedo={redoRoll}
              onExport={exportLog}
            />
          </>
        )}
        {route === 'tables' && (
          <TablesPage tables={tables} v1Tables={v1Tables} onSave={updateTables} notify={notify} />
        )}
        {route === 'help' && <HelpPage />}
      </main>

      <footer className="app-footer">
        <nav>
          <a href="#/help">Instructions</a>
          <span aria-hidden="true"> · </span>
          <a href="https://karuuladue.github.io/DiceyDungeon/">Dicey Dungeon 1</a>
        </nav>
        <p>
          Version {__APP_VERSION__} ({__APP_COMMIT__})
        </p>
      </footer>

      <Toast toast={toast} />
    </div>
  );
}
