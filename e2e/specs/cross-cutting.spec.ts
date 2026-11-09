import { AxeBuilder } from '@axe-core/playwright';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, test, ADMIN } from '../fixtures';
import { addGameViaUi, gameCards } from '../support/actions';
import { DATA_DIR } from '../support/env';
import { png } from '../support/images';

// ---------------------------------------------------------------------------------------------
// X-01 route x role matrix: every page renders (no console errors, thanks to the fixture guard)
// or redirects where it should.
// ---------------------------------------------------------------------------------------------

test('X-01 every route behaves correctly for every role @smoke', async ({
  page,
  memberPage,
  kidPage,
  anonPage,
  db,
}) => {
  const id = await db.seedGame({
    title: 'Matrix Game',
    shareable: true,
    copies: [{}],
    cover: true,
  });
  const token = await db.seedShareLink();

  const open = ['/games', `/games/${id}`, '/settings'];
  const writerOnly = [
    '/games/new',
    `/games/${id}/edit`,
    '/plays',
    '/loans',
    '/wishlist',
    '/import',
  ];

  for (const [who, p] of [
    ['admin', page],
    ['member', memberPage],
  ] as const) {
    for (const route of [...open, ...writerOnly]) {
      const res = await p.goto(route);
      expect(res?.status(), `${who} ${route}`).toBe(200);
      expect(new URL(p.url()).pathname, `${who} ${route}`).toBe(route);
      await expect(p.locator('h1').first(), `${who} ${route}`).toBeVisible();
    }
  }

  for (const route of open) {
    expect((await kidPage.goto(route))?.status(), `kid ${route}`).toBe(200);
    expect(new URL(kidPage.url()).pathname, `kid ${route}`).toBe(route);
  }
  const bounce: Record<string, string> = {
    '/games/new': '/games',
    [`/games/${id}/edit`]: `/games/${id}`,
    '/plays': '/games',
    '/loans': '/games',
    '/wishlist': '/games',
    '/import': '/games',
  };
  for (const [route, to] of Object.entries(bounce)) {
    await kidPage.goto(route);
    expect(new URL(kidPage.url()).pathname, `kid ${route}`).toBe(to);
  }

  for (const route of [...open, ...writerOnly, '/']) {
    await anonPage.goto(route);
    expect(new URL(anonPage.url()).pathname, `anon ${route}`).toBe('/login');
  }
  for (const route of [`/g/${token}`, `/g/${token}/${id}`]) {
    expect((await anonPage.goto(route))?.status(), `guest ${route}`).toBe(200);
    expect(new URL(anonPage.url()).pathname).toBe(route);
    await expect(anonPage.locator('h1').first()).toBeVisible();
  }
  expect((await anonPage.goto('/login'))?.status()).toBe(200);
});

test('X-01b the home page sends a signed-in user to the games list', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/games$/);
});

// ---------------------------------------------------------------------------------------------
// X-02 household isolation
// ---------------------------------------------------------------------------------------------

test('X-02 another household’s data is unreachable by every route @security', async ({
  page,
  anonPage,
  db,
}) => {
  const other = await db.seedOtherHousehold();
  await db.seedGame({ title: 'Our Game', shareable: true, tags: ['ours'] });
  const ours = await db.seedShareLink();

  await page.goto('/games');
  await expect(page.getByText('Our Game')).toBeVisible();
  await expect(page.getByText(other.title)).toHaveCount(0);
  await page.getByPlaceholder('Any tag').click();
  await expect(page.getByRole('option', { name: 'otherfam' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  expect((await page.goto(`/games/${other.gameId}`))?.status()).toBe(404);
  expect((await page.goto(`/games/${other.gameId}/edit`))?.status()).toBe(404);
  expect((await page.request.get(`/api/games/${other.gameId}/cover`)).status()).toBe(404);

  // The pick lists on other pages are ours only.
  await page.goto('/plays');
  await page.getByRole('combobox', { name: /^Game/ }).click();
  await expect(page.getByRole('option', { name: 'Our Game' })).toBeVisible();
  await expect(page.getByRole('option', { name: other.title })).toHaveCount(0);

  // Our guest link cannot reach their game even though it is marked shareable there.
  await anonPage.goto(`/g/${ours}`);
  await expect(anonPage.getByText('Our Game')).toBeVisible();
  await expect(anonPage.getByText(other.title)).toHaveCount(0);
  expect((await anonPage.goto(`/g/${ours}/${other.gameId}`))?.status()).toBe(404);
  expect((await anonPage.request.get(`/g/${ours}/cover/${other.gameId}`)).status()).toBe(404);
});

// ---------------------------------------------------------------------------------------------
// X-03 color scheme (regression: the inline script used to log a React 19 warning)
// ---------------------------------------------------------------------------------------------

test('X-03 the color scheme follows the system, honours a stored choice, and logs nothing', async ({
  anonPage,
}) => {
  const scheme = () => anonPage.locator('html').getAttribute('data-mantine-color-scheme');

  await anonPage.emulateMedia({ colorScheme: 'dark' });
  await anonPage.goto('/login');
  expect(await scheme()).toBe('dark');

  await anonPage.emulateMedia({ colorScheme: 'light' });
  await anonPage.reload();
  expect(await scheme()).toBe('light');

  await anonPage.evaluate(() => localStorage.setItem('mantine-color-scheme-value', 'dark'));
  await anonPage.reload();
  expect(await scheme()).toBe('dark');

  await anonPage.evaluate(() => localStorage.setItem('mantine-color-scheme-value', 'garbage'));
  await anonPage.reload();
  expect(await scheme()).toBe('light'); // falls back to the system setting
});

// ---------------------------------------------------------------------------------------------
// X-04 small screens
// ---------------------------------------------------------------------------------------------

test('X-04 on a phone the menu collapses and no page scrolls sideways', async ({ newPage, db }) => {
  const p = await newPage(ADMIN.storageState);
  await p.setViewportSize({ width: 390, height: 844 });
  const id = await db.seedGame({ title: 'Phone Game', copies: [{}] });

  await p.goto('/games');
  const navLink = p.locator('.mantine-AppShell-navbar').getByRole('link', { name: 'Settings' });
  await expect(navLink).not.toBeInViewport();
  await p.locator('.mantine-Burger-root').click();
  await expect(navLink).toBeInViewport();
  await navLink.click();
  await expect(p).toHaveURL(/\/settings$/);

  for (const route of [
    '/games',
    '/games/new',
    `/games/${id}`,
    '/settings',
    '/loans',
    '/plays',
    '/wishlist',
    '/import',
  ]) {
    await p.goto(route);
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

// ---------------------------------------------------------------------------------------------
// X-05 accessibility
// ---------------------------------------------------------------------------------------------

test('X-05 key pages have no serious or critical accessibility violations', async ({
  page,
  anonPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'A11y Game', shareable: true, copies: [{}], cover: true });
  const token = await db.seedShareLink();
  await db.seedWish('A wish');

  const targets: [string, import('@playwright/test').Page][] = [
    ['/login', anonPage],
    ['/games', page],
    [`/games/${id}`, page],
    ['/games/new', page],
    [`/games/${id}/edit`, page],
    ['/settings', page],
    ['/loans', page],
    ['/plays', page],
    ['/wishlist', page],
    ['/import', page],
    [`/g/${token}`, anonPage],
    [`/g/${token}/${id}`, anonPage],
  ];
  const problems: string[] = [];
  for (const [route, p] of targets) {
    await p.goto(route);
    const { violations } = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // tracked separately in X-05b
      .analyze();
    for (const v of violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      problems.push(`${route}: ${v.id} (${v.impact}) ${v.nodes.length}x - ${v.help}`);
    }
  }
  expect(problems).toEqual([]);
});

// Known gap: Mantine's default blue accents and dimmed text fall below WCAG AA contrast in places.
// Fixing it means choosing a darker primary shade and dimmed color in the theme.
test.fixme('X-05b key pages meet WCAG AA color contrast', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Contrast Game', copies: [{}] });
  const problems: string[] = [];
  for (const route of ['/games', `/games/${id}`, '/games/new', '/settings', '/import']) {
    await page.goto(route);
    const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    for (const v of violations) problems.push(`${route}: ${v.nodes.length}x`);
  }
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// X-06 keyboard
// ---------------------------------------------------------------------------------------------

test('X-06 a game can be added entirely from the keyboard', async ({ page, db }) => {
  await page.goto('/games/new');
  await page.getByLabel('Title *').focus();
  await page.keyboard.type('Keyboard Game');
  await page.keyboard.press('Enter'); // Enter in a text field submits the form
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  expect(await db.count('games', "title = 'Keyboard Game'")).toBe(1);
});

test('X-06b Escape closes an open dropdown without changing the choice', async ({ page }) => {
  await page.goto('/games/new');
  const type = page.getByRole('combobox', { name: 'Type' });
  await type.click();
  await expect(page.getByRole('option', { name: 'RPG' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { name: 'RPG' })).toHaveCount(0);
  await expect(type).toHaveValue('Board game');
});

// ---------------------------------------------------------------------------------------------
// X-08 .. X-11 operations
// ---------------------------------------------------------------------------------------------

test('X-08 the app migrated an empty database on start', async ({ db }) => {
  const rows = await db.sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  expect(rows[0]!.n).toBeGreaterThanOrEqual(4);
  expect(await db.count('households')).toBeGreaterThanOrEqual(1);
});

test('X-09 nothing a restricted viewer must not see is embedded in the pages they receive @security', async ({
  kidPage,
  db,
}) => {
  const open = await db.seedGame({ title: 'Open', tags: ['fine'], copies: [{}] });
  const secret = await db.seedGame({
    title: 'Zq-Forbidden-Title',
    visibility: 'hidden_restricted',
    notes: 'Zq-forbidden-note',
    description: 'Zq-forbidden-description',
    tags: ['zq-forbidden-tag'],
    cover: true,
  });
  const hiddenLoc = await db.seedLocation('Zq-location');
  await db.seedCopy(secret, { locationId: hiddenLoc });

  for (const url of ['/games', `/games/${open}`, '/settings', '/games?q=zq']) {
    const body = await (await kidPage.request.get(url)).text();
    for (const needle of [
      'Zq-Forbidden-Title',
      'Zq-forbidden-note',
      'Zq-forbidden-description',
      'zq-forbidden-tag',
      secret,
    ]) {
      expect(body, `${url} contains ${needle}`).not.toContain(needle);
    }
  }
});

test('X-10 unknown routes get the 404 page', async ({ page, anonPage }) => {
  expect((await page.goto('/definitely/not/a/page'))?.status()).toBe(404);
  expect((await anonPage.goto('/definitely/not/a/page'))?.status()).toBe(404);
});

test('X-11 cover files live under DATA_DIR and are removed with their game', async ({
  page,
  db,
}) => {
  const id = await addGameViaUi(page, { title: 'Stored Cover', cover: png() });
  const [row] = await db.sql`select cover_image from games where id = ${id}`;
  const file = path.join(DATA_DIR, row!.cover_image as string);
  expect(file.startsWith(DATA_DIR)).toBe(true);
  expect(existsSync(file)).toBe(true);

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  expect(existsSync(file)).toBe(false);
  await expect(gameCards(page)).toHaveCount(0);
});

test('X-12 cover URLs cannot be used to read other files', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Traversal' });
  await db.sql`update games set cover_image = '../../package.json' where id = ${id}`;
  const res = await page.request.get(`/api/games/${id}/cover`);
  expect(res.status()).toBe(404);
});
