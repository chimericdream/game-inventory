import { expect, test, ADMIN, KID, MEMBER } from '../fixtures';
import { login } from '../support/auth';
import { PASSWORD, choose, formWith } from '../support/mantine';

const person = (name: string, email: string, password: string) => ({ name, email, password });

async function addPerson(
  page: import('@playwright/test').Page,
  p: { name: string; email: string; password: string },
  profile?: string,
) {
  const form = formWith(page, 'Add person');
  await form.getByLabel('Name').fill(p.name);
  await form.getByLabel('Email').fill(p.email);
  await form.getByLabel(PASSWORD).fill(p.password);
  if (profile) await choose(page, form, 'Profile', profile);
  await form.getByRole('button', { name: 'Add person' }).click();
}

test('SET-01b a newly added person can sign in with the password set for them', async ({
  page,
  anonPage,
  db,
}) => {
  await page.goto('/settings');
  const p = person('Nia New', 'nia@tmp.test', 'nia-password-1');
  await addPerson(page, p, 'Admin');
  await expect(page.getByText('Nia New')).toBeVisible();
  expect(await db.count('users', "email = 'nia@tmp.test' and role = 'admin'")).toBe(1);

  await login(anonPage, p);
  await expect(anonPage.getByText('Nia New')).toBeVisible();
});

test('SET-02 a duplicate email is refused and nothing is created', async ({ page, db }) => {
  await page.goto('/settings');
  const before = await db.count('users');
  await addPerson(page, person('Copycat', MEMBER.email, 'copycat-pass-1'));
  await expect(page.locator('.mantine-Alert-root')).toContainText(/already used/i);
  expect(await db.count('users')).toBe(before);
});

test('SET-02b an email differing only by case counts as a duplicate', async ({ page, db }) => {
  await page.goto('/settings');
  const before = await db.count('users');
  await addPerson(page, person('Shouty', MEMBER.email.toUpperCase(), 'shouty-pass-1'));
  await expect(page.locator('.mantine-Alert-root')).toContainText(/already used|valid/i);
  expect(await db.count('users')).toBe(before);
});

test('SET-03 a short password is rejected', async ({ page, db }) => {
  await page.goto('/settings');
  await addPerson(page, person('Weak Pass', 'weak@tmp.test', 'short'));
  await expect(page.locator('.mantine-Alert-root')).toContainText('Use at least 8 characters');
  expect(await db.count('users', "email = 'weak@tmp.test'")).toBe(0);
});

test('SET-04 locations can be nested and then used on copies', async ({ page, db }) => {
  await page.goto('/settings');
  await expect(page.getByText('None yet.')).toBeVisible();

  const add = formWith(page, 'Add location');
  await add.getByLabel('New location').fill('Garage');
  await add.getByRole('button', { name: 'Add location' }).click();
  await expect(page.getByText('Garage', { exact: true }).first()).toBeVisible();

  await add.getByLabel('New location').fill('Shelf 2');
  await choose(page, add, 'Inside (optional)', 'Garage');
  await add.getByRole('button', { name: 'Add location' }).click();
  await expect(page.getByText('Garage › Shelf 2')).toBeVisible();

  const id = await db.seedGame({ title: 'Stored' });
  await page.goto(`/games/${id}`);
  const form = formWith(page, 'Add copy');
  await form.getByRole('combobox', { name: 'Location' }).click();
  await expect(page.getByRole('option', { name: 'Shelf 2' })).toBeVisible();
});

test('SET-05 a member manages locations but not people or guest links', async ({ memberPage }) => {
  await memberPage.goto('/settings');
  await expect(memberPage.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(memberPage.getByText(ADMIN.name)).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Add person' })).toHaveCount(0);
  await expect(memberPage.getByRole('heading', { name: 'Guest links' })).toHaveCount(0);
  await expect(memberPage.getByRole('button', { name: 'Add location' })).toBeVisible();
});

test('SET-06 a restricted profile sees settings read-only', async ({ kidPage }) => {
  await kidPage.goto('/settings');
  await expect(kidPage.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(kidPage.getByRole('main').getByText(KID.name, { exact: true })).toBeVisible();
  await expect(kidPage.getByRole('button', { name: 'Add person' })).toHaveCount(0);
  await expect(kidPage.getByRole('button', { name: 'Add location' })).toHaveCount(0);
  await expect(kidPage.getByRole('heading', { name: 'Guest links' })).toHaveCount(0);
});

test('SET-07 the people list shows each profile type', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.mantine-Badge-root', { hasText: 'admin' })).toBeVisible();
  await expect(page.locator('.mantine-Badge-root', { hasText: 'member' })).toBeVisible();
  await expect(page.locator('.mantine-Badge-root', { hasText: 'restricted' })).toBeVisible();
});
