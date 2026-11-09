// Guest share links. Every guest check runs in a cookie-less browser context.
import { createHash } from 'node:crypto';

import { expect, test, ADMIN } from '../fixtures';
import { captureAction, gameCards, replayAction } from '../support/actions';
import { formWith } from '../support/mantine';

const NOTE = 'GUEST-HIDDEN-NOTE';
const PRICE_CENTS = 2999;

/** One game per rule, so each test can assert on exactly the games it cares about. */
async function seed(db: typeof import('../support/db')) {
  const hall = await db.seedLocation('Hall closet');
  const shown = await db.seedGame({
    title: 'Shown Game',
    shareable: true,
    cover: true,
    notes: NOTE,
    description: 'A nice family game.',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 30,
    tags: ['family'],
    copies: [
      {
        priceCents: PRICE_CENTS,
        condition: 'incomplete',
        ownerEmail: 'member@e2e.test',
        locationId: hall,
        platform: 'Tabletop',
      },
    ],
  });
  const privateGame = await db.seedGame({ title: 'Private Game', shareable: false, cover: true });
  const kidHidden = await db.seedGame({
    title: 'Kid Hidden Game',
    shareable: true,
    visibility: 'hidden_restricted',
    cover: true,
  });
  const noImages = await db.seedGame({
    title: 'No Pictures Guest Game',
    shareable: true,
    visibility: 'hide_images',
    cover: true,
  });
  const rpg = await db.seedGame({
    title: 'Shared RPG',
    type: 'rpg',
    shareable: true,
    tags: ['rules'],
  });
  const adult = await db.seedGame({ title: 'Adult Game', shareable: true, tags: ['Adult'] });
  return { shown, privateGame, kidHidden, noImages, rpg, adult };
}

test('GST-01 an admin creates a link, sees the URL once, and the link works for a guest @security @smoke', async ({
  page,
  anonPage,
  db,
}) => {
  await seed(db);
  await page.goto('/settings?tab=links');
  const form = formWith(page, 'Create link');
  await form.getByLabel('Name').fill('Game store trip');
  await form.getByRole('button', { name: 'Create link' }).click();

  await expect(page.getByText(/Link created/)).toBeVisible();
  const url = (await page.locator('text=/\\/g\\/[A-Za-z0-9_-]+/').first().innerText()).trim();
  expect(url).toMatch(/\/g\/[A-Za-z0-9_-]{20,}$/);
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByText('Game store trip')).toBeVisible();
  await expect(page.locator('.mantine-Badge-root', { hasText: 'Active' })).toBeVisible();

  await anonPage.goto(url);
  await expect(anonPage.getByText('Shared with you · Game store trip')).toBeVisible();
  await expect(anonPage.getByText('Shown Game')).toBeVisible();

  // The raw token is never shown again.
  await page.reload();
  await expect(page.getByText(url)).toHaveCount(0);
  await expect(page.getByText(/Link created/)).toHaveCount(0);
});

test('GST-02 a guest sees only shareable games, never others, by list, search, or direct URL @security', async ({
  anonPage,
  db,
}) => {
  const ids = await seed(db);
  const token = await db.seedShareLink();
  await anonPage.goto(`/g/${token}`);
  await expect(gameCards(anonPage)).toHaveCount(4); // shown, no-pictures, rpg, adult
  await expect(anonPage.getByText('Private Game')).toHaveCount(0);
  await expect(anonPage.getByText('Kid Hidden Game')).toHaveCount(0);

  await anonPage.goto(`/g/${token}?q=Private`);
  await expect(anonPage.getByText('No games to show.')).toBeVisible();

  for (const id of [ids.privateGame, ids.kidHidden]) {
    expect((await anonPage.goto(`/g/${token}/${id}`))?.status(), id).toBe(404);
  }
  expect((await anonPage.goto(`/g/${token}/${ids.shown}`))?.status()).toBe(200);
});

test('GST-03 a link can hide whole types and games with certain tags @security', async ({
  anonPage,
  db,
}) => {
  await seed(db);
  const noRpg = await db.seedShareLink({ hideTypes: ['rpg'] });
  await anonPage.goto(`/g/${noRpg}`);
  await expect(anonPage.getByText('Shared RPG')).toHaveCount(0);
  await expect(gameCards(anonPage)).toHaveCount(3);

  const noAdult = await db.seedShareLink({ hideTags: ['adult'] }); // tag matching ignores case
  await anonPage.goto(`/g/${noAdult}`);
  await expect(anonPage.getByText('Adult Game')).toHaveCount(0);
  await expect(gameCards(anonPage)).toHaveCount(3);
});

test('GST-04 notes and locations stay hidden unless the link opts in, each on its own @security', async ({
  anonPage,
  db,
}) => {
  const { shown } = await seed(db);
  const none = await db.seedShareLink();
  const notesOnly = await db.seedShareLink({ showNotes: true });
  const locationsOnly = await db.seedShareLink({ showLocations: true });

  await anonPage.goto(`/g/${none}/${shown}`);
  await expect(anonPage.getByRole('heading', { name: 'Shown Game' })).toBeVisible();
  await expect(anonPage.getByText(NOTE)).toHaveCount(0);
  await expect(anonPage.getByText('Kept in')).toHaveCount(0);

  await anonPage.goto(`/g/${notesOnly}/${shown}`);
  await expect(anonPage.getByText(NOTE)).toBeVisible();
  await expect(anonPage.getByText('Kept in')).toHaveCount(0);

  await anonPage.goto(`/g/${locationsOnly}/${shown}`);
  await expect(anonPage.getByText('Kept in: Hall closet')).toBeVisible();
  await expect(anonPage.getByText(NOTE)).toHaveCount(0);
});

test('GST-05 private fields never appear anywhere in what a guest receives @security', async ({
  anonPage,
  db,
}) => {
  const ids = await seed(db);
  const token = await db.seedShareLink();
  const pages = [`/g/${token}`, `/g/${token}/${ids.shown}`, `/g/${token}?q=shown`];
  for (const url of pages) {
    const body = await (await anonPage.request.get(url)).text();
    for (const secret of [
      NOTE,
      String(PRICE_CENTS),
      '29.99',
      'incomplete', // condition
      'Mo Member', // owner
      'member@e2e.test',
      'Hall closet', // location, opt-in only
      ids.privateGame,
      ids.kidHidden,
      'Private Game',
      'Kid Hidden Game',
      'household_id',
      'passwordHash',
    ]) {
      expect(body, `${url} must not contain ${secret}`).not.toContain(secret);
    }
  }
});

test('GST-06 guest search narrows the list @security', async ({ anonPage, db }) => {
  await seed(db);
  const token = await db.seedShareLink();
  await anonPage.goto(`/g/${token}`);
  await anonPage.getByPlaceholder('Search titles').fill('rpg');
  await expect(anonPage).toHaveURL(/q=rpg/);
  await expect(gameCards(anonPage)).toHaveCount(1);
  await expect(gameCards(anonPage)).toContainText('Shared RPG');
});

test('GST-07 guest covers are served only for games the guest may see @security', async ({
  anonPage,
  db,
}) => {
  const ids = await seed(db);
  const token = await db.seedShareLink();
  const ok = await anonPage.request.get(`/g/${token}/cover/${ids.shown}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()['content-type']).toBe('image/png');

  for (const id of [
    ids.privateGame,
    ids.kidHidden,
    ids.noImages, // hide-images applies to guests too
    '00000000-0000-4000-8000-000000000000',
    'not-a-uuid',
  ]) {
    expect((await anonPage.request.get(`/g/${token}/cover/${id}`)).status(), id).toBe(404);
  }
  expect((await anonPage.request.get(`/g/bogus-token/cover/${ids.shown}`)).status()).toBe(404);
});

test('GST-08 an expired link stops working and is labelled as expired @security', async ({
  page,
  anonPage,
  db,
}) => {
  const { shown } = await seed(db);
  const expired = await db.seedShareLink({
    label: 'Old link',
    expiresAt: new Date(Date.now() - 3_600_000),
  });
  const live = await db.seedShareLink({
    label: 'Future link',
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  expect((await anonPage.goto(`/g/${expired}`))?.status()).toBe(404);
  expect((await anonPage.goto(`/g/${expired}/${shown}`))?.status()).toBe(404);
  expect((await anonPage.request.get(`/g/${expired}/cover/${shown}`)).status()).toBe(404);
  expect((await anonPage.goto(`/g/${live}`))?.status()).toBe(200);

  await page.goto('/settings?tab=links');
  const oldRow = page.locator('.mantine-Paper-root', { hasText: 'Old link' });
  await expect(oldRow.locator('.mantine-Badge-root')).toHaveText('Expired');
  await expect(oldRow.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
  await expect(
    page.locator('.mantine-Paper-root', { hasText: 'Future link' }).locator('.mantine-Badge-root'),
  ).toHaveText('Active');
});

test('GST-09 revoking a link ends access immediately @security', async ({ page, anonPage, db }) => {
  await seed(db);
  const token = await db.seedShareLink({ label: 'To revoke' });
  expect((await anonPage.goto(`/g/${token}`))?.status()).toBe(200);

  await page.goto('/settings?tab=links');
  const row = page.locator('.mantine-Paper-root', { hasText: 'To revoke' });
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row.locator('.mantine-Badge-root')).toHaveText('Revoked');

  expect((await anonPage.goto(`/g/${token}`))?.status()).toBe(404);
});

test('GST-10 unknown tokens are a 404 and guest pages ask not to be indexed @security', async ({
  anonPage,
  db,
}) => {
  await seed(db);
  for (const bad of ['nope', 'x'.repeat(500), '%20', '....']) {
    expect((await anonPage.goto(`/g/${bad}`))?.status(), bad).toBe(404);
  }
  const token = await db.seedShareLink();
  await anonPage.goto(`/g/${token}`);
  await expect(anonPage.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('GST-11 a guest link grants no access to the household app @security', async ({
  anonPage,
  db,
}) => {
  const ids = await seed(db);
  const token = await db.seedShareLink();
  await anonPage.goto(`/g/${token}`);
  for (const route of ['/games', `/games/${ids.shown}`, '/settings', '/loans']) {
    await anonPage.goto(route);
    await expect(anonPage, route).toHaveURL(/\/login$/);
  }
  expect((await anonPage.request.get(`/api/games/${ids.shown}/cover`)).status()).toBe(401);
});

test('GST-12 only a hash of the token is stored @security', async ({ page, db }) => {
  await page.goto('/settings?tab=links');
  const form = formWith(page, 'Create link');
  await form.getByLabel('Name').fill('Hash check');
  await form.getByRole('button', { name: 'Create link' }).click();
  const url = (await page.locator('text=/\\/g\\/[A-Za-z0-9_-]+/').first().innerText()).trim();
  const token = url.split('/g/')[1]!;

  const [row] = await db.sql`select * from share_links where label = 'Hash check'`;
  expect(row!.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(JSON.stringify(row)).not.toContain(token);
});

test('GST-13 two links with different rules behave independently @security', async ({
  anonPage,
  db,
}) => {
  await seed(db);
  const a = await db.seedShareLink({ hideTypes: ['rpg'] });
  const b = await db.seedShareLink({ hideTags: ['family'] });
  await anonPage.goto(`/g/${a}`);
  await expect(anonPage.getByText('Shown Game')).toBeVisible();
  await expect(anonPage.getByText('Shared RPG')).toHaveCount(0);
  await anonPage.goto(`/g/${b}`);
  await expect(anonPage.getByText('Shown Game')).toHaveCount(0);
  await expect(anonPage.getByText('Shared RPG')).toBeVisible();
});

test('GST-14 only admins can create or revoke links, even by replaying the request @security', async ({
  page,
  memberPage,
  kidPage,
  issues,
  db,
}) => {
  await page.goto('/settings?tab=links');
  const form = formWith(page, 'Create link');
  await form.getByLabel('Name').fill('Replay me');
  const create = await captureAction(page, issues, () =>
    form.getByRole('button', { name: 'Create link' }).click(),
  );
  for (const who of [memberPage, kidPage]) {
    await replayAction(who.request, create);
    expect(await db.count('share_links')).toBe(0);
  }
  // Control: the admin can.
  await replayAction(page.request, create);
  expect(await db.count('share_links')).toBe(1);

  // Revoke
  await page.goto('/settings?tab=links');
  const revoke = await captureAction(page, issues, () =>
    page.getByRole('button', { name: 'Revoke' }).click(),
  );
  for (const who of [memberPage, kidPage]) {
    await replayAction(who.request, revoke);
    expect(await db.count('share_links', 'revoked_at is not null')).toBe(0);
  }
  await replayAction(page.request, revoke);
  expect(await db.count('share_links', 'revoked_at is not null')).toBe(1);
});

test('GST-15 un-sharing or deleting a game removes it from existing links at once @security', async ({
  anonPage,
  db,
}) => {
  const { shown, rpg } = await seed(db);
  const token = await db.seedShareLink();
  expect((await anonPage.goto(`/g/${token}/${shown}`))?.status()).toBe(200);

  await db.sql`update games set shareable = false where id = ${shown}`;
  expect((await anonPage.goto(`/g/${token}/${shown}`))?.status()).toBe(404);
  expect((await anonPage.request.get(`/g/${token}/cover/${shown}`)).status()).toBe(404);

  await db.sql`delete from games where id = ${rpg}`;
  expect((await anonPage.goto(`/g/${token}/${rpg}`))?.status()).toBe(404);
});

test('GST-16 the household’s admin keeps full access to games guests cannot see', async ({
  page,
  db,
}) => {
  const { privateGame } = await seed(db);
  await page.goto(`/games/${privateGame}`);
  await expect(page.getByRole('heading', { name: 'Private Game' })).toBeVisible();
  expect(ADMIN.role).toBe('admin');
});
