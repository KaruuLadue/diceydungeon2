import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/logo.png';
import { HelpPage } from './components/HelpPage';
import { RollPage, type RollView } from './components/RollPage';
import { TablesPage } from './components/TablesPage';
import { Toast, type Notify, type ToastMessage } from './components/Toast';
import { buildDungeon, nextDoor, placementNotes, type Door } from './core/dungeon';
import { historyToText, rollRoom, type RollRecord } from './core/roll';
import { randomSeed } from './core/rng';
import type { Settings } from './core/settings';
import {
  browserStore,
  loadHistory,
  loadSettings,
  loadTables,
  loadV1Tables,
  saveHistory,
  saveSettings,
  saveTables,
} from './core/storage';
import type { TableSet } from './core/tables';
import { downloadFile } from './lib/download';
import { playRollSound } from './lib/sound';

type Route = RollView | 'tables' | 'help';

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

export default function App() {
  const store = useMemo(() => browserStore(), []);
  const route = useRoute();
  const [settings, setSettings] = useState(() => loadSettings(store));
  const [history, setHistory] = useState(() => loadHistory(store));
  const [tables, setTables] = useState(() => loadTables(store));
  const v1Tables = useMemo(() => loadV1Tables(store), [store]);
  // The map is rebuilt from the roll history, so it never needs saving separately
  const dungeon = useMemo(() => buildDungeon(history), [history]);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const notify: Notify = useCallback((message, kind = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const saveFailed = () => notify('Couldn’t save to this browser. Storage may be full.', 'error');

  const updateSettings = (next: Settings) => {
    setSettings(next);
    if (!saveSettings(store, next)) saveFailed();
  };

  const updateHistory = (next: RollRecord[]) => {
    setHistory(next);
    if (!saveHistory(store, next)) saveFailed();
  };

  const updateTables = (next: TableSet) => {
    setTables(next);
    if (!saveTables(store, next)) saveFailed();
  };

  const roll = (door: Door | undefined = nextDoor(dungeon)) => {
    if (settings.soundEnabled) playRollSound();
    const record: RollRecord = {
      ...rollRoom(tables, settings.enabledDice, randomSeed(), {
        applyEffects: settings.applyEffects,
      }),
      ...(door && { door: door.id }),
    };
    updateHistory([...history, record]);
  };

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
        {(route === 'map' || route === 'rooms') && (
          <RollPage
            view={route}
            dungeon={dungeon}
            settings={settings}
            history={history}
            onSettingsChange={updateSettings}
            onRoll={roll}
            onReset={() => updateHistory([])}
            onExport={exportLog}
          />
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
