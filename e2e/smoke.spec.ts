import { expect, test } from '@playwright/test';

test('page loads and rolls the full dice set', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  await expect(page).toHaveTitle('Dicey Dungeon 2');
  await expect(page.getByRole('heading', { name: 'Dicey Dungeon 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Roll' }).click();

  for (const [die, sides] of [
    ['D4', 4],
    ['D6', 6],
    ['D8', 8],
    ['D10', 10],
    ['D12', 12],
    ['D20', 20],
    ['D100', 100],
  ] as const) {
    const text = await page.getByTestId(`result-${die}`).textContent();
    const value = Number(text?.split(':')[1]);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(sides);
  }

  await expect(page.getByText(/^Seed \d+$/)).toBeVisible();
  expect(errors).toEqual([]);
});
