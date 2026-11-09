import { expect, test, ADMIN } from '../fixtures';
import { addGameViaUi } from '../support/actions';

const stars = (page: import('@playwright/test').Page, n: number) =>
  page.getByRole('button', { name: `${n} out of 5` });

test('DET-01 rate a game, change the rating, and clear it @smoke', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Rated Game' });
  await page.goto(`/games/${id}`);
  await expect(page.getByText('Nobody has rated this yet')).toBeVisible();

  await stars(page, 4).click();
  await expect(stars(page, 4)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Family average 4 from 1 rating')).toBeVisible();

  await page.reload();
  await expect(stars(page, 4)).toHaveAttribute('aria-pressed', 'true');

  await stars(page, 2).click();
  await expect(stars(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Family average 2 from 1 rating')).toBeVisible();

  // Choosing the current score again clears it.
  await stars(page, 2).click();
  await expect(page.getByText('Nobody has rated this yet')).toBeVisible();
});

test('DET-01b the family average counts everyone but shows only your own score', async ({
  page,
  memberPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Shared Rating' });
  await page.goto(`/games/${id}`);
  await stars(page, 5).click();
  await expect(page.getByText('Family average 5 from 1 rating')).toBeVisible();

  await memberPage.goto(`/games/${id}`);
  await expect(memberPage.getByText('Family average 5 from 1 rating')).toBeVisible();
  await expect(stars(memberPage, 5)).toHaveAttribute('aria-pressed', 'false'); // not Ada's score
  await stars(memberPage, 3).click();
  await expect(memberPage.getByText('Family average 4 from 2 ratings')).toBeVisible();
});

test('DET-02 recent plays list who took part, and who plays this most', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Played Game' });
  await db.seedPlay(id, { playedOn: '2026-03-14', players: ['Ann', 'Bob'] });
  await db.seedPlay(id, { playedOn: '2026-02-01', players: ['Ann'] });
  await page.goto(`/games/${id}`);

  await expect(page.getByText('played 2 times')).toBeVisible();
  const plays = page.getByRole('list').filter({ hasText: 'Mar 14, 2026' });
  await expect(plays).toContainText('Ann');
  await expect(plays).toContainText('Bob');
  await expect(page.getByText('Who plays this: Ann 2 · Bob 1')).toBeVisible();
});

test('DET-03 the footer says who last changed the game', async ({ page }) => {
  const id = await addGameViaUi(page, { title: 'Authored Game' });
  await page.goto(`/games/${id}`);
  await expect(page.getByText(`Last added by ${ADMIN.name}`)).toBeVisible();
});

test('DET-04 a restricted profile gets no ratings, plays, notes or edit controls @security', async ({
  kidPage,
  db,
}) => {
  const id = await db.seedGame({
    title: 'Family Game',
    notes: 'PRIVATE: lent to the Smiths',
    description: 'Roll and move.',
  });
  await db.seedPlay(id, { players: ['Ann'] });
  await kidPage.goto(`/games/${id}`);
  await expect(kidPage.getByRole('heading', { name: 'Family Game' })).toBeVisible();
  await expect(kidPage.getByText('Roll and move.')).toBeVisible();
  for (const text of ['Your rating', 'Recent plays', 'Last added', 'Last edited']) {
    await expect(kidPage.getByText(text)).toHaveCount(0);
  }
  await expect(kidPage.getByRole('button', { name: 'Delete game' })).toHaveCount(0);
  await expect(kidPage.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  const html = await (await kidPage.request.get(`/games/${id}`)).text();
  expect(html).not.toContain('PRIVATE');
  expect(html).not.toContain('Ann');
});

test('DET-05 a game with no picture shows a stand-in tile instead of a hole', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Plain Game', type: 'rpg' });
  await page.goto(`/games/${id}`);
  await expect(page.locator('img')).toHaveCount(0);
  await expect(page.getByRole('main').getByText('RPG').first()).toBeVisible();
});

test('DET-06 "Log a play" opens the plays page with this game chosen', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Quick Log' });
  await page.goto(`/games/${id}`);
  await page.getByRole('link', { name: 'Log a play' }).click();
  await expect(page).toHaveURL(`/plays?game=${id}`);
  await expect(page.getByRole('combobox', { name: /^Game/ })).toHaveValue('Quick Log');
});
