import { useState } from 'react';
import { DICE, rollAll, type Die } from './core/dice';
import { createRng, randomSeed } from './core/rng';
import logo from './assets/logo.png';

const diceIcons = import.meta.glob<string>('./assets/dice/*.png', {
  eager: true,
  import: 'default',
});
const iconFor = (die: Die) => diceIcons[`./assets/dice/${die}.png`];

interface Roll {
  seed: number;
  results: Record<Die, number>;
}

export default function App() {
  const [lastRoll, setLastRoll] = useState<Roll | null>(null);

  const handleRoll = () => {
    const seed = randomSeed();
    setLastRoll({ seed, results: rollAll(createRng(seed)) });
  };

  return (
    <main className="app">
      <img src={logo} alt="Dicey Dungeon" className="logo" />
      <h1>Dicey Dungeon 2</h1>
      <p className="tagline">
        A dungeon that grows as you roll. Under construction. In the meantime, try the{' '}
        <a href="https://karuuladue.github.io/DiceyDungeon/">original Dicey Dungeon</a>.
      </p>

      <button type="button" onClick={handleRoll}>
        Roll
      </button>

      {lastRoll && (
        <section className="roll" aria-label="Roll results">
          <ul>
            {DICE.map((die) => (
              <li key={die} data-testid={`result-${die}`}>
                <img src={iconFor(die)} alt="" className="die-icon" />
                <span>
                  {die}: {lastRoll.results[die]}
                </span>
              </li>
            ))}
          </ul>
          <p className="seed">Seed {lastRoll.seed}</p>
        </section>
      )}

      <footer>
        Version {__APP_VERSION__} ({__APP_COMMIT__})
      </footer>
    </main>
  );
}
