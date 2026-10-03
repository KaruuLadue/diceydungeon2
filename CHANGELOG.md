# Changelog

All notable changes to Dicey Dungeon 2 are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
