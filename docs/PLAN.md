# Dicey Dungeon 2 plan

## Decisions (2026-10-03)

- **Audience:** both solo players and game masters, solo-first. Solo features are optional, so a game master can use it as a plain generator.
- **Core idea:** a connected dungeon map. Rolling from an exit attaches a new room there, building a map you can scroll and zoom.
- **Stack:** Vite, React and TypeScript, deployed as a static site to GitHub Pages.
- **Repo:** this one. v1 stays live and unchanged at https://karuuladue.github.io/DiceyDungeon/.

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

| #   | Phase                    | Result                                                                                                   |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0   | Setup                    | Repo, tooling, CI, Pages deploy, placeholder page ✅                                                     |
| 1   | Game rules               | Seeded dice, Classic pack with effects, single-room generation, all tested (debug page only)             |
| 2   | Connected map (playable) | Click a door, a room attaches, pan and zoom, room details                                                |
| 3   | Saving and sharing       | Autosave, multiple dungeons, undo, export and import, share links by seed                                |
| 4   | Tables and packs         | Table editor with effects, 2–3 themed packs (crypt, sewer, derelict ship), v1 table import               |
| 5   | Solo layer               | Auto-journal and notes, visited and cleared states, optional tracker (HP, light, rations, keys), GM mode |
| 6   | Polish                   | Dice animation and sound, offline install, mobile layout, accessibility, Markdown and PNG export         |

Later ideas, not planned yet: stairs to multiple levels, non-rectangular rooms, furniture and hazard icons.

## Open questions

- **Classic rules.** The connected map changes what some dice mean compared with v1: exits get a random wall instead of always top, then left, then right, and the hallway follows the exit you clicked. Should Classic mode stay as close to v1 as possible?
- **D100.** v1 reads the D100 as a D10 for room length. Keep that, or use the full 1–100 range for something else?
