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
        <p>In Dicey Dungeon 2 the rooms connect into a map that you explore door by door.</p>
      </section>

      <section className="panel prose">
        <h2>How to play</h2>
        <ol>
          <li>
            Press <strong>Roll</strong> to place the entrance room. Every active die is rolled and
            looked up in its table.
          </li>
          <li>
            Walk the hallway, enter the room and resolve the encounter, room type and modifier.
          </li>
          <li>
            Click a gold door on the map to explore it: the next room is rolled and attached there.
            Or press <strong>Roll</strong> to explore the door it names.
          </li>
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
        <h2>The map</h2>
        <ul>
          <li>Each grid square is 5ft × 5ft, and north is up. Rooms are numbered by roll.</li>
          <li>
            Drag to move around. Zoom with the mouse wheel or the <strong>+</strong> and{' '}
            <strong>−</strong> buttons, and press <strong>Fit</strong> to see the whole dungeon.
          </li>
          <li>
            White bars are doors you've been through. Gold bars with a circle are unexplored doors;
            the pulsing one is where <strong>Roll</strong> goes next. You can also explore doors
            from the list beside the map.
          </li>
          <li>Click a room to see its rolls. The Rooms tab lists every roll.</li>
          <li>The gold triangle marks where you enter a room, and the dungeon's entrance.</li>
        </ul>
        <h3>How rooms are placed</h3>
        <ul>
          <li>
            The hallway runs straight out of the door for the D4's length (none on a 1), and the new
            room is centred on its end. Extra exits go on random walls.
          </li>
          <li>
            Rooms never overlap. If the rolled room doesn't fit, it's shifted sideways or made
            smaller, and its card says so.
          </li>
          <li>
            If a hallway runs into another room, it leads into that room instead. If it hits another
            hallway or no room fits at all, the passage collapses: a red ✕ marks the dead end.
          </li>
          <li>
            When every door is explored, <strong>Roll</strong> starts a new section of the dungeon
            beside the map.
          </li>
        </ul>
      </section>
    </>
  );
}
