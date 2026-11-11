import { expect, test, MEMBER } from '../fixtures';
import { choose, formWith } from '../support/mantine';
import { gameCards } from '../support/actions';
import { confirmDelete } from '../support/trash';

const copyCards = (page: import('@playwright/test').Page) => page.locator('[data-copy]');

const ADD = 'Add copy';

test('COPY-01 add a copy with every detail and see it on the game @smoke', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Catan', copies: [] });
  await db.seedLocation('Hall closet');
  await page.goto(`/games/${id}`);
  await expect(page.getByText('No copies yet.')).toBeVisible();

  const form = formWith(page, ADD);
  await choose(page, form, 'Format', 'physical');
  await form.getByLabel('Platform').fill('Tabletop');
  await choose(page, form, 'Condition', 'Worn');
  await choose(page, form, 'Owner', MEMBER.name);
  await choose(page, form, 'Location', 'Hall closet');
  await form.getByLabel('Price ($)').fill('29.99');
  await form.getByRole('button', { name: ADD }).click();

  const card = copyCards(page).filter({ hasText: 'Hall closet' });
  await expect(card).toContainText(`${MEMBER.name}’s copy`);
  await expect(card).toContainText('Physical');
  await expect(card).toContainText('Tabletop');
  await expect(card).toContainText('Worn');
  await expect(card).toContainText('Hall closet');
  await expect(card).toContainText('$29.99');
  await expect(card).toContainText('On the shelf');
  await expect(page.getByText('No copies yet.')).toHaveCount(0);
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
  await expect(copyCards(page)).toHaveCount(2);
  await expect(copyCards(page).filter({ hasText: 'Hall' })).toContainText('Mo Member');
  await expect(copyCards(page).filter({ hasText: 'Attic' })).toContainText('Unopened');
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
  await copyCards(page)
    .filter({ hasText: '$11.11' })
    .getByRole('button', { name: 'Delete copy' })
    .click();
  await confirmDelete(page);
  await expect(page.getByText('$11.11')).toHaveCount(0);
  await expect(page.getByText('$22.22')).toBeVisible();
  expect(await db.count('copies', 'deleted_at is null')).toBe(1);
  expect(await db.count('copies')).toBe(2);
  expect(await db.count('games')).toBe(1);
});

test('COPY-04 prices keep their cents', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Priced', copies: [] });
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
  const id = await db.seedGame({ title: 'Zelda', type: 'video', copies: [] });
  await page.goto(`/games/${id}`);
  const form = formWith(page, ADD);
  await form.getByLabel('Platform').fill('Switch');
  await choose(page, form, 'Format', 'digital');
  await form.getByRole('button', { name: ADD }).click();
  await expect(copyCards(page)).toContainText('Switch');
  await expect(copyCards(page)).toContainText('Digital');

  await page.goto('/games');
  await expect(gameCards(page).filter({ hasText: 'Switch' })).toHaveCount(1);
});

test('COPY-07 lend a copy from its card, see who has it, and mark it returned', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Lendable', copies: [{}, {}] });
  await page.goto(`/games/${id}`);
  const first = copyCards(page).first();
  await first.getByRole('button', { name: 'Lend out' }).click();
  await first.getByLabel('Who has it?').fill('Aunt Dana');
  await first.getByRole('button', { name: 'Lend it' }).click();

  await expect(first).toContainText('Lent out');
  await expect(first).toContainText('Aunt Dana');
  await expect(first).toContainText('since');
  await expect(copyCards(page).filter({ hasText: 'On the shelf' })).toHaveCount(1);
  expect(await db.count('loans', 'returned_on is null')).toBe(1);

  await first.getByRole('button', { name: 'Mark returned' }).click();
  await expect(copyCards(page).filter({ hasText: 'On the shelf' })).toHaveCount(2);
  expect(await db.count('loans', 'returned_on is null')).toBe(0);
});

test('COPY-08 a restricted profile is not told who has a copy @security', async ({
  kidPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Out Of House', copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${id}`;
  await db.seedLoan(copy!.id as string, { borrower: 'Secret Borrower' });
  await kidPage.goto(`/games/${id}`);
  await expect(kidPage.getByText('Secret Borrower')).toHaveCount(0);
  await expect(kidPage.getByRole('button', { name: 'Lend out' })).toHaveCount(0);
  const html = await (await kidPage.request.get(`/games/${id}`)).text();
  expect(html).not.toContain('Secret Borrower');
});
