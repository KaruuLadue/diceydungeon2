/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Short commit hash for the footer; GITHUB_SHA is set in CI
function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Served from https://karuuladue.github.io/diceydungeon2/
  base: '/diceydungeon2/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitHash()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
