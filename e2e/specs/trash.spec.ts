import { expect, test } from '../fixtures';
import { confirmDelete } from '../support/trash';

const trashRow = (page: import('@playwright/test').Page, text: string) =>
  page.locator('[data-trashed]', { hasText: text });

test('TRASH-01 a deleted game waits in the trash; an admin can restore it with its plays', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Lost Cities', copies: [] });
  await db.seedPlay(id);
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await confirmDelete(page);
  await expect(page).toHaveURL(/\/games$/);

  await page.goto('/plays');
  await expect(page.getByText('No plays logged yet.')).toBeVisible();

  await page.goto('/settings?tab=trash');
  const row = trashRow(page, 'Lost Cities');
  await expect(row).toContainText('1 play');
  await expect(row).toContainText('removed for good');
  await row.getByRole('button', { name: /^Restore/ }).click();
  await expect(page.getByText('The trash is empty.')).toBeVisible();

  const res = await page.goto(`/games/${id}`);
  expect(res?.status()).toBe(200);
  await page.goto('/plays');
  await expect(page.getByText('Lost Cities').first()).toBeVisible();
});

test('TRASH-02 deleting for good needs the word "delete" and removes the game and its plays', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Gone For Good', copies: [] });
  await db.seedPlay(id);
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await confirmDelete(page);
  await expect(page).toHaveURL(/\/games$/);

  await page.goto('/settings?tab=trash');
  await trashRow(page, 'Gone For Good')
    .getByRole('button', { name: /^Delete forever/ })
    .click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Delete forever' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Type delete to confirm').fill('delet');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Type delete to confirm').fill('delete');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('The trash is empty.')).toBeVisible();
  expect(await db.count('games', `id = '${id}'`)).toBe(0);
  expect(await db.count('play_sessions')).toBe(0);
});

test('TRASH-03 a wishlist item and a copy can be trashed and restored from the same list', async ({
  page,
  db,
}) => {
  await db.seedWish('Azul');
  const id = await db.seedGame({ title: 'Has Copy', copies: [{}] });
  await page.goto('/wishlist');
  await page
    .locator('[data-wish]', { hasText: 'Azul' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await confirmDelete(page, 'Remove');
  await expect(page.getByText('Azul', { exact: true })).toHaveCount(0);
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete copy' }).click();
  await confirmDelete(page);
  await expect(page.locator('[data-copy]')).toHaveCount(0);

  await page.goto('/settings?tab=trash');
  await expect(page.locator('[data-trashed]')).toHaveCount(2);
  await trashRow(page, 'Azul')
    .getByRole('button', { name: /^Restore/ })
    .click();
  await expect(page.locator('[data-trashed]')).toHaveCount(1);
  await page.goto('/wishlist');
  await expect(page.getByText('Azul', { exact: true })).toBeVisible();
});

test('TRASH-04 a member sees and restores only what they deleted, and cannot delete for good', async ({
  page,
  memberPage,
  db,
}) => {
  await db.seedWish('Admins Item');
  await db.seedWish('Members Item');
  await page.goto('/wishlist');
  await page
    .locator('[data-wish]', { hasText: 'Admins Item' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await confirmDelete(page, 'Remove');
  await expect(page.getByText('Admins Item', { exact: true })).toHaveCount(0);
  await memberPage.goto('/wishlist');
  await memberPage
    .locator('[data-wish]', { hasText: 'Members Item' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await confirmDelete(memberPage, 'Remove');
  await expect(memberPage.getByText('Members Item', { exact: true })).toHaveCount(0);

  await memberPage.goto('/settings?tab=trash');
  await expect(memberPage.locator('[data-trashed]')).toHaveCount(1);
  await expect(trashRow(memberPage, 'Members Item')).toBeVisible();
  await expect(memberPage.getByRole('button', { name: /^Delete forever/ })).toHaveCount(0);
  await trashRow(memberPage, 'Members Item')
    .getByRole('button', { name: /^Restore/ })
    .click();
  await expect(memberPage.getByText('The trash is empty.')).toBeVisible();

  await page.goto('/settings?tab=trash');
  await expect(trashRow(page, 'Admins Item')).toBeVisible();
});

test('TRASH-05 restricted profiles have no trash', async ({ kidPage }) => {
  await kidPage.goto('/settings');
  await expect(kidPage.getByRole('link', { name: 'Trash' })).toHaveCount(0);
});
