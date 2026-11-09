import { expect, test, MEMBER } from '../fixtures';
import { choose, formWith } from '../support/mantine';
import { gameCards } from '../support/actions';

const ADD = 'Add copy';

test('COPY-01 add a copy with every detail and see it on the game @smoke', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedLocation('Hall closet');
  await page.goto(`/games/${id}`);
  await expect(page.getByText('No copies recorded yet.')).toBeVisible();

  const form = formWith(page, ADD);
  await choose(page, form, 'Format', 'physical');
  await form.getByLabel('Platform').fill('Tabletop');
  await choose(page, form, 'Condition', 'Worn');
  await choose(page, form, 'Owner', MEMBER.name);
  await choose(page, form, 'Location', 'Hall closet');
  await form.getByLabel('Price ($)').fill('29.99');
  await form.getByRole('button', { name: ADD }).click();

  const row = page.getByRole('row').filter({ hasText: 'Hall closet' });
  await expect(row).toContainText('physical');
  await expect(row).toContainText('Tabletop');
  await expect(row).toContainText('Worn');
  await expect(row).toContainText(MEMBER.name);
  await expect(row).toContainText('Hall closet');
  await expect(row).toContainText('$29.99');
  await expect(page.getByText('No copies recorded yet.')).toHaveCount(0);
});

test('COPY-02 two copies with different owners and locations both list', async ({ page, db }) => {
  const hall = await db.seedLocation('Hall');
  const attic = await db.seedLocation('Attic');
  const id = await db.seedGame({
    title: 'Two Copies',
    copies: [
      { ownerEmail: 'member@e2e.test', locationId: hall, priceCents: 1000 },
      { ownerEmail: 'admin@e2e.test', locationId: attic, priceCents: 2000, condition: 'unopened' },
    ],
  });
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('cell', { name: 'Hall', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Attic', exact: true })).toBeVisible();
  await expect(page.getByText('$10.00')).toBeVisible();
  await expect(page.getByText('$20.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete copy' })).toHaveCount(2);
});

test('COPY-03 deleting a copy leaves the other copy and the game', async ({ page, db }) => {
  const id = await db.seedGame({
    title: 'Keep Me',
    copies: [{ priceCents: 1111 }, { priceCents: 2222 }],
  });
  await page.goto(`/games/${id}`);
  await page
    .getByRole('row')
    .filter({ hasText: '$11.11' })
    .getByRole('button', { name: 'Delete copy' })
    .click();
  await expect(page.getByText('$11.11')).toHaveCount(0);
  await expect(page.getByText('$22.22')).toBeVisible();
  expect(await db.count('copies')).toBe(1);
  expect(await db.count('games')).toBe(1);
});

test('COPY-04 prices keep their cents', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Priced' });
  await page.goto(`/games/${id}`);
  for (const [typed, shown] of [
    ['0', '$0.00'],
    ['5', '$5.00'],
    ['12.5', '$12.50'],
    ['1234.56', '$1234.56'],
  ]) {
    const form = formWith(page, ADD);
    await form.getByLabel('Price ($)').fill(typed!);
    await form.getByRole('button', { name: ADD }).click();
    await expect(page.getByText(shown!, { exact: true })).toBeVisible();
  }
  const rows = await db.sql`select price_cents from copies order by price_cents`;
  expect(rows.map((r) => r.price_cents)).toEqual([0, 500, 1250, 123456]);
});

test('COPY-05 owner and location choices are this household’s people and places', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Pick Lists' });
  await db.seedLocation('Garage');
  await db.seedLocation('Den');
  await page.goto(`/games/${id}`);
  const form = formWith(page, ADD);

  await form.getByRole('combobox', { name: 'Owner' }).click();
  await expect(page.getByRole('option')).toHaveText(['Ada Admin', 'Kit Kid', 'Mo Member']);
  await page.keyboard.press('Escape');

  await form.getByRole('combobox', { name: 'Location' }).click();
  await expect(page.getByRole('option')).toHaveText(['Den', 'Garage']);
});

test('COPY-06 a video game copy shows its platform in the grid and on the game', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Zelda', type: 'video' });
  await page.goto(`/games/${id}`);
  const form = formWith(page, ADD);
  await form.getByLabel('Platform').fill('Switch');
  await choose(page, form, 'Format', 'digital');
  await form.getByRole('button', { name: ADD }).click();
  await expect(page.locator('.mantine-Badge-root', { hasText: 'Switch' })).toBeVisible();
  await expect(page.locator('.mantine-Badge-root', { hasText: 'digital' })).toBeVisible();

  await page.goto('/games');
  await expect(gameCards(page).filter({ hasText: 'Switch' })).toHaveCount(1);
});
