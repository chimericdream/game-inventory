import type { Page } from '@playwright/test';

import { expect, test, ADMIN, MEMBER } from '../fixtures';
import { addGameViaUi } from '../support/actions';
import { PASSWORD, formWith } from '../support/mantine';

const manage = (page: Page, name: string) => page.locator('details', { hasText: name }).first();

async function pick(page: Page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('SET-08 locations show how many copies they hold, and one that holds copies cannot be removed', async ({
  page,
  db,
}) => {
  const garage = await db.seedLocation('Garage');
  await db.seedLocation('Den');
  await db.seedGame({ title: 'Boxed', copies: [{ locationId: garage }] });
  await page.goto('/settings?tab=locations');

  const row = page.locator('[data-location]', { hasText: 'Garage' });
  await expect(row).toContainText('1 copy');
  await page.getByRole('button', { name: 'Remove Garage' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(
    'Garage: It holds 1 copy. Move it first.',
  );
  await expect(row).toBeVisible();
  expect(await db.count('copies', 'location_id is not null')).toBe(1);

  await page.getByRole('button', { name: 'Remove Den' }).click();
  await expect(page.locator('[data-location]', { hasText: 'Den' })).toHaveCount(0);
  expect(await db.count('locations')).toBe(1);
});

test('SET-08b a place with places inside it cannot be removed until they are', async ({
  page,
  db,
}) => {
  const garage = await db.seedLocation('Garage');
  await db.seedLocation('Shelf 2', garage);
  await page.goto('/settings?tab=locations');
  await page.getByRole('button', { name: 'Remove Garage' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(
    'It has places inside it',
  );
  expect(await db.count('locations')).toBe(2);
});

test('SET-09 two names for the same person can be merged, and their plays follow', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { playedOn: '2026-01-01', players: ['John'] });
  await db.seedPlay(id, { playedOn: '2026-01-02', players: ['John'] });
  await db.seedPlay(id, { playedOn: '2026-01-03', players: ['Jon'] });
  await page.goto('/settings');

  await expect(manage(page, 'Jon')).toContainText('1 play');
  await manage(page, 'Jon').locator('summary').click();
  await pick(page, 'Merge Jon into someone', 'John');
  await manage(page, 'Jon').getByRole('button', { name: 'Merge', exact: true }).click();

  await expect(
    page.locator('details', { hasText: 'Jon' }).filter({ hasNotText: 'John' }),
  ).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Merged. 1 play moved.');
  await expect(manage(page, 'John')).toContainText('3 plays');
  expect(await db.count('players', "user_id is null and display_name = 'John'")).toBe(1);
  expect(await db.count('players', "display_name = 'Jon'")).toBe(0);
});

test('SET-09b a person can be renamed, and removed only when they have no plays', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { players: ['Jhon'] });
  await db.sql`insert into players (household_id, display_name)
               select household_id, 'Idle Ida' from users limit 1`;
  await page.goto('/settings');

  await manage(page, 'Jhon').locator('summary').click();
  await manage(page, 'Jhon').getByLabel('Rename Jhon').fill('John');
  await manage(page, 'Jhon').getByRole('button', { name: 'Save name' }).click();
  await expect(manage(page, 'John')).toBeVisible();

  await manage(page, 'John').getByRole('button', { name: 'Remove John' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(
    'They have 1 plays. Merge them into someone instead.',
  );

  await manage(page, 'Idle Ida').locator('summary').click();
  await manage(page, 'Idle Ida').getByRole('button', { name: 'Remove Idle Ida' }).click();
  await expect(manage(page, 'Idle Ida')).toHaveCount(0);
});

test('SET-10 when a friend gets an account, their earlier plays count for it', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { playedOn: '2026-01-01', players: ['Moe'] });
  await db.seedPlay(id, { playedOn: '2026-01-02', players: ['Moe'] });
  await page.goto('/settings');

  await manage(page, 'Moe').locator('summary').click();
  await pick(page, 'Link Moe to an account', MEMBER.name);
  await manage(page, 'Moe').getByRole('button', { name: 'Link to account' }).click();
  await expect(page.getByText('2 plays now count for that account.')).toBeVisible();

  const [row] = await db.sql`
    select count(*)::int as n from play_participants pp
    join players p on p.id = pp.player_id
    join users u on u.id = p.user_id where u.email = ${MEMBER.email}`;
  expect(row!.n).toBe(2);
  expect(await db.count('players', "display_name = 'Moe'")).toBe(0);
});

test('SET-11 adding a person can claim a friend’s earlier plays', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { players: ['Dana'] });
  await db.seedPlay(id, { players: ['Dana'] });
  await page.goto('/settings');

  const form = formWith(page, 'Add person');
  await form.getByLabel('Name').fill('Dana Dee');
  await form.getByLabel('Email').fill('dana@tmp.test');
  await form.getByLabel(PASSWORD).fill('dana-password-1');
  await pick(page, 'Is this someone who has played before?', 'Dana');
  await form.getByRole('button', { name: 'Add person' }).click();

  await expect(page.getByText('Added Dana Dee. 2 earlier plays now count for them.')).toBeVisible();
  expect(await db.count('users', "email = 'dana@tmp.test'")).toBe(1);
  expect(await db.count('players', "user_id is null and display_name = 'Dana'")).toBe(0);
});

test('SET-12 the activity tab says who did what', async ({ page }) => {
  await addGameViaUi(page, { title: 'Audited Game' });
  await page.goto('/settings?tab=activity');
  const row = page.locator('[data-activity]', { hasText: 'Audited Game' }).first();
  await expect(row).toContainText(ADMIN.name);
  await expect(row).toContainText('added the game Audited Game');
});

test('SET-13 only admins get the guest-player tools, guest links and activity', async ({
  memberPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { players: ['Visitor'] });
  await memberPage.goto('/settings');
  await expect(memberPage.getByText('People who play but have no account')).toHaveCount(0);
  await expect(memberPage.getByText('Visitor')).toHaveCount(0);
  for (const tab of ['links', 'activity']) {
    await memberPage.goto(`/settings?tab=${tab}`);
    await expect(memberPage.getByRole('heading', { name: 'Guest links' })).toHaveCount(0);
    await expect(memberPage.getByRole('heading', { name: 'Activity' })).toHaveCount(0);
    await expect(memberPage.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  }
});
