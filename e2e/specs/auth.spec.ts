import { createHash } from 'node:crypto';

import { expect, test, ADMIN } from '../fixtures';
import { login } from '../support/auth';
import { PASSWORD } from '../support/mantine';

const UUID = '00000000-0000-4000-8000-000000000000';

test('AUTH-04 setup is closed once a household exists @smoke', async ({ anonPage }) => {
  await anonPage.goto('/setup');
  await expect(anonPage).toHaveURL(/\/login$/);
});

test('AUTH-05 login works and the email is case-insensitive @smoke', async ({ anonPage }) => {
  await login(anonPage, { email: ADMIN.email.toUpperCase(), password: ADMIN.password });
  await expect(anonPage.getByText(ADMIN.name)).toBeVisible();
});

test('AUTH-06 wrong password and unknown email give the same generic error', async ({
  anonPage,
}) => {
  const attempt = async (email: string, password: string) => {
    await anonPage.goto('/login');
    await anonPage.getByLabel('Email').fill(email);
    await anonPage.getByLabel(PASSWORD).fill(password);
    await anonPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(anonPage.getByText('Incorrect email or password.')).toBeVisible();
    await expect(anonPage).toHaveURL(/\/login$/);
  };
  await attempt(ADMIN.email, 'definitely-wrong');
  await attempt('nobody@e2e.test', 'definitely-wrong');
});

test('AUTH-07 sign out ends the session', async ({ anonPage }) => {
  await login(anonPage, ADMIN); // a fresh session, so the shared admin session is untouched
  await anonPage.getByRole('button', { name: 'Sign out' }).click();
  await expect(anonPage).toHaveURL(/\/login$/);
  await anonPage.goto('/games');
  await expect(anonPage).toHaveURL(/\/login$/);
  const cookies = await anonPage.context().cookies();
  expect(cookies.find((c) => c.name === 'gi_session')).toBeUndefined();
});

test('AUTH-08 every app route redirects anonymous visitors to /login @smoke', async ({
  anonPage,
}) => {
  for (const route of [
    '/',
    '/games',
    '/games/new',
    `/games/${UUID}`,
    `/games/${UUID}/edit`,
    '/plays',
    '/loans',
    '/wishlist',
    '/import',
    '/settings',
  ]) {
    await anonPage.goto(route);
    await expect(anonPage, route).toHaveURL(/\/login$/);
  }
});

test('AUTH-09 anonymous API calls are rejected', async ({ anonPage }) => {
  for (const url of [
    `/api/games/${UUID}/cover`,
    '/api/lookup/bgg?q=catan',
    '/api/lookup/upc?code=012345678905',
  ]) {
    const res = await anonPage.request.get(url);
    expect(res.status(), url).toBe(401);
  }
});

test('AUTH-10 session cookie is httpOnly, SameSite=Lax and not Secure by default', async ({
  anonPage,
}) => {
  await login(anonPage, ADMIN);
  const cookie = (await anonPage.context().cookies()).find((c) => c.name === 'gi_session');
  expect(cookie).toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe('Lax');
  expect(cookie!.secure).toBe(false);
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000);
});

test('AUTH-11 an expired session is rejected', async ({ anonPage, db }) => {
  await login(anonPage, ADMIN);
  const token = (await anonPage.context().cookies()).find((c) => c.name === 'gi_session')!.value;
  const id = createHash('sha256').update(token).digest('hex');
  await db.sql`update sessions set expires_at = now() - interval '1 hour' where id = ${id}`;
  await anonPage.goto('/games');
  await expect(anonPage).toHaveURL(/\/login$/);
});

test('AUTH-12 a tampered or random session cookie counts as signed out', async ({ anonPage }) => {
  await anonPage.goto('/login');
  await anonPage
    .context()
    .addCookies([{ name: 'gi_session', value: 'not-a-real-token', url: anonPage.url() }]);
  await anonPage.goto('/games');
  await expect(anonPage).toHaveURL(/\/login$/);
});

test('AUTH-13 a deleted session stops working immediately', async ({ anonPage, db }) => {
  await login(anonPage, ADMIN);
  const token = (await anonPage.context().cookies()).find((c) => c.name === 'gi_session')!.value;
  const id = createHash('sha256').update(token).digest('hex');
  await db.sql`delete from sessions where id = ${id}`;
  await anonPage.reload();
  await expect(anonPage).toHaveURL(/\/login$/);
});
