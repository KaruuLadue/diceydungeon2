import { DICE } from '../core/dice';
import { DIE_INFO } from '../core/tables';
import { DieIcon } from './DieIcon';

export function HelpPage() {
  return (
    <>
      <div className="controls">
        <a className="button" href="#/">
          Back to Rolling
        </a>
      </div>

      <section className="panel prose">
        <h2>What is Dicey Dungeon?</h2>
        <p>
          Dicey Dungeon generates dungeon rooms with a full set of polyhedral dice. Each roll gives
          you a hallway, a room size, exits, an encounter, a room type and a twist, along with a
          drawing of the room. Use it to prepare a dungeon quickly when you're running the game, or
          to explore a dungeon on your own.
        </p>
        <p>
          Dicey Dungeon 2 is being rebuilt so that rooms connect into a map you explore door by
          door. For now it works like the original.
        </p>
      </section>

      <section className="panel prose">
        <h2>How to play</h2>
        <ol>
          <li>
            Press <strong>Roll</strong>. Every active die is rolled and looked up in its table.
          </li>
          <li>
            Walk the hallway, enter the room and resolve the encounter, room type and modifier.
          </li>
          <li>Pick an exit and roll again for the next room.</li>
          <li>
            Use <strong>Export Log</strong> to download your roll history as a text file, and{' '}
            <strong>Reset</strong> to start a new dungeon.
          </li>
        </ol>
        <p>
          When two dice show the same number, those results are highlighted. Treat matches as a sign
          that something extra is going on, such as a second encounter.
        </p>
      </section>

      <section className="panel prose">
        <h2>Table effects</h2>
        <p>
          Some entries tell you to roll again. When one comes up, those dice are rolled for you and
          listed under the roll as, for example, <em>“D8 again (from D20)”</em>. In the default
          tables:
        </p>
        <ul>
          <li>
            <strong>D20 7, False Safety</strong> rolls the D20 again.
          </li>
          <li>
            <strong>D20 20, Chaotic Event</strong> rolls the D8 and D12 again.
          </li>
        </ul>
        <p>
          Add effects to your own entries with the <strong>Effect</strong> button in{' '}
          <strong>Edit Tables</strong>. Extra rolls can trigger their own effects, up to six per
          roll. Dice you've switched off are never rolled, and you can turn effects off in{' '}
          <strong>Settings</strong>.
        </p>
      </section>

      <section className="panel prose">
        <h2>The dice</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Die</th>
              <th scope="col">Decides</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {DICE.map((die) => (
              <tr key={die}>
                <td>
                  <span className="die-cell">
                    <DieIcon die={die} /> {die}
                  </span>
                </td>
                <td>{DIE_INFO[die].label}</td>
                <td>{DIE_INFO[die].hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Switch dice off in <strong>Settings</strong> to leave those results out. Change what each
          result means in <strong>Edit Tables</strong>.
        </p>
      </section>

      <section className="panel prose">
        <h2>Reading the room drawing</h2>
        <ul>
          <li>Each grid square is 5ft × 5ft. The room size is shown above the drawing.</li>
          <li>The hallway leads into the room from below. A D4 of 1 means there's no hallway.</li>
          <li>The gold triangle marks where you enter the room.</li>
          <li>White bars are doors: one at each end of the hallway, plus the extra exits.</li>
        </ul>
      </section>
    </>
  );
}
