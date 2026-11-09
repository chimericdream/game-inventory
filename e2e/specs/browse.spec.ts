import { expect, test } from '../fixtures';
import { gameCards } from '../support/actions';
import { chooseByPlaceholder } from '../support/mantine';

async function seedLibrary(db: typeof import('../support/db')) {
  const garage = await db.seedLocation('Garage');
  const den = await db.seedLocation('Den');
  await db.seedGame({
    title: 'Catan',
    minPlayers: 3,
    maxPlayers: 4,
    playTimeMinutes: 90,
    tags: ['strategy'],
    copies: [{ locationId: garage }],
  });
  await db.seedGame({
    title: 'Pandemic',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 45,
    tags: ['coop', 'strategy'],
    copies: [{ locationId: den }],
  });
  await db.seedGame({
    title: 'Uno',
    type: 'card',
    minPlayers: 2,
    maxPlayers: 10,
    playTimeMinutes: 20,
  });
  await db.seedGame({ title: 'Solitaire Box', minPlayers: 1, maxPlayers: 1, playTimeMinutes: 15 });
  await db.seedGame({ title: 'Player Handbook', type: 'rpg', system: 'D&D 5e', tags: ['rules'] });
  await db.seedGame({ title: 'Zelda', type: 'video', copies: [{ platform: 'Switch' }] });
  await db.seedGame({
    title: '100% Orange Juice',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 40,
  });
  await db.seedGame({ title: 'Under_score', minPlayers: 2, maxPlayers: 2 });
}

test('BRW-01 an empty library says so @smoke', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByText('No games match.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add game' })).toBeVisible();
});

test('BRW-02 text search is a case-insensitive substring match', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await expect(gameCards(page)).toHaveCount(8);

  await page.getByPlaceholder('Search titles').fill('cAtA');
  await expect(page).toHaveURL(/q=cAtA/);
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Catan');

  await page.getByPlaceholder('Search titles').fill('zzz-nothing');
  await expect(page.getByText('No games match.')).toBeVisible();
});

test('BRW-02b search treats % and _ literally', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await page.getByPlaceholder('Search titles').fill('%');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('100% Orange Juice');
  await page.getByPlaceholder('Search titles').fill('_');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Under_score');
});

test('BRW-03 type filter', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await chooseByPlaceholder(page, 'Any type', 'RPG');
  await expect(page).toHaveURL(/type=rpg/);
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Player Handbook');
});

test('BRW-03b player count filter includes the edges and excludes games without player data', async ({
  page,
  db,
}) => {
  await seedLibrary(db);
  await page.goto('/games?players=4');
  // Catan 3-4, Pandemic 2-4, Uno 2-10, Orange Juice 2-4
  await expect(gameCards(page)).toHaveCount(4);
  await expect(gameCards(page).filter({ hasText: 'Solitaire Box' })).toHaveCount(0);
  await expect(gameCards(page).filter({ hasText: 'Zelda' })).toHaveCount(0);

  await page.goto('/games?players=1');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Solitaire Box');

  await page.goto('/games?players=5');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Uno');
});

test('BRW-03c max play time filter is inclusive', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games?maxMinutes=45');
  // Pandemic 45, Uno 20, Solitaire 15, Orange Juice 40
  await expect(gameCards(page)).toHaveCount(4);
  await expect(gameCards(page).filter({ hasText: 'Catan' })).toHaveCount(0);
});

test('BRW-04 tag and location filters', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await chooseByPlaceholder(page, 'Any tag', 'coop');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Pandemic');

  await page.goto('/games');
  await chooseByPlaceholder(page, 'Any location', 'Garage');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Catan');
});

test('BRW-05 filters combine, live in the URL, survive reload and clear', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await chooseByPlaceholder(page, 'Any tag', 'strategy');
  await expect(gameCards(page)).toHaveCount(2);
  await page.getByPlaceholder('Max minutes').fill('60');
  await expect(page).toHaveURL(/maxMinutes=60/);
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page)).toContainText('Pandemic');

  await page.reload();
  await expect(gameCards(page)).toHaveCount(1);
  await expect(page.getByPlaceholder('Max minutes')).toHaveValue('60');

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(gameCards(page)).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);
});

test('BRW-05b a malformed filter value in the URL shows no games instead of an error', async ({
  page,
  db,
}) => {
  await seedLibrary(db);
  const res = await page.goto('/games?location=not-a-uuid');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('No games match.')).toBeVisible();
  for (const q of ['players=abc', 'maxMinutes=-5', 'type=bogus']) {
    const r = await page.goto(`/games?${q}`);
    expect(r?.status(), q).toBe(200);
    await expect(gameCards(page)).toHaveCount(8);
  }
});

test('BRW-06 the result count is right, including the singular', async ({ page, db }) => {
  await seedLibrary(db);
  await page.goto('/games');
  await expect(page.getByText('8 games', { exact: true })).toBeVisible();
  await page.goto('/games?q=zelda');
  await expect(page.getByText('1 game', { exact: true })).toBeVisible();
});

test('BRW-07 a library of 500 games is paged, in title order, with the total shown', async ({
  page,
  db,
}) => {
  await db.seedMany(500);
  const started = Date.now();
  await page.goto('/games');
  await expect(page.getByText('500 games', { exact: true })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(gameCards(page)).toHaveCount(48);
  await expect(gameCards(page).first()).toContainText('Bulk Game 0001');
  await expect(gameCards(page).last()).toContainText('Bulk Game 0048');

  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(gameCards(page)).toHaveCount(48);
  await expect(gameCards(page).first()).toContainText('Bulk Game 0049');
  await expect(page.getByRole('link', { name: 'Previous' })).toBeVisible();

  await page.goto('/games?page=11');
  await expect(gameCards(page)).toHaveCount(20);
  await expect(gameCards(page).last()).toContainText('Bulk Game 0500');
  await expect(page.getByRole('link', { name: 'Next' })).toHaveCount(0);
});

test('BRW-08 a card opens its game, and back returns to the same filtered list', async ({
  page,
  db,
}) => {
  await seedLibrary(db);
  await page.goto('/games?q=pandemic');
  await gameCards(page).first().click();
  await expect(page.getByRole('heading', { name: 'Pandemic' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/q=pandemic/);
  await expect(gameCards(page)).toHaveCount(1);
});
