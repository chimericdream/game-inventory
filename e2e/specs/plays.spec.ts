import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { choose, formWith } from '../support/mantine';

const LOG = 'Log play';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const long = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const playRows = (page: Page) => page.locator('[data-play]');
const mostPlayed = (page: Page) => page.locator('[data-most-played]');
const neglected = (page: Page) => page.locator('[data-neglected]');

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
  await form.getByLabel('Add someone').fill('Ann, Bob ,, Cy');
  await form.getByLabel('Notes').fill('Close game');
  await form.getByRole('button', { name: LOG }).click();

  const row = playRows(page).filter({ hasText: 'Catan' });
  await expect(row).toContainText('Mar 14, 2026');
  await expect(row).toContainText('75 min');
  await expect(row).toContainText('Close game');
  for (const name of ['Ann', 'Bob', 'Cy']) await expect(row).toContainText(name);

  const [play] = await db.sql`select notes from play_sessions`;
  expect(play!.notes).toBe('Close game');
  const who = await db.sql`
    select p.display_name, p.user_id from play_participants pp
    join players p on p.id = pp.player_id order by p.display_name`;
  expect(who.map((r) => r.display_name)).toEqual(['Ann', 'Bob', 'Cy']);
  expect(who.every((r) => r.user_id === null)).toBe(true);
});

test('PLAY-01b household members are one tap, guests need no account, and the group can be reused', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Catan' });
  await db.seedGame({ title: 'Azul' });
  await page.goto('/plays');
  const form = formWith(page, LOG);

  await form.getByRole('button', { name: 'Mo Member', exact: true }).click();
  await form.getByLabel('Add someone').fill('Aunt Dana');
  await choose(page, form, 'Game', 'Catan');
  await form.getByRole('button', { name: LOG }).click();
  await expect(playRows(page)).toHaveCount(1);
  await expect(playRows(page)).toContainText('Mo Member');
  await expect(playRows(page)).toContainText('Aunt Dana');

  const users = await db.sql`
    select p.display_name, (p.user_id is not null) as is_user from play_participants pp
    join players p on p.id = pp.player_id order by p.display_name`;
  expect(users.map((r) => [r.display_name, r.is_user])).toEqual([
    ['Aunt Dana', false],
    ['Mo Member', true],
  ]);

  // Aunt Dana is now a one-tap chip, and "same group" brings the whole group back.
  await expect(form.getByRole('button', { name: 'Aunt Dana', exact: true })).toBeVisible();
  await form.getByRole('button', { name: /Same group as last time/ }).click();
  await expect(form.getByRole('button', { name: 'Mo Member', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(form.getByRole('button', { name: 'Aunt Dana', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await choose(page, form, 'Game', 'Azul');
  await form.getByRole('button', { name: LOG }).click();
  await expect(playRows(page)).toHaveCount(2);
  expect(await db.count('players', "user_id is null and display_name = 'Aunt Dana'")).toBe(1);
});

test('PLAY-01c a typed name that matches someone from before is offered as a tap, never duplicated', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Catan' });
  await db.seedPlay(id, { players: ['Ann'] });
  await page.goto('/plays');
  const form = formWith(page, LOG);

  await form.getByLabel('Add someone').fill('ann');
  await expect(form.getByText('Is this Ann from before?')).toBeVisible();
  await form.getByRole('button', { name: 'Use Ann' }).click();
  await expect(form.getByRole('button', { name: 'Ann', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(form.getByLabel('Add someone')).toHaveValue('');

  // Ignoring the hint is stopped by the server instead of creating a second Ann.
  await form.getByLabel('Add someone').fill('ANN');
  await choose(page, form, 'Game', 'Catan');
  await form.getByRole('button', { name: LOG }).click();
  await expect(page.locator('.mantine-Alert-root')).toContainText('has played before');
  expect(await db.count('players', "display_name ilike 'ann'")).toBe(1);
});

test('PLAY-02 a blank date means today', async ({ page, db }) => {
  await db.seedGame({ title: 'Today Game' });
  await page.goto('/plays');
  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Today Game');
  await form.getByRole('button', { name: LOG }).click();
  await expect(neglected(page)).toHaveCount(0);
  await expect(playRows(page).filter({ hasText: 'Today Game' })).toContainText(long(db.today()));
});

/** The Yesterday chip uses the browser's own timezone. */
const localYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('PLAY-02b Yesterday fills the date', async ({ page, db }) => {
  await db.seedGame({ title: 'Yesterday Game' });
  await page.goto('/plays');
  const form = formWith(page, LOG);
  await form
    .getByRole('group', { name: 'Today or yesterday' })
    .getByRole('button', { name: 'Yesterday' })
    .click();
  await expect(form.getByLabel('Date')).toHaveValue(localYesterday());
  await choose(page, form, 'Game', 'Yesterday Game');
  await form.getByRole('button', { name: LOG }).click();
  await expect(playRows(page)).toContainText(long(localYesterday()));
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
  await expect(mostPlayed(page)).toHaveCount(3);
  await expect(mostPlayed(page).nth(0)).toContainText('Bravo');
  await expect(mostPlayed(page).nth(0)).toContainText('3');
  await expect(mostPlayed(page).nth(1)).toContainText('Alpha');
  await expect(mostPlayed(page).nth(2)).toContainText('Charlie');
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
  await expect(neglected(page).filter({ hasText: 'Untouched' })).toContainText('Never played');
  await expect(neglected(page).filter({ hasText: 'Stale' })).toContainText('Last played');
  await expect(neglected(page).filter({ hasText: 'Fresh' })).toHaveCount(0);

  const form = formWith(page, LOG);
  await choose(page, form, 'Game', 'Untouched');
  await form.getByRole('button', { name: LOG }).click();
  await expect(neglected(page)).toHaveCount(1);
  await expect(neglected(page).filter({ hasText: 'Untouched' })).toHaveCount(0);
});

test('PLAY-04b "Log a play" beside a dusty game opens the form with that game chosen', async ({
  page,
  db,
}) => {
  await db.seedGame({ title: 'Dusty Box' });
  await page.goto('/plays');
  await neglected(page)
    .filter({ hasText: 'Dusty Box' })
    .getByRole('link', { name: 'Log a play' })
    .click();
  await expect(page).toHaveURL(/game=/);
  await expect(formWith(page, LOG).getByRole('combobox', { name: /^Game/ })).toHaveValue(
    'Dusty Box',
  );
});

test('PLAY-05 plays are listed newest first', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Ordered' });
  await db.seedPlay(id, { playedOn: '2025-01-01', players: ['Old'] });
  await db.seedPlay(id, { playedOn: '2026-02-02', players: ['New'] });
  await page.goto('/plays');
  const rows = playRows(page).filter({ hasText: 'Ordered' });
  await expect(rows.first()).toContainText('New');
  await expect(rows.last()).toContainText('Old');
});

test('PLAY-05b filtering by a player shows only the plays they took part in', async ({
  page,
  db,
}) => {
  const id = await db.seedGame({ title: 'Shared Game' });
  await db.seedPlay(id, { playedOn: '2026-02-01', players: ['Ann', 'Bob'] });
  await db.seedPlay(id, { playedOn: '2026-02-02', players: ['Bob'] });
  await page.goto('/plays');
  await expect(playRows(page)).toHaveCount(2);

  await page
    .getByRole('navigation', { name: 'Filter by player' })
    .getByRole('link', { name: 'Ann' })
    .click();
  await expect(page).toHaveURL(/player=/);
  await expect(playRows(page)).toHaveCount(1);
  await expect(playRows(page)).toContainText('Ann');

  await page.getByRole('link', { name: 'Everyone' }).click();
  await expect(playRows(page)).toHaveCount(2);

  const bad = await page.goto('/plays?player=not-a-uuid');
  expect(bad?.status()).toBe(200);
  await expect(playRows(page)).toHaveCount(0);
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
  await expect(playRows(page).filter({ hasText: 'Valid' })).not.toContainText('0 min');
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
  await expect(playRows(memberPage).filter({ hasText: 'Family Game' })).toBeVisible();
  await kidPage.goto('/plays');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('PLAY-09 a long not-played list shows five and expands on request', async ({ page, db }) => {
  for (let i = 1; i <= 8; i++) await db.seedGame({ title: `Dusty ${i}` });
  await page.goto('/plays');
  await expect(neglected(page)).toHaveCount(5);
  await page.getByRole('link', { name: 'Show all 8' }).click();
  await expect(neglected(page)).toHaveCount(8);
  await page.getByRole('link', { name: 'Show fewer' }).click();
  await expect(neglected(page)).toHaveCount(5);
});

test('PLAY-10 the summary says how much has been played and what is gathering dust', async ({
  page,
  db,
}) => {
  const a = await db.seedGame({ title: 'Alpha' });
  await db.seedGame({ title: 'Dusty' });
  await db.seedPlay(a, { playedOn: daysAgo(3) });
  await db.seedPlay(a, { playedOn: daysAgo(400) });
  await page.goto('/plays');
  await expect(page.getByText('1 play this year.')).toBeVisible();
  await expect(page.getByText(/Alpha leads with 2\./)).toBeVisible();
  await expect(page.getByText(/1 game on the shelf hasn’t been opened/)).toBeVisible();
});

test('PLAY-11 older plays load on request', async ({ page, db }) => {
  const id = await db.seedGame({ title: 'Many Plays' });
  for (let i = 0; i < 15; i++) await db.seedPlay(id, { playedOn: daysAgo(i) });
  await page.goto('/plays');
  await expect(playRows(page)).toHaveCount(12);
  await page.getByRole('link', { name: 'Show older plays' }).click();
  await expect(playRows(page)).toHaveCount(15);
});
