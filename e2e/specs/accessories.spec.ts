import { expect, test } from '../fixtures';
import { gameCards } from '../support/actions';
import { choose } from '../support/mantine';
import { confirmDelete } from '../support/trash';

const copyCards = (page: import('@playwright/test').Page) => page.locator('[data-copy]');

test('ACC-01 add an accessory kept apart from the box, edit it, and delete it @smoke', async ({
  page,
  db,
}) => {
  const office = await db.seedLocation('Office');
  const closet = await db.seedLocation('Hall closet');
  const id = await db.seedGame({ title: 'Wingspan', copies: [{ locationId: office }] });
  await page.goto(`/games/${id}`);

  const card = copyCards(page).first();
  await card.getByRole('button', { name: 'Add accessory' }).click();
  const form = page.getByRole('form', { name: 'Add an accessory' });
  await form.getByLabel('Name').fill('Neoprene playmat');
  await choose(page, form, 'Kind', 'Playmat');
  await choose(page, form, 'Stored', 'Hall closet');
  await form.getByLabel('Price ($)').fill('35');
  await form.getByRole('button', { name: 'Add accessory' }).click();

  const item = card.locator('[data-accessory]');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('Neoprene playmat');
  await expect(item).toContainText('Playmat');
  await expect(item).toContainText('Stored in Hall closet');
  await expect(item).toContainText('$35.00');

  // Lending the copy reminds you that the playmat is not in the box.
  await card.getByRole('button', { name: 'Lend out' }).click();
  await expect(card.locator('[data-lend-reminder]')).toContainText(
    'Neoprene playmat (Hall closet)',
  );
  await card.getByRole('button', { name: 'Cancel' }).click();

  // The library's location filter ignores where accessories are kept: only the box counts.
  await page.goto(`/games?location=${closet}`);
  await expect(gameCards(page)).toHaveCount(0);
  await page.goto(`/games?location=${office}`);
  await expect(gameCards(page)).toHaveCount(1);

  await page.goto(`/games/${id}`);
  await item.getByRole('button', { name: 'Edit Neoprene playmat' }).click();
  const edit = page.getByRole('form', { name: 'Edit Neoprene playmat' });
  await edit.getByLabel('Name').fill('Deluxe playmat');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(item).toContainText('Deluxe playmat');

  await item.getByRole('button', { name: 'Delete Deluxe playmat' }).click();
  await confirmDelete(page);
  await expect(card.locator('[data-accessory]')).toHaveCount(0);
  expect(await db.count('copy_accessories', 'deleted_at is null')).toBe(0);
  expect(await db.count('copy_accessories')).toBe(1);
});

test('ACC-02 an accessory with no place stays with the box', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Everdell', copies: [{}] });
  await page.goto(`/games/${id}`);
  const card = copyCards(page).first();
  await card.getByRole('button', { name: 'Add accessory' }).click();
  const form = page.getByRole('form', { name: 'Add an accessory' });
  await form.getByLabel('Name').fill('Resource trays');
  await form.getByLabel('How many').fill('4');
  await form.getByRole('button', { name: 'Add accessory' }).click();
  const item = card.locator('[data-accessory]');
  await expect(item).toContainText('Resource trays ×4');
  await expect(item).toContainText('With the box');

  await card.getByRole('button', { name: 'Lend out' }).click();
  await expect(card.locator('[data-lend-reminder]')).toHaveCount(0);
});

test('ACC-03 a restricted profile sees accessories but cannot change them @security', async ({
  kidPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Root', copies: [{}] });
  const [copy] = await db.sql`select id, household_id from copies where game_id = ${id}`;
  await db.sql`insert into copy_accessories (household_id, copy_id, name, kind)
    values (${copy!.household_id as string}, ${copy!.id as string}, 'Painted meeples', 'miniatures')`;
  await kidPage.goto(`/games/${id}`);
  await expect(kidPage.locator('[data-accessory]')).toContainText('Painted meeples');
  await expect(kidPage.getByRole('button', { name: 'Add accessory' })).toHaveCount(0);
  await expect(kidPage.getByRole('button', { name: /^(Edit|Delete) Painted/ })).toHaveCount(0);
});
