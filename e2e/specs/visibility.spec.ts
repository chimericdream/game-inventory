// Household visibility: what a restricted (kid) profile can and cannot see or do.
// Enforcement is checked at the server (URLs, endpoints, raw HTML, replayed requests), not just in the UI.
import { expect, test } from '../fixtures';
import { captureAction, fillGameForm, gameCards, replayAction } from '../support/actions';
import { choose } from '../support/mantine';

const NOTE = 'PRIVATE-NOTE-for-parents';
const HIDDEN_TAG = 'secret-tag-xyz';

async function seed(db: typeof import('../support/db')) {
  const normal = await db.seedGame({
    title: 'Open Game',
    cover: true,
    notes: NOTE,
    tags: ['family'],
    copies: [{ priceCents: 4242 }],
  });
  const noImages = await db.seedGame({
    title: 'No Pictures Game',
    visibility: 'hide_images',
    cover: true,
  });
  const hidden = await db.seedGame({
    title: 'Secret Game',
    visibility: 'hidden_restricted',
    cover: true,
    notes: NOTE,
    tags: [HIDDEN_TAG],
    copies: [{ priceCents: 9999 }],
  });
  return { normal, noImages, hidden };
}

test('VIS-01 a restricted list shows normal and hide-images games but not hidden ones @security @smoke', async ({
  kidPage,
  db,
}) => {
  await seed(db);
  await kidPage.goto('/games');
  await expect(gameCards(kidPage)).toHaveCount(2);
  await expect(kidPage.getByText('Open Game')).toBeVisible();
  await expect(kidPage.getByText('No Pictures Game')).toBeVisible();
  await expect(kidPage.getByText('Secret Game')).toHaveCount(0);
  await expect(kidPage.getByText('2 games', { exact: true })).toBeVisible();
});

test('VIS-02 search and filters never surface a hidden game @security', async ({ kidPage, db }) => {
  await seed(db);
  await kidPage.goto('/games?q=Secret');
  await expect(kidPage.getByText('No games match.')).toBeVisible();
  await kidPage.goto(`/games?tag=${HIDDEN_TAG}`);
  await expect(kidPage.getByText('No games match.')).toBeVisible();
  await kidPage.goto('/games?q=game');
  await expect(gameCards(kidPage)).toHaveCount(2);
});

test('VIS-02b the tag list does not reveal tags used only on hidden games @security', async ({
  kidPage,
  db,
}) => {
  await seed(db);
  await kidPage.goto('/games');
  await kidPage.getByPlaceholder('Any tag').click();
  await expect(kidPage.getByRole('option', { name: 'family' })).toBeVisible();
  await expect(kidPage.getByRole('option', { name: HIDDEN_TAG })).toHaveCount(0);
  const html = await (await kidPage.request.get('/games')).text();
  expect(html).not.toContain(HIDDEN_TAG);
});

test('VIS-03 a hidden game’s own URL is a 404 for a restricted profile @security', async ({
  kidPage,
  db,
}) => {
  const { hidden } = await seed(db);
  const res = await kidPage.goto(`/games/${hidden}`);
  expect(res?.status()).toBe(404);
});

test('VIS-04 a hidden game’s cover is not served to a restricted profile @security', async ({
  kidPage,
  db,
}) => {
  const { hidden } = await seed(db);
  expect((await kidPage.request.get(`/api/games/${hidden}/cover`)).status()).toBe(404);
});

test('VIS-05 hide-images keeps the title but withholds the picture everywhere @security', async ({
  kidPage,
  db,
}) => {
  const { noImages, normal } = await seed(db);
  await kidPage.goto('/games');
  const card = gameCards(kidPage).filter({ hasText: 'No Pictures Game' });
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveCount(0);
  await expect(gameCards(kidPage).filter({ hasText: 'Open Game' }).locator('img')).toHaveCount(1);

  await kidPage.goto(`/games/${noImages}`);
  await expect(kidPage.getByRole('heading', { name: 'No Pictures Game' })).toBeVisible();
  await expect(kidPage.locator('img')).toHaveCount(0);
  expect((await kidPage.request.get(`/api/games/${noImages}/cover`)).status()).toBe(404);
  expect((await kidPage.request.get(`/api/games/${normal}/cover`)).status()).toBe(200);
});

test('VIS-06 admins and members see everything, including hidden games and every cover @security', async ({
  page,
  memberPage,
  db,
}) => {
  const { hidden, noImages } = await seed(db);
  for (const p of [page, memberPage]) {
    await p.goto('/games');
    await expect(gameCards(p)).toHaveCount(3);
    await expect(p.getByText('Secret Game')).toBeVisible();
    expect((await p.request.get(`/api/games/${hidden}/cover`)).status()).toBe(200);
    expect((await p.request.get(`/api/games/${noImages}/cover`)).status()).toBe(200);
  }
});

test('VIS-07 a restricted profile has no edit controls and the private notes are not in the page @security', async ({
  kidPage,
  db,
}) => {
  const { normal } = await seed(db);
  await kidPage.goto(`/games/${normal}`);
  await expect(kidPage.getByRole('heading', { name: 'Open Game' })).toBeVisible();
  for (const name of ['Edit', 'Delete', 'Add copy', 'Delete copy']) {
    await expect(kidPage.getByRole('button', { name })).toHaveCount(0);
    await expect(kidPage.getByRole('link', { name })).toHaveCount(0);
  }
  await expect(kidPage.getByText(NOTE)).toHaveCount(0);
  const raw = await (await kidPage.request.get(`/games/${normal}`)).text();
  expect(raw).not.toContain(NOTE);

  await kidPage.goto('/games');
  await expect(kidPage.getByRole('link', { name: 'Add game' })).toHaveCount(0);
});

test('VIS-07b the edit and add pages bounce a restricted profile', async ({ kidPage, db }) => {
  const { normal } = await seed(db);
  await kidPage.goto(`/games/${normal}/edit`);
  await expect(kidPage).toHaveURL(new RegExp(`/games/${normal}$`));
  await kidPage.goto('/games/new');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('VIS-08 replaying an admin’s edit, delete, or add-copy request as a restricted profile changes nothing @security', async ({
  page,
  kidPage,
  issues,
  db,
}) => {
  const { normal } = await seed(db);

  // Edit: admin edits the title, the request is captured instead of sent.
  await page.goto(`/games/${normal}/edit`);
  await fillGameForm(page, { title: 'HACKED TITLE' });
  const edit = await captureAction(page, issues, () =>
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  );
  const editRes = await replayAction(kidPage.request, edit);
  expect(editRes.status()).toBeLessThan(600);
  const [afterEdit] = await db.sql`select title from games where id = ${normal}`;
  expect(afterEdit!.title).toBe('Open Game');

  // Delete
  await page.goto(`/games/${normal}`);
  const del = await captureAction(page, issues, () =>
    page.getByRole('button', { name: 'Delete', exact: true }).click(),
  );
  await replayAction(kidPage.request, del);
  expect(await db.count('games', `id = '${normal}'`)).toBe(1);

  // Add copy
  await page.goto(`/games/${normal}`);
  const before = await db.count('copies');
  const add = await captureAction(page, issues, () =>
    page.getByRole('button', { name: 'Add copy' }).click(),
  );
  await replayAction(kidPage.request, add);
  expect(await db.count('copies')).toBe(before);

  // Control: the same captured request does work for the admin, so the checks above mean something.
  const adminRes = await replayAction(page.request, add);
  expect(adminRes.status()).toBeLessThan(500);
  expect(await db.count('copies')).toBe(before + 1);
});

test('VIS-09 areas a restricted profile cannot use send it back to the games list @security', async ({
  kidPage,
  db,
}) => {
  await seed(db);
  for (const route of ['/plays', '/loans', '/wishlist', '/import', '/games/new']) {
    await kidPage.goto(route);
    await expect(kidPage, route).toHaveURL(/\/games$/);
  }
});

test('VIS-10 a restricted profile cannot reach the lookup endpoints @security', async ({
  kidPage,
}) => {
  expect((await kidPage.request.get('/api/lookup/bgg?q=catan')).status()).toBe(403);
  expect((await kidPage.request.get('/api/lookup/upc?code=012345678905')).status()).toBe(403);
});

test('VIS-11 changing a game’s visibility takes effect on the next request @security', async ({
  page,
  kidPage,
  db,
}) => {
  const { normal } = await seed(db);
  await kidPage.goto('/games');
  await expect(kidPage.getByText('Open Game')).toBeVisible();

  await page.goto(`/games/${normal}/edit`);
  await choose(
    page,
    page,
    'Visibility in this household',
    'Hide entirely from restricted profiles',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/games/${normal}$`));

  await kidPage.reload();
  await expect(kidPage.getByText('Open Game')).toHaveCount(0);
  expect((await kidPage.goto(`/games/${normal}`))?.status()).toBe(404);
  expect((await kidPage.request.get(`/api/games/${normal}/cover`)).status()).toBe(404);
});

test('VIS-12 the navigation only offers a restricted profile what it can use', async ({
  kidPage,
  page,
}) => {
  await kidPage.goto('/games');
  const nav = kidPage.locator('nav, .mantine-AppShell-navbar');
  await expect(nav.getByRole('link', { name: 'Games' })).toBeVisible();
  for (const name of ['Play log', 'Loans', 'Wishlist', 'Import']) {
    await expect(nav.getByRole('link', { name })).toHaveCount(0);
  }
  await page.goto('/games');
  for (const name of ['Games', 'Play log', 'Loans', 'Wishlist', 'Import', 'Settings']) {
    await expect(
      page.locator('.mantine-AppShell-navbar').getByRole('link', { name }),
    ).toBeVisible();
  }
});
