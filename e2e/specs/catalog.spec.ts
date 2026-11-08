import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '../fixtures';
import { addGameViaUi, fillGameForm, gameCards } from '../support/actions';
import { DATA_DIR } from '../support/env';
import { fakePng, oversizePng, png, TINY_PNG, textFile } from '../support/images';
import { choose, label } from '../support/mantine';

const SAVE = { name: 'Save', exact: true } as const;
const MISSING = '00000000-0000-4000-8000-000000000000';

test('CAT-01 add a board game with every field and see it on the detail page @smoke', async ({
  page,
}) => {
  await addGameViaUi(page, {
    title: 'Catan',
    type: 'Board game',
    minPlayers: 3,
    maxPlayers: 4,
    playTime: 90,
    complexity: 3,
    minAge: 10,
    tags: 'strategy, trading',
    description: 'Trade and build.',
    notes: 'Missing one road piece.',
  });
  await expect(page.getByRole('heading', { name: 'Catan' })).toBeVisible();
  await expect(page.getByText('3–4 players · 90 min · Complexity 3/5 · Ages 10+')).toBeVisible();
  await expect(page.getByText('Trade and build.')).toBeVisible();
  await expect(page.getByText('Missing one road piece.')).toBeVisible();
  await expect(page.getByText('strategy', { exact: true })).toBeVisible();
  await expect(page.getByText('trading', { exact: true })).toBeVisible();
  await expect(page.getByText('Board game', { exact: true })).toBeVisible();
});

test('CAT-02 type-specific fields follow the chosen type', async ({ page }) => {
  await page.goto('/games/new');
  const boardOnly = [
    'Min players',
    'Max players',
    'Play time (min)',
    'Complexity (1–5)',
    'Min age',
  ];

  for (const type of ['Board game', 'Card game'] as const) {
    await choose(page, page, 'Type', type);
    for (const f of boardOnly) await expect(page.getByLabel(f)).toBeVisible();
    await expect(page.getByLabel('System')).toHaveCount(0);
  }
  await choose(page, page, 'Type', 'RPG');
  await expect(page.getByLabel('System')).toBeVisible();
  await expect(page.getByLabel('Book kind')).toBeVisible();
  await expect(page.getByLabel('Min players')).toHaveCount(0);

  for (const type of ['Video game', 'Puzzle', 'Other'] as const) {
    await choose(page, page, 'Type', type);
    await expect(page.getByLabel('System')).toHaveCount(0);
    await expect(page.getByLabel('Min players')).toHaveCount(0);
  }
});

test('CAT-02b RPG and video game save with their own details', async ({ page }) => {
  await addGameViaUi(page, {
    title: 'Player Handbook',
    type: 'RPG',
    system: 'D&D 5e',
    bookKind: 'Core rulebook',
  });
  await expect(page.getByText('D&D 5e · Core rulebook')).toBeVisible();

  await addGameViaUi(page, { title: 'Zelda', type: 'Video game' });
  await expect(page.getByRole('heading', { name: 'Zelda' })).toBeVisible();
  await expect(page.getByText('Video game', { exact: true })).toBeVisible();
});

test('CAT-03 a blank title is rejected and nothing is created', async ({ page, db }) => {
  await page.goto('/games/new');
  await page.getByLabel(label('Title')).fill('   ');
  await page.getByRole('button', SAVE).click();
  await expect(page.locator('.mantine-Alert-root')).toContainText(/title is required/i);
  expect(await db.count('games')).toBe(0);
});

test('CAT-03b a title over 200 characters is rejected, exactly 200 is accepted', async ({
  page,
  db,
}) => {
  await page.goto('/games/new');
  await page.getByLabel(label('Title')).fill('x'.repeat(201));
  await page.getByRole('button', SAVE).click();
  await expect(page.locator('.mantine-Alert-root')).toBeVisible();
  expect(await db.count('games')).toBe(0);

  await page.getByLabel(label('Title')).fill('y'.repeat(200));
  await page.getByRole('button', SAVE).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  expect(await db.count('games')).toBe(1);
});

test('CAT-04 edit a game: values are prefilled, changes persist, tag casing is deduplicated', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({
    title: 'Pandemic',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 45,
    description: 'Cure diseases.',
    tags: ['coop', 'medical'],
  });
  await page.goto(`/games/${id}/edit`);
  await expect(page.getByLabel(label('Title'))).toHaveValue('Pandemic');
  await expect(page.getByLabel('Min players')).toHaveValue('2');
  await expect(page.getByLabel('Tags')).toHaveValue(/coop/);

  await fillGameForm(page, {
    title: 'Pandemic Legacy',
    tags: 'Co-op, co-op, legacy',
    maxPlayers: 5,
  });
  await page.getByRole('button', SAVE).click();

  await expect(page).toHaveURL(new RegExp(`/games/${id}$`));
  await expect(page.getByRole('heading', { name: 'Pandemic Legacy' })).toBeVisible();
  await expect(page.getByText('2–5 players')).toBeVisible();
  await expect(page.getByText('Co-op', { exact: true })).toBeVisible();
  await expect(page.getByText('legacy', { exact: true })).toBeVisible();
  await expect(page.getByText('medical', { exact: true })).toHaveCount(0);
});

test('CAT-05 delete a game: it disappears, its URL is gone, its copies go with it', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Doomed', copies: [{}, {}] });
  await page.goto(`/games/${id}`);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByText('Doomed')).toHaveCount(0);

  const res = await page.goto(`/games/${id}`);
  expect(res?.status()).toBe(404);
  expect(await db.count('copies')).toBe(0);
});

test('CAT-06 a PNG cover uploads and displays on the detail page and the grid @smoke', async ({
  page,
}) => {
  const id = await addGameViaUi(page, { title: 'With Cover', cover: png() });
  const img = page.locator(`img[src="/api/games/${id}/cover"]`);
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  await page.goto('/games');
  await expect(page.locator(`img[src="/api/games/${id}/cover"]`)).toBeVisible();
});

test('CAT-06b a cover of a few megabytes uploads (the limit is 8 MB)', async ({ page }) => {
  const threeMb = {
    name: 'big.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([TINY_PNG, Buffer.alloc(3 * 1024 * 1024)]),
  };
  const id = await addGameViaUi(page, { title: 'Big Cover', cover: threeMb });
  const res = await page.request.get(`/api/games/${id}/cover`);
  expect(res.status()).toBe(200);
});

test('CAT-07 a cover that is not an image type is rejected', async ({ page, db }) => {
  await page.goto('/games/new');
  await fillGameForm(page, { title: 'Bad Cover', cover: textFile() });
  await page.getByRole('button', SAVE).click();
  await expect(page.locator('.mantine-Alert-root')).toContainText(/JPEG, PNG, or WebP/);
  const covers = await db.sql`select cover_image from games where title = 'Bad Cover'`;
  expect(covers.every((r) => r.cover_image === null)).toBe(true);
});

test('CAT-07b a cover over 8 MB is rejected with a clear message', async ({ page }) => {
  await page.goto('/games/new');
  await fillGameForm(page, { title: 'Huge Cover', cover: oversizePng() });
  await page.getByRole('button', SAVE).click();
  await expect(page.locator('.mantine-Alert-root')).toContainText(/8 MB/);
});

// Known gap: only the browser-declared MIME type is checked, not the file's bytes. The file is
// served with nosniff and its declared type, so it is inert, but it still ends up stored.
test.fixme('CAT-07c bytes that are not an image are rejected even when labelled image/png', async ({
  page,
  db,
}) => {
  await page.goto('/games/new');
  await fillGameForm(page, { title: 'Fake Cover', cover: fakePng() });
  await page.getByRole('button', SAVE).click();
  await expect(page.locator('.mantine-Alert-root')).toBeVisible();
  const [row] = await db.sql`select cover_image from games where title = 'Fake Cover'`;
  expect(row?.cover_image ?? null).toBeNull();
});

test('CAT-08 replacing a cover serves the new file and removes the old one', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Recovered', cover: true });
  const [before] = await db.sql`select cover_image from games where id = ${id}`;
  const oldPath = path.join(DATA_DIR, before!.cover_image as string);
  expect(existsSync(oldPath)).toBe(true);

  await page.goto(`/games/${id}/edit`);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'new.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([TINY_PNG, Buffer.from('different')]),
  });
  await page.getByRole('button', SAVE).click();
  await expect(page).toHaveURL(new RegExp(`/games/${id}$`));

  const [after] = await db.sql`select cover_image from games where id = ${id}`;
  expect(after!.cover_image).not.toBe(before!.cover_image);
  expect(existsSync(path.join(DATA_DIR, after!.cover_image as string))).toBe(true);
  expect(existsSync(oldPath)).toBe(false);
  expect((await page.request.get(`/api/games/${id}/cover`)).status()).toBe(200);
});

test('CAT-09 a game without a cover shows a placeholder, not a broken image', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Plain' });
  await page.goto('/games');
  await expect(gameCards(page)).toHaveCount(1);
  await expect(gameCards(page).locator('img')).toHaveCount(0);
  await page.goto(`/games/${id}`);
  await expect(page.locator('img')).toHaveCount(0);
});

test('CAT-10 unusual titles render as text and never run as markup', async ({ page }) => {
  const titles = [
    'Tom & Jerry "Quotes" it\'s',
    '<b>bold</b> <img src=x onerror="window.xssFired=1">',
    '🎲 Würfel – 骰子 – שלום',
  ];
  for (const title of titles) {
    await addGameViaUi(page, { title });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await page.goto('/games');
  for (const title of titles) await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { xssFired?: number }).xssFired),
  ).toBeUndefined();
  await expect(page.locator('b', { hasText: 'bold' })).toHaveCount(0);
});

test('CAT-11 double-clicking Save creates exactly one game', async ({ page, db }) => {
  await page.goto('/games/new');
  await page.getByLabel(label('Title')).fill('Once Only');
  await page.getByRole('button', SAVE).dblclick();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  expect(await db.count('games', "title = 'Once Only'")).toBe(1);
});

test('CAT-12 Cancel leaves without saving', async ({ page, db }) => {
  await page.goto('/games/new');
  await page.getByLabel(label('Title')).fill('Never Saved');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/games$/);
  expect(await db.count('games')).toBe(0);
});

test('CAT-13 unknown and malformed game ids are a 404, not an error page', async ({ page }) => {
  for (const id of [MISSING, 'not-a-uuid', '123']) {
    const res = await page.goto(`/games/${id}`);
    expect(res?.status(), id).toBe(404);
    const edit = await page.goto(`/games/${id}/edit`);
    expect(edit?.status(), `${id}/edit`).toBe(404);
    const cover = await page.request.get(`/api/games/${id}/cover`);
    expect(cover.status(), `${id} cover`).toBe(404);
  }
});
