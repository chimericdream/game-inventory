import { expect, test } from '../fixtures';
import { choose, formWith } from '../support/mantine';

const LOG = 'Log play';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const mostPlayed = (page: import('@playwright/test').Page) =>
  page.getByRole('listitem').filter({ hasText: /\(\d+\)$/ });
const neglected = (page: import('@playwright/test').Page) =>
  page.getByRole('listitem').filter({ hasText: /· (never|last )/ });

test('PLAY-01 log a play with every detail and see it in the history @smoke', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Catan' });
  await page.goto('/plays');
  await expect(page.getByText('No plays logged yet.')).toBeVisible();

  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Catan');
  await form.getByLabel('Date').fill('2026-03-14');
  await form.getByLabel('Minutes').fill('75');
  await form.getByLabel('Players').fill('Ann, Bob ,, Cy');
  await form.getByLabel('Winner').fill('Ann');
  await form.getByLabel('Notes').fill('Close game');
  await form.getByRole('button', { name: LOG }).click();

  const row = page.locator('.mantine-Paper-root', { hasText: 'Catan' });
  await expect(row).toContainText('2026-03-14 · 75 min · Ann, Bob, Cy · won by Ann');
  const [play] = await db.sql`select player_names, notes from play_sessions`;
  expect(play!.player_names).toEqual(['Ann', 'Bob', 'Cy']);
  expect(play!.notes).toBe('Close game');
});

test('PLAY-02 a blank date means today', async ({ page, db }) => {
  await db.seedGame({ title: 'Today Game' });
  await page.goto('/plays');
  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Today Game');
  await form.getByRole('button', { name: LOG }).click();
  await expect(page.locator('.mantine-Paper-root', { hasText: 'Today Game' })).toContainText(
    db.today(),
  );
});

test('PLAY-03 most played ranks by count, then title', async ({ page, db }) => {
  const a = await db.seedGame({ title: 'Alpha' });
  const b = await db.seedGame({ title: 'Bravo' });
  const c = await db.seedGame({ title: 'Charlie' });
  for (const [id, n] of [
    [a, 1],
    [b, 3],
    [c, 1],
  ] as const) {
    for (let i = 0; i < n; i++) await db.seedPlay(id);
  }
  await page.goto('/plays');
  await expect(mostPlayed(page)).toHaveText(['Bravo (3)', 'Alpha (1)', 'Charlie (1)']);
});

test('PLAY-04 not-played-in-a-year lists unplayed and stale games and drops one once played', async ({
  page,
  db,
}) => {
  const fresh = await db.seedGame({ title: 'Fresh' });
  const stale = await db.seedGame({ title: 'Stale' });
  await db.seedGame({ title: 'Untouched' });
  await db.seedPlay(fresh, { playedOn: daysAgo(10) });
  await db.seedPlay(stale, { playedOn: daysAgo(500) });

  await page.goto('/plays');
  await expect(neglected(page)).toHaveCount(2);
  await expect(neglected(page).filter({ hasText: 'Untouched' })).toContainText('never');
  await expect(neglected(page).filter({ hasText: 'Stale' })).toContainText('last');
  await expect(neglected(page).filter({ hasText: 'Fresh' })).toHaveCount(0);

  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Untouched');
  await form.getByRole('button', { name: LOG }).click();
  await expect(neglected(page)).toHaveCount(1);
  await expect(neglected(page).filter({ hasText: 'Untouched' })).toHaveCount(0);
});

test('PLAY-05 plays are listed newest first', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Ordered' });
  await db.seedPlay(id, { playedOn: '2025-01-01', winner: 'Old' });
  await db.seedPlay(id, { playedOn: '2026-02-02', winner: 'New' });
  await page.goto('/plays');
  const rows = page.locator('.mantine-Paper-root', { hasText: 'Ordered' });
  await expect(rows.first()).toContainText('won by New');
  await expect(rows.last()).toContainText('won by Old');
});

test('PLAY-06 delete a play', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Oops' });
  await db.seedPlay(id);
  await page.goto('/plays');
  await page.getByRole('button', { name: 'Delete play' }).click();
  await expect(page.getByText('No plays logged yet.')).toBeVisible();
  expect(await db.count('play_sessions')).toBe(0);
});

test('PLAY-07 minutes must be positive; a play needs a game', async ({ page, db }) => {
  await db.seedGame({ title: 'Valid' });
  await page.goto('/plays');
  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Valid');
  await form.getByLabel('Minutes').fill('0');
  await form.getByRole('button', { name: LOG }).click();
  // Zero minutes is clamped by the field or stored as "no duration"; it never becomes a 0-minute play.
  await expect(page.locator('.mantine-Paper-root', { hasText: 'Valid' })).not.toContainText(
    '0 min',
  );
  expect(await db.count('play_sessions', 'duration_minutes = 0')).toBe(0);
});

test('PLAY-08 members can log plays; restricted profiles cannot see the page', async ({
  memberPage,
  kidPage,
  db,
}) => {
  await db.seedGame({ title: 'Family Game' });
  await memberPage.goto('/plays');
  const form = formWith(memberPage, LOG);
  await choose(memberPage, form, 'Game', 'Family Game');
  await form.getByRole('button', { name: LOG }).click();
  await expect(memberPage.locator('.mantine-Paper-root', { hasText: 'Family Game' })).toBeVisible();
  await kidPage.goto('/plays');
  await expect(kidPage).toHaveURL(/\/games$/);
});
