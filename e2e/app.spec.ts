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
  await expect(
    page.getByText('Press Roll to place the entrance room of a new dungeon.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Roll', exact: true }).click();

  const card = page.locator('.roll-card').first();
  await expect(card.getByRole('heading', { name: 'Roll 1' })).toBeVisible();
  await expect(card.locator('.result-line:not(.extra)')).toHaveCount(7);
  await expect(card.locator('.result-line').first()).toContainText(/^D4: [1-4] \(.+\)$/);
  await expect(card.getByText('Start of a new section of the dungeon.')).toBeVisible();
  await expect(card.getByRole('img', { name: /^Room 1: \d+ft wide by \d+ft long/ })).toBeVisible();
});

test('keeps history and numbering across reloads', async ({ page }) => {
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await roll.click();
  await roll.click();
  await roll.click();
  await page.getByRole('link', { name: 'Rooms (3)' }).click();
  expect(await rollTitles(page)).toEqual(['Roll 3', 'Roll 2', 'Roll 1']);

  await page.reload();
  expect(await rollTitles(page)).toEqual(['Roll 3', 'Roll 2', 'Roll 1']);
});

test('builds a connected map by exploring doors', async ({ page }) => {
  const map = page.locator('.map-svg');
  // The first room always has at least one door to explore (D6 ÷ 2, rounded up)
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(map.locator('[data-room]')).toHaveCount(1);
  await expect(map.locator('.map-entrance')).toHaveCount(1); // the dungeon entrance

  // Click a gold door on the map: the next roll goes through it
  const door = map.getByRole('button', { name: /^Explore Room 1, \w+ door/ }).first();
  const doorLabel = (await door.getAttribute('aria-label'))!.replace('Explore ', '');
  await door.click();
  const card = page.locator('.roll-card').first();
  await expect(card.getByRole('heading', { name: 'Roll 2' })).toBeVisible();
  await expect(card.getByText(`Through ${doorLabel}.`)).toBeVisible();
  // The explored door is no longer offered
  await expect(map.getByRole('button', { name: `Explore ${doorLabel}`, exact: true })).toHaveCount(
    0,
  );

  // The Roll button explores the door it names
  const hint = await page.locator('.next-door-hint').textContent();
  const named = hint?.match(/explores (Room \d+, [^.]+)\./)?.[1];
  if (named) {
    await page.getByRole('button', { name: 'Roll', exact: true }).click();
    await expect(page.locator('.roll-card').first().getByText(`Through ${named}.`)).toBeVisible();
  }

  // The dungeon is rebuilt identically after a reload (the view may be panned differently)
  const layer = page.locator('.map-svg > g');
  const before = await layer.innerHTML();
  await page.reload();
  await expect(page.locator('.map-svg [data-room]').first()).toBeVisible();
  expect(await layer.innerHTML()).toBe(before);
});

test('map doors can be explored from the keyboard list', async ({ page }) => {
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  const list = page.locator('.door-list');
  const first = list.getByRole('button').first();
  const label = (await first.textContent())!.replace('Explore ', '');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.roll-card').first().getByText(`Through ${label}.`)).toBeVisible();
});

test('selecting a room on the map shows its details', async ({ page }) => {
  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await roll.click();
  await roll.click();
  await expect(page.locator('.roll-card h2')).toHaveText('Roll 2');
  // The map follows the newest room, so fit it to make sure room 1 is on screen
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.locator('.map-svg [data-room="1"]').click();
  await expect(page.locator('.roll-card h2')).toHaveText('Roll 1');
  await expect(page.locator('.map-svg .map-room.selected')).toHaveCount(1);
});

test('map zoom and fit controls work', async ({ page }) => {
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  const layer = page.locator('.map-svg > g');
  const scaleOf = async () =>
    Number((await layer.getAttribute('transform'))!.match(/scale\(([\d.]+)\)/)![1]);
  const fitted = await scaleOf();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await scaleOf()).toBeGreaterThan(fitted);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  expect(await scaleOf()).toBeLessThan(fitted);
  await page.getByRole('button', { name: 'Fit' }).click();
  expect(await scaleOf()).toBeCloseTo(fitted, 5);
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
  await expect(newest.locator('.result-line:not(.extra)')).toHaveCount(6);
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

test('table effects roll extra dice and can be switched off', async ({ page }) => {
  // Give every D6 entry the effect "roll the D8 again"
  await page.goto('./#/tables');
  const d6 = page.locator('section', { has: page.getByRole('heading', { name: /D6:/ }) });
  for (let i = 1; i <= 6; i++) {
    await d6.getByRole('button', { name: `Effect for D6 entry ${i}` }).click();
    await d6
      .getByRole('group', { name: 'When this comes up, also roll:' })
      .getByLabel('D8')
      .check();
    await d6.getByRole('button', { name: `Effect for D6 entry ${i}` }).click();
  }
  await expect(d6.getByRole('button', { name: /Rolls D8 again/ })).toHaveCount(6);
  await d6.getByRole('button', { name: 'Save Table' }).click();

  await page.getByRole('link', { name: 'Back to Rolling' }).click();
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  // Only count extras from the D6: a Classic D20 effect can add more now and then
  const extra = page
    .locator('.roll-card')
    .first()
    .locator('.result-line.extra', { hasText: '(from D6)' });
  await expect(extra).toHaveCount(1);
  await expect(extra).toContainText(/^↳D8 again \(from D6\): [1-8] \(.+\)$/);

  // The effect is saved with the table
  await page.reload();
  await page.goto('./#/tables');
  await expect(d6.getByRole('button', { name: /Rolls D8 again/ })).toHaveCount(6);

  // Switching effects off stops extra rolls
  await page.getByRole('link', { name: 'Back to Rolling' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Table effects (roll again)').uncheck();
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(page.locator('.roll-card').first().locator('.result-line.extra')).toHaveCount(0);
});
