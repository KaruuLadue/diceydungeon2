import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const rollTitles = (page: Page) => page.locator('.roll-title').allTextContents();

// Uncaught page errors fail the test (tests in a worker run one at a time)
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('./');
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test('rolls rooms with all seven dice and a drawing', async ({ page }) => {
  await expect(page).toHaveTitle('Dicey Dungeon 2');
  await expect(page.getByText('Press Roll to generate your first room.')).toBeVisible();

  await page.getByRole('button', { name: 'Roll', exact: true }).click();

  const card = page.locator('.roll-card').first();
  await expect(card.getByRole('heading', { name: 'Roll 1' })).toBeVisible();
  await expect(card.locator('.result-line')).toHaveCount(7);
  await expect(card.locator('.result-line').first()).toContainText(/^D4: [1-4] \(.+\)$/);
  await expect(card.getByRole('img', { name: /^Room \d+ft wide by \d+ft long/ })).toBeVisible();
});

test('keeps history and numbering across reloads', async ({ page }) => {
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await roll.click();
  await roll.click();
  await roll.click();
  expect(await rollTitles(page)).toEqual(['Roll 3', 'Roll 2', 'Roll 1']);

  await page.reload();
  expect(await rollTitles(page)).toEqual(['Roll 3', 'Roll 2', 'Roll 1']);
});

test('reset clears the history after confirming', async ({ page }) => {
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.roll-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled();
});

test('settings turn drawings and dice on and off, and persist', async ({ page }) => {
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByLabel('Room drawings').uncheck();
  await expect(page.locator('.room-map')).toHaveCount(0);
  await page.getByLabel('Room drawings').check();
  await expect(page.locator('.room-map')).toHaveCount(1);

  await page.getByLabel('D20 (Room Modifier)').uncheck();
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  const newest = page.locator('.roll-card').first();
  await expect(newest.locator('.result-line')).toHaveCount(6);
  await expect(newest.locator('[data-die="D20"]')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('D20 (Room Modifier)')).not.toBeChecked();
});

test('exports the roll log as text', async ({ page }) => {
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Log' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('roll_history.txt');
  const text = await readFile(await file.path(), 'utf8');
  expect(text).toMatch(/^Roll History:\n\nRoll 1 \(.+\):\nD4: \d \(.+\)\n/);
});

test('edited tables are saved and used for new rolls', async ({ page }) => {
  await page.getByRole('link', { name: 'Edit Tables' }).click();
  await expect(page.getByRole('heading', { name: /D4: Hallway Length/ })).toBeVisible();

  // No randomize for dice that drive the drawing
  const d4 = page.locator('section', { has: page.getByRole('heading', { name: /D4:/ }) });
  const d8 = page.locator('section', { has: page.getByRole('heading', { name: /D8:/ }) });
  await expect(d4.getByRole('button', { name: 'Randomize', exact: true })).toHaveCount(0);
  await expect(d8.getByRole('button', { name: 'Randomize', exact: true })).toHaveCount(1);

  for (let i = 0; i < 4; i++) await page.locator(`#D4-${i}`).fill(`Custom hallway ${i + 1}`);
  await expect(d4.getByText('unsaved')).toBeVisible();

  // Empty entries are rejected
  await page.locator('#D4-0').fill('  ');
  await d4.getByRole('button', { name: 'Save Table' }).click();
  await expect(page.getByRole('status')).toContainText('D4: entry 1 cannot be empty.');

  await page.locator('#D4-0').fill('Custom hallway 1');
  await d4.getByRole('button', { name: 'Save Table' }).click();
  await expect(page.getByRole('status')).toContainText('D4 table saved.');
  await expect(d4.getByText('unsaved')).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to Rolling' }).first().click();
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(page.locator('[data-die="D4"]').first()).toContainText('Custom hallway');

  await page.reload();
  await page.getByRole('link', { name: 'Edit Tables' }).click();
  await expect(page.locator('#D4-2')).toHaveValue('Custom hallway 3');
});

test('exports and imports tables', async ({ page }) => {
  await page.goto('./#/tables');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(exported.D100).toHaveLength(10);

  // Import a modified copy
  exported.D12[0] = 'Imported Room';
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('import-input').setInputFiles({
    name: 'tables.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole('status')).toContainText('Tables imported.');
  await expect(page.locator('#D12-0')).toHaveValue('Imported Room');

  // A broken file is rejected
  await page.getByTestId('import-input').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"D4": []}'),
  });
  await expect(page.getByRole('status')).toContainText("Couldn't import: D4 must have 4");
});

test('offers to load tables saved by Dicey Dungeon 1', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'customRollTables',
      JSON.stringify({ D8: Array.from({ length: 8 }, (_, i) => `v1 encounter ${i + 1}`) }),
    ),
  );
  // Reload so the app starts with v1's data already in storage, as real visitors would
  await page.goto('./#/tables');
  await page.reload();
  await page.getByRole('button', { name: 'Load them' }).click();
  await expect(page.locator('#D8-0')).toHaveValue('v1 encounter 1');
  await expect(page.getByText('1 table has unsaved changes.')).toBeVisible();
});

test('shows the instructions', async ({ page }) => {
  await page.getByRole('link', { name: 'Instructions' }).click();
  await expect(page.getByRole('heading', { name: 'What is Dicey Dungeon?' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Room Length' })).toBeVisible();
});
