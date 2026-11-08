// Runs once, first, against an empty database. Covers the first-run flow (AUTH-01..03), then
// creates the member and restricted accounts and saves a logged-in storage state per role so
// every other spec can start already signed in.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { login } from '../support/auth';
import { sql } from '../support/db';
import { BASE_URL } from '../support/env';
import { PASSWORD, choose, formWith } from '../support/mantine';
import { ACCOUNTS, ADMIN, KID, MEMBER } from '../support/roles';

test.describe.configure({ mode: 'serial' });

for (const a of ACCOUNTS) mkdirSync(path.dirname(a.storageState), { recursive: true });

test.use({ storageState: { cookies: [], origins: [] } });

test('AUTH-01 empty database sends every entry point to /setup @smoke', async ({ page }) => {
  for (const entry of ['/', '/games', '/login', '/settings']) {
    await page.goto(entry);
    await expect(page).toHaveURL(/\/setup$/);
  }
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

test('AUTH-03 setup validation creates nothing', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Household name').fill('E2E House');
  await page.getByLabel('Your name').fill(ADMIN.name);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel(PASSWORD).fill('short');
  await page.getByRole('button', { name: 'Create household' }).click();
  await expect(page.getByText('Use at least 8 characters')).toBeVisible();
  await expect(page).toHaveURL(/\/setup$/);

  // The browser itself blocks an invalid email address, so the form is never submitted.
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel(PASSWORD).fill('long-enough-pass');
  await page.getByRole('button', { name: 'Create household' }).click();
  await expect(page).toHaveURL(/\/setup$/);

  const [row] = await sql`select count(*)::int as n from users`;
  expect(row!.n).toBe(0);
});

test('AUTH-02 setup creates the household and admin and signs in @smoke', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Household name').fill('E2E House');
  await page.getByLabel('Your name').fill(ADMIN.name);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel(PASSWORD).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create household' }).click();

  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible();
  await expect(page.getByText(ADMIN.name)).toBeVisible();

  const [user] = await sql`select role from users where email = ${ADMIN.email}`;
  expect(user!.role).toBe('admin');
  await page.context().storageState({ path: ADMIN.storageState });
});

test('SET-01 admin adds a member and a restricted profile', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: ADMIN.storageState });
  const page = await context.newPage();
  await page.goto('/settings');

  for (const [account, profile] of [
    [MEMBER, 'Member'],
    [KID, 'Restricted (kids)'],
  ] as const) {
    const form = formWith(page, 'Add person');
    await form.getByLabel('Name').fill(account.name);
    await form.getByLabel('Email').fill(account.email);
    await form.getByLabel(PASSWORD).fill(account.password);
    await choose(page, form, 'Profile', profile);
    await form.getByRole('button', { name: 'Add person' }).click();
    await expect(page.getByText(account.name)).toBeVisible();
  }
  await context.close();
});

test('save a logged-in state for the member and restricted accounts', async ({ browser }) => {
  for (const account of [MEMBER, KID]) {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await login(page, account);
    await context.storageState({ path: account.storageState });
    await context.close();
  }
});
