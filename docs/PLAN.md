# Dicey Dungeon 2 plan

## Decisions (2026-10-03)

- **Audience:** both solo players and game masters, solo-first. Solo features are optional, so a game master can use it as a plain generator.
- **Core idea:** a connected dungeon map. Rolling from an exit attaches a new room there, building a map you can scroll and zoom.
- **Stack:** Vite, React and TypeScript, deployed as a static site to GitHub Pages.
- **Repo:** this one. v1 stays live and unchanged at https://karuuladue.github.io/DiceyDungeon/.
- **Exits on the map:** placed on random walls, with the hallway following the door you clicked. The single-room view keeps v1’s top, left, right order.
- **D100:** stays a D10 for room length (5–50ft), as in v1.
- **Licence:** MIT, for both v1 and v2.

## How it plays

You start with an entrance room. Each exit is an unexplored door. Click a door, roll, and a hallway and a new room attach to the map. Rooms you've visited and doors still unexplored are marked. Solo players also get a journal and an optional tracker; a game master can switch those off.

## Architecture

### Game rules (`src/core`, plain TypeScript, no React or DOM)

- **Seeded random numbers.** The same seed always produces the same dungeon, which makes share links and tests repeatable.
- **Table packs.** A pack is a JSON file of tables. v1's tables become the "Classic" pack. Each entry has text and can also have effects, such as `reroll: [D8, D12]`, `addExits: 1` or `doubleHostiles`. This is how v1's "roll again" entries finally work.
- **Dungeon model.** Rooms sit on a 5ft grid. Each exit has a wall and position, and links to the room behind it once explored.
- **Placing new rooms.** Hallway length comes from the D4. If the new room would overlap an existing one, try a smaller room or shift it along the wall. If that fails, the hallway joins the room it hit (creating a loop) or ends at a collapsed passage.
- **Saving.** The save format has a version number with upgrade steps. Saves export and import as files. v1 custom tables can be imported.

### Interface (React)

- SVG map with pan and zoom: sharp at any zoom, easy to click, exports cleanly.
- Details panel for the selected room, journal, table editor and settings.

### Tooling

- Vitest for the game rules, Playwright for a browser smoke test.
- oxlint and Prettier.
- GitHub Actions checks pull requests and deploys `main` to Pages. The version is stamped at build time; no commits back to the repo.

## Phases

Each phase ends with something deployed.

| #   | Phase                    | Result                                                                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 0   | Setup                    | Repo, tooling, CI, Pages deploy, placeholder page ✅                                                                       |
| 1   | Match v1                 | Everything v1 does, with v1's rules: tables, rolling, room drawings, settings, history, export, table editor, v1 import ✅ |
| 2   | Table effects            | Entries can roll other dice again ("roll again", "Roll D8 and D12 again"), editable per entry ✅                           |
| 3   | Connected map (playable) | Click a door, a room attaches, pan and zoom, room details                                                                  |
| 4   | Saving and sharing       | Multiple dungeons, undo, export and import of whole dungeons, share links by seed                                          |
| 5   | Packs                    | 2–3 themed packs (crypt, sewer, derelict ship), choosing a pack per dungeon                                                |
| 6   | Solo layer               | Auto-journal and notes, visited and cleared states, optional tracker (HP, light, rations, keys), GM mode                   |
| 7   | Polish                   | Dice animation, offline install, accessibility pass, Markdown and PNG export                                               |

Phase 1 was moved ahead of the connected map on 2026-10-03 so v2 reaches feature parity with v1 before adding new features.

Later ideas, not planned yet: stairs to multiple levels, non-rectangular rooms, furniture and hazard icons.
