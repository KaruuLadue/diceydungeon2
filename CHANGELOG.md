# Changelog

All notable changes to Dicey Dungeon 2 are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-10-03

Smarter room placement, so the map can always keep growing.

### Changed

- Every wall has at most one door: the entrance has its own wall and each extra exit gets a different wall. A passage only joins a room on a wall with no door (or straight into that wall's unexplored door)
- Extra exits are only created where a room could be placed through them. A room with no space on a wall gets fewer exits, and its card says so
- New rooms and hallways never take the space an unexplored door needs, so every gold door can always be explored
- Rooms are tried turned 90° when that lets them keep their full size, before being made smaller. The card says when a room was turned
- If the rolled hallway length leaves no space for a room, the hallway is made shorter or longer (within the D4's range), and the card says so
- Collapsed passages no longer happen in new dungeons (in testing: none in 4,500 rolls)
- Placement is about 7× faster, and each roll extends the map instead of rebuilding it
- Existing histories are rebuilt with the new rules, so older maps will look different

## [0.4.0] - 2026-10-03

The connected dungeon map.

### Added

- Map tab: each roll attaches a hallway and room to the door it explored, building a dungeon you can drag, zoom and fit to the screen
- Click a gold door on the map, or use the list beside it, to explore that door; Roll explores the newest room's first unexplored door and says which
- Extra exits go on random walls
- Rooms never overlap: a room that doesn't fit is shifted along the wall or made smaller (largest size that fits first), and its card says so
- Hallways that run into a room lead into it (making loops); hallways that hit another hallway, or have no space for a room, collapse into a dead end
- When every door is explored, Roll starts a new section of the dungeon beside the map
- Clicking a room on the map shows its rolls; the Rooms tab lists every roll
- Room cards show the room as placed on the map and which door the roll came through
- Export Log includes where each roll went on the map
- Instructions for the map

### Changed

- The map is rebuilt from the roll history (each roll records its door), so it survives reloads and older histories still load
- Room card drawings use the map's orientation (north up) instead of always putting the entrance at the bottom

## [0.3.0] - 2026-10-03

Table effects: entries that say "roll again" now do.

### Added

- Table entries can roll other dice again. Extra results appear under the roll, labelled with their cause (e.g. "D8 again (from D20)"), and are included in Export Log
- Classic tables: D20 7 (False Safety) rolls the D20 again; D20 20 (Chaotic Event) rolls the D8 and D12 again
- Effect editor on every entry in Edit Tables
- Settings switch to turn table effects off
- Instructions section on table effects

### Changed

- Tables are saved and exported with effects. Older table files and saves (plain text entries, including v1's) still load
- Extra rolls can trigger their own effects, up to six per roll; dice switched off in Settings are never rolled
- MIT licence (was GPL v3)

## [0.2.0] - 2026-10-03

Everything Dicey Dungeon 1 does, rebuilt with v1's rules.

### Added

- Rolling all seven dice against the Classic tables (v1's tables; the D100 reads as a D10 for room length)
- Room drawings as sharp SVG: grid, hallway, entrance, exits and legend, using v1's layout rules
- Roll history that survives reloads, numbered in order, with Reset and Export Log (v1's text format)
- Highlighting of matching numbers within a roll
- Settings: match highlighting, sound, room drawings and turning individual dice on or off, all remembered
- Table editor: edit, restore defaults, randomize (D8, D12, D20), save one table or all, with unsaved-change markers and empty-entry checks
- Export and import of tables as JSON, with validation
- One-click loading of custom tables saved by Dicey Dungeon 1 in the same browser
- Instructions page
- Saved data is versioned so future format changes can upgrade it safely
- Unit tests for the game rules and storage; browser tests for every feature above

## [0.1.0] - 2026-10-03

### Added

- Project setup: Vite, React, TypeScript (strict), oxlint, Prettier
- Seeded random number generator and dice rolling, with unit tests
- Placeholder page with a Roll button, styled like v1
- Browser smoke test (Playwright)
- GitHub Actions workflow that checks every pull request and deploys `main` to GitHub Pages
