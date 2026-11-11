import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { choose, formWith } from '../support/mantine';
import { confirmDelete } from '../support/trash';

const LEND = 'Lend';

const loanRows = (page: Page) => page.locator('[data-loan]');
const section = (page: Page, title: string) =>
  page.getByRole('region', { name: new RegExp(`^${title}`) });
const short = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** A date in the browser's own timezone, which is what the quick-due buttons use. */
const localDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function lend(page: Page, game: string | RegExp, borrower: string, due?: string) {
  const form = formWith(page, LEND);
  await choose(page, form, 'Game', game);
  await form.getByRole('textbox', { name: /^Borrower/ }).fill(borrower);
  if (due) await form.getByLabel('Due (optional)').fill(due);
  await form.getByRole('button', { name: LEND }).click();
}

async function seedLoan(
  db: typeof import('../support/db'),
  title: string,
  loan: { borrower?: string; lentOn?: string; dueOn?: string | null; returnedOn?: string | null },
) {
  const id = await db.seedGame({ title, copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${id}`;
  await db.seedLoan(copy!.id as string, loan);
  return id;
}

test('LOAN-01 lend a copy with a due date and see it listed @smoke', async ({ page, db }) => {
  await db.seedGame({ title: 'Catan', copies: [{}] });
  await page.goto('/loans');
  await expect(page.getByText('Nothing is out on loan.')).toBeVisible();

  await lend(page, 'Catan', 'Neighbor Nick', '2099-01-31');
  const row = loanRows(page);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Catan');
  await expect(row).toContainText('With Neighbor Nick');
  await expect(row).toContainText(`since ${short(db.today())}`);
  await expect(row).toContainText('Jan 31');
  await expect(row).not.toContainText('late');
  await expect(section(page, 'Due later')).toBeVisible();
  expect(await db.count('loans')).toBe(1);
});

test('LOAN-02 lending without a due date works, and lands under "Out now"', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Open Ended', copies: [{}] });
  await page.goto('/loans');
  await lend(page, 'Open Ended', 'Sam');
  const row = section(page, 'Out now').locator('[data-loan]');
  await expect(row).toContainText('With Sam');
  await expect(row).not.toContainText(/due|late|in \d+ day/);
});

test('LOAN-03 a past due date is flagged late, a future one is not', async ({ page, db }) => {
  await seedLoan(db, 'Late Game', { borrower: 'Slow', lentOn: '2020-01-01', dueOn: '2020-02-01' });
  await seedLoan(db, 'Fine Game', { borrower: 'Quick', dueOn: '2099-01-01' });

  await page.goto('/loans');
  const late = section(page, 'Late');
  await expect(late).toContainText('Late Game');
  await expect(late).toContainText('days late');
  await expect(late).not.toContainText('Fine Game');
  await expect(section(page, 'Due later')).toContainText('Fine Game');
});

test('LOAN-03b loans are grouped late first, then due this week, then due later, then out now', async ({
  page,
  db,
}) => {
  await seedLoan(db, 'D Open', { borrower: 'A' });
  await seedLoan(db, 'C Later', { borrower: 'B', dueOn: day(30) });
  await seedLoan(db, 'B Soon', { borrower: 'C', dueOn: day(3) });
  await seedLoan(db, 'A Late', { borrower: 'D', lentOn: day(-20), dueOn: day(-2) });
  await page.goto('/loans');
  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  const order = headings.map((h) => h.replace(/\d+$/, '').trim());
  expect(
    order.filter((h) => ['Late', 'Due this week', 'Due later', 'Out now'].includes(h)),
  ).toEqual(['Late', 'Due this week', 'Due later', 'Out now']);
  await expect(section(page, 'Due this week')).toContainText('in 3 days');
});

test('LOAN-03c the summary sentence counts what is out, late and due this week', async ({
  page,
  db,
}) => {
  await seedLoan(db, 'One', { borrower: 'Ann', lentOn: day(-20), dueOn: day(-2) });
  await seedLoan(db, 'Two', { borrower: 'Ann', dueOn: day(2) });
  await seedLoan(db, 'Three', { borrower: 'Bo' });
  await page.goto('/loans');
  await expect(page.getByText('3 games are out with 2 people.')).toBeVisible();
  await expect(page.getByText('1 is late, 1 due this week.')).toBeVisible();
});

test('LOAN-03d an open loan shows how many days it has been out', async ({ page, db }) => {
  await seedLoan(db, 'Long Gone', { borrower: 'Pat', lentOn: day(-14) });
  await page.goto('/loans');
  await expect(loanRows(page)).toContainText('14 days');
});

test('LOAN-04 returning a loan clears it, lists it as back, and makes the copy lendable again', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Boomerang', copies: [{}] });
  await page.goto('/loans');
  await lend(page, 'Boomerang', 'Pat');
  await expect(loanRows(page)).toContainText('With Pat');

  // While it is out it is not offered for lending.
  const form = formWith(page, LEND);
  await form.getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option', { name: 'Boomerang' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Mark returned' }).click();
  await expect(page.getByText('Nothing is out on loan.')).toBeVisible();
  const back = section(page, 'Back on the shelf');
  await expect(back).toContainText('Boomerang');
  await expect(back).toContainText('Pat');
  const [loan] = await db.sql`select returned_on from loans`;
  expect(loan!.returned_on).not.toBeNull();

  await form.getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option', { name: 'Boomerang' })).toBeVisible();
});

test('LOAN-05 a copy that is already out cannot be lent a second time', async ({ page, db }) => {
  await seedLoan(db, 'Single', { borrower: 'First' });
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
  await db.seedGame({ title: 'No Copy Yet', copies: [] });
  await page.goto('/loans');
  await formWith(page, LEND).getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option')).toHaveText(['Mario (Switch)', 'Mario (Wii)']);
});

test('LOAN-08 deleting the copy that is out on loan does not break the loans page', async ({
  page,
  db,
}) => {
  const id = await seedLoan(db, 'Doomed Loan', { borrower: 'Ghost' });
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete copy' }).click();
  await confirmDelete(page);
  await expect(page.locator('[data-copy]')).toHaveCount(0);
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
  await expect(loanRows(memberPage)).toContainText('With Friend');
  await kidPage.goto('/loans');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('LOAN-10 earlier borrowers are one tap away, with how they have done before', async ({
  page,
  db,
}) => {
  await seedLoan(db, 'Old One', {
    borrower: 'Jonas',
    lentOn: '2026-01-01',
    dueOn: '2026-01-10',
    returnedOn: '2026-01-20',
  });
  await db.seedGame({ title: 'New One', copies: [{}] });
  await page.goto('/loans');
  const form = formWith(page, LEND);
  await form
    .getByRole('group', { name: 'Previous borrowers' })
    .getByRole('button', { name: 'Jonas' })
    .click();
  await expect(form.getByRole('textbox', { name: /^Borrower/ })).toHaveValue('Jonas');
  await expect(
    form.getByText('Jonas has borrowed 1 game before and returned 1 late.'),
  ).toBeVisible();
});

test('LOAN-11 quick due dates fill the date, and "No due date" clears it', async ({ page, db }) => {
  await db.seedGame({ title: 'Quick', copies: [{}] });
  await page.goto('/loans');
  const form = formWith(page, LEND);
  const quick = form.getByRole('group', { name: 'Quick due dates' });
  await quick.getByRole('button', { name: '2 weeks' }).click();
  await expect(form.getByLabel('Due (optional)')).toHaveValue(localDay(14));
  await quick.getByRole('button', { name: 'No due date' }).click();
  await expect(form.getByLabel('Due (optional)')).toHaveValue('');

  await choose(page, form, 'Game', 'Quick');
  await form.getByRole('textbox', { name: /^Borrower/ }).fill('Dana');
  await quick.getByRole('button', { name: '1 week' }).click();
  await form.getByRole('button', { name: LEND }).click();
  // The server counts days from the UTC date and the chip from the local one, so they can differ.
  const away = Math.round((Date.parse(localDay(7)) - Date.parse(day(0))) / 86_400_000);
  await expect(loanRows(page)).toContainText(`in ${away} days`);
  const [loan] = await db.sql`select due_on::text as due_on from loans`;
  expect(loan!.due_on).toBe(localDay(7));
});

test('LOAN-12 the catalog marks a lent-out game and the loan shows how soon it is due', async ({
  page,
  db,
}) => {
  await seedLoan(db, 'Lent Out', { borrower: 'Pat', dueOn: day(1) });
  await db.seedGame({ title: 'On The Shelf', copies: [{}] });

  await page.goto('/games');
  await expect(page.getByText(/Out with/)).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: /Lent Out/ }).getByText('Out with Pat'),
  ).toBeVisible();

  await page.goto('/loans');
  await expect(section(page, 'Due this week')).toContainText('in 1 day');
});

test('LOAN-13 the same loans are readable on a phone, with the lend form in a sheet', async ({
  newPage,
  db,
}) => {
  const { ADMIN } = await import('../support/roles');
  const page = await newPage(ADMIN.storageState);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoan(db, 'Phone Loan', { borrower: 'Pat' });
  await db.seedGame({ title: 'Phone Lendable', copies: [{}] });
  await page.goto('/loans');
  await expect(loanRows(page)).toContainText('Phone Loan');
  await expect(page.getByRole('button', { name: 'Lend', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Lend a game' }).click();
  const sheet = page.getByRole('dialog', { name: 'Lend a game' });
  await choose(page, sheet, 'Game', 'Phone Lendable');
  await sheet.getByRole('textbox', { name: /^Borrower/ }).fill('Dana');
  await sheet.getByRole('button', { name: 'Lend', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(loanRows(page)).toHaveCount(2);
});
