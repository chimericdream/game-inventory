import { expect, test } from '../fixtures';
import { gameCards } from '../support/actions';

const picker = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Game night' });

test('GV-01 the game-night picker narrows by players and time, and the headline answers it @security', async ({
  anonPage,
  db,
}) => {
  await db.seedGame({
    title: 'Quick Party',
    shareable: true,
    minPlayers: 2,
    maxPlayers: 8,
    playTimeMinutes: 15,
  });
  await db.seedGame({
    title: 'Long Epic',
    shareable: true,
    minPlayers: 3,
    maxPlayers: 4,
    playTimeMinutes: 150,
  });
  await db.seedGame({
    title: 'Solo Only',
    shareable: true,
    minPlayers: 1,
    maxPlayers: 1,
    playTimeMinutes: 30,
  });
  await db.seedGame({
    title: 'Secret Fits Too',
    shareable: false,
    minPlayers: 2,
    maxPlayers: 8,
    playTimeMinutes: 15,
  });
  const token = await db.seedShareLink();

  await anonPage.goto(`/g/${token}`);
  await expect(anonPage.getByRole('heading', { name: '3 games to look through' })).toBeVisible();

  await picker(anonPage).getByRole('link', { name: '4 players' }).click();
  await expect(anonPage).toHaveURL(/players=4/);
  await expect(anonPage.getByRole('heading', { name: '2 games for 4 players' })).toBeVisible();
  await expect(gameCards(anonPage).filter({ hasText: 'Solo Only' })).toHaveCount(0);

  await picker(anonPage).getByRole('link', { name: 'Up to 1 hour' }).click();
  await expect(anonPage).toHaveURL(/maxMinutes=60/);
  await expect(
    anonPage.getByRole('heading', { name: '1 game for 4 players in an hour' }),
  ).toBeVisible();
  await expect(gameCards(anonPage)).toHaveCount(1);
  await expect(gameCards(anonPage)).toContainText('Quick Party');

  // Choosing the same number again clears it; "Any" clears the time.
  await picker(anonPage).getByRole('link', { name: '4 players' }).click();
  await picker(anonPage).getByRole('link', { name: 'Any' }).click();
  await expect(anonPage.getByRole('heading', { name: '3 games to look through' })).toBeVisible();
  await expect(anonPage.getByText('Secret Fits Too')).toHaveCount(0);
});

test('GV-02 nothing about loans, borrowers or availability reaches a guest @security', async ({
  anonPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Borrowed Game', shareable: true, copies: [{}] });
  const [copy] = await db.sql`select id from copies where game_id = ${id}`;
  await db.seedLoan(copy!.id as string, { borrower: 'Secret Borrower', dueOn: '2099-05-05' });
  const token = await db.seedShareLink();

  for (const url of [`/g/${token}`, `/g/${token}/${id}`]) {
    const html = await (await anonPage.request.get(url)).text();
    for (const leak of ['Secret Borrower', '2099', 'Out with', 'on loan', 'On loan']) {
      expect(html, `${url} must not contain ${leak}`).not.toContain(leak);
    }
  }
  await anonPage.goto(`/g/${token}`);
  await expect(gameCards(anonPage)).toHaveCount(1);
  await expect(gameCards(anonPage)).not.toContainText(/Out with|Out \d|Due/);
});

test('GV-03 unknown, revoked and expired links look and answer exactly alike @security', async ({
  anonPage,
  db,
}) => {
  const id = await db.seedGame({ title: 'Anything', shareable: true });
  const revoked = await db.seedShareLink({ revoked: true });
  const expired = await db.seedShareLink({ expiresAt: new Date(Date.now() - 3_600_000) });
  const unknown = 'a-token-that-never-existed';

  const answers: { status: number | undefined; heading: string | null; text: string }[] = [];
  for (const token of [unknown, revoked, expired]) {
    for (const path of [`/g/${token}`, `/g/${token}/${id}`]) {
      const res = await anonPage.goto(path);
      answers.push({
        status: res?.status(),
        heading: await anonPage.getByRole('heading', { level: 1 }).textContent(),
        text: (await anonPage.locator('main').innerText()).replace(/\s+/g, ' '),
      });
    }
  }
  expect(new Set(answers.map((a) => a.status))).toEqual(new Set([404]));
  expect(new Set(answers.map((a) => a.heading))).toEqual(new Set(['That’s not on the shelf.']));
  expect(new Set(answers.map((a) => a.text)).size).toBe(1);
});

test('GV-04 a hidden game and an unknown id are the same page for a restricted profile @security', async ({
  kidPage,
  db,
}) => {
  const hidden = await db.seedGame({ title: 'Hidden Away', visibility: 'hidden_restricted' });
  const missing = '00000000-0000-4000-8000-000000000000';
  const read = async (id: string) => {
    const res = await kidPage.goto(`/games/${id}`);
    return {
      status: res?.status(),
      text: (await kidPage.locator('main').innerText()).replace(/\s+/g, ' '),
    };
  };
  const a = await read(hidden);
  const b = await read(missing);
  expect(a).toEqual(b);
  expect(a.status).toBe(404);
  expect(a.text).toContain('That’s not on the shelf.');
  expect(a.text).not.toContain('Hidden Away');
});

test('GV-05 the guest page works on a phone without sideways scrolling', async ({
  anonPage,
  db,
}) => {
  await db.seedGame({
    title: 'A Rather Long Title That Needs To Wrap On A Small Screen',
    shareable: true,
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 45,
  });
  const token = await db.seedShareLink();
  await anonPage.setViewportSize({ width: 390, height: 844 });
  await anonPage.goto(`/g/${token}`);
  await expect(picker(anonPage).getByRole('link', { name: '4 players' })).toBeInViewport();
  const overflow = await anonPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(gameCards(anonPage)).toHaveCount(1);
});
