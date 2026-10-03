import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/diceydungeon2/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Locally, use the installed Chrome so no browser download is needed
      use: { ...devices['Desktop Chrome'], ...(isCI ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/diceydungeon2/',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
