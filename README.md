# Dicey Dungeon 2

A dungeon generator that builds a connected map as you roll. Start in an entrance room, pick an unexplored door, roll, and a hallway and new room attach to the map. Play it solo as a dungeon crawl with a journal and tracker, or switch those off and use it as a quick generator when you're running the game.

**Live site:** https://karuuladue.github.io/DiceyDungeon2/ (under construction)

The original Dicey Dungeon is still available at https://karuuladue.github.io/DiceyDungeon/.

## Status

Early development. See [docs/PLAN.md](docs/PLAN.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for what has shipped.

## Development

Requires Node.js 24 or later.

```sh
git clone https://github.com/KaruuLadue/DiceyDungeon2.git
cd DiceyDungeon2
npm install
npm run dev
```

> Keep the project folder outside Google Drive, OneDrive or similar sync folders. npm installs fail on Google Drive's virtual drive.

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `npm run dev`     | Start the dev server with hot reload                               |
| `npm run build`   | Type-check and build the static site into `dist/`                  |
| `npm run preview` | Serve the built site locally                                       |
| `npm test`        | Run unit tests (Vitest)                                            |
| `npm run e2e`     | Build, serve and run browser tests (Playwright, uses local Chrome) |
| `npm run check`   | Type-check, lint, format check and unit tests in one go            |
| `npm run format`  | Format all files with Prettier                                     |

## Project layout

```
src/
  core/      Game rules: seeded random numbers, dice. Plain TypeScript, no React or DOM
  assets/    Logo, background and dice icons (from v1)
  App.tsx    Interface
e2e/         Browser tests
docs/        Plan and design notes
```

Everything random goes through the seeded generator in `src/core/rng.ts`, so the same seed always produces the same dungeon.

## Deployment

Every push to `main` runs the checks in `.github/workflows/ci.yml` and, if they pass, deploys `dist/` to GitHub Pages. Pull requests run the same checks without deploying. The footer shows the version from `package.json` and the commit it was built from.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
