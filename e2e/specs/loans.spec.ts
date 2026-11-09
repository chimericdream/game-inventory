import { expect, test } from '../fixtures';
import { choose, formWith } from '../support/mantine';

const LEND = 'Lend';

async function lend(
  page: import('@playwright/test').Page,
  game: string | RegExp,
  borrower: string,
  due?: string,
) {
  const form = formWith(page, LEND);
  await choose(page, form, 'Game', game);
  await form.getByLabel('Borrower').fill(borrower);
  if (due) await form.getByLabel('Due (optional)').fill(due);
  await form.getByRole('button', { name: LEND }).click();
}

test('LOAN-01 lend a copy with a due date and see it listed @smoke', async ({ page, db }) => {
  await db.seedGame({ title: 'Catan', copies: [{}] });
  await page.goto('/loans');
  await expect(page.getByText('Nothing is out on loan.')).toBeVisible();

  await lend(page, 'Catan', 'Neighbor Nick', '2099-01-31');
  const row = page.locator('.mantine-Paper-root', { hasText: 'With Neighbor Nick' });
  await expect(row).toContainText('Catan');
  await expect(row).toContainText(`since ${db.today()}`);
  await expect(row).toContainText('due 2099-01-31');
  await expect(row.getByText('Overdue')).toHaveCount(0);
  expect(await db.count('loans')).toBe(1);
});

test('LOAN-02 lending without a due date works', async ({ page, db }) => {
  await db.seedGame({ title: 'Open Ended', copies: [{}] });
  await page.goto('/loans');
  await lend(page, 'Open Ended', 'Sam');
  const row = page.locator('.mantine-Paper-root', { hasText: 'With Sam' });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText('due');
});

test('LOAN-03 a past due date is flagged overdue, a future one is not', async ({ page, db }) => {
  const late = await db.seedGame({ title: 'Late Game', copies: [{}] });
  const fine = await db.seedGame({ title: 'Fine Game', copies: [{}] });
  const [lateCopy] = await db.sql`select id from copies where game_id = ${late}`;
  const [fineCopy] = await db.sql`select id from copies where game_id = ${fine}`;
  await db.seedLoan(lateCopy!.id as string, {
    borrower: 'Slow',
    lentOn: '2020-01-01',
    dueOn: '2020-02-01',
  });
  await db.seedLoan(fineCopy!.id as string, { borrower: 'Quick', dueOn: '2099-01-01' });

  await page.goto('/loans');
  await expect(
    page.locator('.mantine-Paper-root', { hasText: 'Late Game' }).getByText('Overdue'),
  ).toBeVisible();
  await expect(
    page.locator('.mantine-Paper-root', { hasText: 'Fine Game' }).getByText('Overdue'),
  ).toHaveCount(0);
});

test('LOAN-04 returning a loan clears it and makes the copy lendable again', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Boomerang', copies: [{}] });
  await page.goto('/loans');
  await lend(page, 'Boomerang', 'Pat');
  await expect(page.getByText('With Pat')).toBeVisible();

  // While it is out it is not offered for lending.
  const form = formWith(page, LEND);
  await form.getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option', { name: 'Boomerang' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Mark returned' }).click();
  await expect(page.getByText('Nothing is out on loan.')).toBeVisible();
  const [loan] = await db.sql`select returned_on from loans`;
  expect(loan!.returned_on).not.toBeNull();

  await form.getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option', { name: 'Boomerang' })).toBeVisible();
});

test('LOAN-05 a copy that is already out cannot be lent a second time', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Single', copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${id}`;
  await db.seedLoan(copy!.id as string, { borrower: 'First' });
  await page.goto('/loans');
  await formWith(page, LEND).getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option')).toHaveCount(0);
  expect(await db.count('loans')).toBe(1);
});

test('LOAN-06 a blank borrower is rejected', async ({ page, db }) => {
  await db.seedGame({ title: 'Anon', copies: [{}] });
  await page.goto('/loans');
  await lend(page, 'Anon', '   ');
  await expect(page.locator('.mantine-Alert-root')).toContainText(/who is borrowing/i);
  await expect(page.locator('.mantine-Alert-root')).not.toContainText('"code"');
  expect(await db.count('loans')).toBe(0);
});

test('LOAN-07 only copies are offered, and a game with two platforms shows both', async ({
  page,
  db,
}) => {
  await db.seedGame({
    title: 'Mario',
    type: 'video',
    copies: [{ platform: 'Switch' }, { platform: 'Wii' }],
  });
  await db.seedGame({ title: 'No Copy Yet' });
  await page.goto('/loans');
  await formWith(page, LEND).getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option')).toHaveText(['Mario (Switch)', 'Mario (Wii)']);
});

test('LOAN-08 deleting a game that is out on loan does not break the loans page', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Doomed Loan', copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${id}`;
  await db.seedLoan(copy!.id as string, { borrower: 'Ghost' });
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  const res = await page.goto('/loans');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('Nothing is out on loan.')).toBeVisible();
});

test('LOAN-09 members can lend; the loans page is closed to restricted profiles', async ({
  memberPage,
  kidPage,
  db,
}) => {
  await db.seedGame({ title: 'Shared', copies: [{}] });
  await memberPage.goto('/loans');
  await lend(memberPage, 'Shared', 'Friend');
  await expect(memberPage.getByText('With Friend')).toBeVisible();
  await kidPage.goto('/loans');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('LOAN-05 the catalog marks a lent-out game and the loan shows how soon it is due', async ({
  page,
  db,
}) => {
  const out = await db.seedGame({ title: 'Lent Out', copies: [{}] });
  await db.seedGame({ title: 'On The Shelf', copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${out}`;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await db.seedLoan(copy!.id as string, { borrower: 'Pat', dueOn: tomorrow });

  await page.goto('/games');
  await expect(page.getByText(/Out with/)).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: /Lent Out/ }).getByText('Out with Pat'),
  ).toBeVisible();

  await page.goto('/loans');
  await expect(page.getByText('Due tomorrow')).toBeVisible();
});
