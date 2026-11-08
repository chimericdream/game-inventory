import { expect, test } from '../fixtures';
import { choose, formWith } from '../support/mantine';

const ADD = 'Add';
const addForm = (page: import('@playwright/test').Page) => formWith(page, new RegExp(`^${ADD}$`));

test('WISH-01 add an item with a link, price and notes @smoke', async ({ page, db }) => {
  await page.goto('/wishlist');
  await expect(page.getByText('The wishlist is empty.')).toBeVisible();

  const form = addForm(page);
  await form.getByLabel('Title').fill('Gloomhaven');
  await choose(page, form, 'Type', 'Board game');
  await form.getByLabel('Link').fill('https://example.com/gloomhaven');
  await form.getByLabel('Price ($)').fill('139.99');
  await form.getByLabel('Notes').fill('For the holidays');
  await form.getByRole('button', { name: ADD, exact: true }).click();

  const link = page.getByRole('link', { name: 'Gloomhaven' });
  await expect(link).toHaveAttribute('href', 'https://example.com/gloomhaven');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const row = page.locator('.mantine-Paper-root', { hasText: 'Gloomhaven' });
  await expect(row).toContainText('$139.99');
  await expect(row).toContainText('For the holidays');
  await expect(row).toContainText('board');
  expect(await db.count('wishlist_items')).toBe(1);
});

test('WISH-01b an item without a link is plain text', async ({ page }) => {
  await page.goto('/wishlist');
  const form = addForm(page);
  await form.getByLabel('Title').fill('Mystery Box');
  await form.getByRole('button', { name: ADD, exact: true }).click();
  await expect(page.getByText('Mystery Box')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mystery Box' })).toHaveCount(0);
});

test('WISH-02 only http(s) links are accepted, never javascript: or junk', async ({ page, db }) => {
  await page.goto('/wishlist');
  for (const bad of [
    'javascript:alert(1)',
    'not a url',
    'ftp://example.com/x',
    'data:text/html,hi',
  ]) {
    const form = addForm(page);
    await form.getByLabel('Title').fill('Bad Link');
    await form.getByLabel('Link').fill(bad);
    await form.getByRole('button', { name: ADD, exact: true }).click();
    await expect(page.locator('.mantine-Alert-root'), bad).toBeVisible();
    expect(await db.count('wishlist_items'), bad).toBe(0);
  }
});

test('WISH-03 "We got it" moves the item into the catalog and opens it for editing', async ({
  page,
  db,
}) => {
  await db.seedWish('Wingspan', 'board');
  await page.goto('/wishlist');
  await page.getByRole('button', { name: 'We got it' }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}\/edit$/);
  await expect(page.getByLabel('Title *')).toHaveValue('Wingspan');
  expect(await db.count('games', "title = 'Wingspan'")).toBe(1);
  expect(await db.count('wishlist_items')).toBe(0);
});

test('WISH-04 remove an item', async ({ page, db }) => {
  await db.seedWish('Keep');
  await db.seedWish('Drop');
  await page.goto('/wishlist');
  await page
    .locator('.mantine-Paper-root', { hasText: 'Drop' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(page.getByText('Drop', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Keep', { exact: true })).toBeVisible();
  expect(await db.count('wishlist_items')).toBe(1);
});

test('WISH-05 a blank title is rejected; the page is closed to restricted profiles', async ({
  page,
  kidPage,
  db,
}) => {
  await page.goto('/wishlist');
  const form = addForm(page);
  await form.getByLabel('Title').fill('   ');
  await form.getByRole('button', { name: ADD, exact: true }).click();
  await expect(page.locator('.mantine-Alert-root')).toBeVisible();
  expect(await db.count('wishlist_items')).toBe(0);

  await kidPage.goto('/wishlist');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('WISH-06 each wishlist type is kept', async ({ page, db }) => {
  await page.goto('/wishlist');
  for (const [label, value] of [
    ['RPG', 'rpg'],
    ['Video game', 'video'],
  ] as const) {
    const form = addForm(page);
    await form.getByLabel('Title').fill(`Wish ${label}`);
    await choose(page, form, 'Type', label);
    await form.getByRole('button', { name: ADD, exact: true }).click();
    await expect(page.getByText(`Wish ${label}`)).toBeVisible();
    expect(await db.count('wishlist_items', `type = '${value}'`)).toBe(1);
  }
});
