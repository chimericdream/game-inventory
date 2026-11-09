import { expect, test } from '../fixtures';
import { gameCards } from '../support/actions';

const csv = (text: string, name = 'games.csv') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
});

async function upload(page: import('@playwright/test').Page, file: ReturnType<typeof csv>) {
  await page.goto('/import');
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
}

const result = (page: import('@playwright/test').Page) => page.locator('.mantine-Alert-root');

test('IMP-01 a valid file imports games with their details @smoke', async ({ page, db }) => {
  await upload(
    page,
    csv(
      [
        'title,type,min_players,max_players,minutes,complexity,tags,platform,location,notes',
        'Catan,board,3,4,90,3,strategy;trading,,Hall closet,Missing a road',
        'Zelda,video,,,,,adventure,Switch,Den,',
        'Player Handbook,rpg,,,,,rules,,,',
      ].join('\n'),
    ),
  );
  await expect(result(page)).toContainText('Imported 3 games');

  await page.goto('/games');
  await expect(gameCards(page)).toHaveCount(3);
  const [catan] = await db.sql`
    select g.notes, b.min_players, b.max_players, b.play_time_minutes, b.complexity
    from games g join board_game_details b on b.game_id = g.id where g.title = 'Catan'`;
  expect(catan).toMatchObject({
    min_players: 3,
    max_players: 4,
    play_time_minutes: 90,
    complexity: 3,
    notes: 'Missing a road',
  });
  const tagRows = await db.sql`select t.name from tags t order by t.name`;
  expect(tagRows.map((t) => t.name)).toEqual(['adventure', 'rules', 'strategy', 'trading']);
  const [zelda] =
    await db.sql`select c.platform, l.name as location from copies c join games g on g.id = c.game_id left join locations l on l.id = c.location_id where g.title = 'Zelda'`;
  expect(zelda).toMatchObject({ platform: 'Switch', location: 'Den' });
});

test('IMP-02 header aliases and type aliases are understood', async ({ page, db }) => {
  await upload(
    page,
    csv(
      [
        'Name,Category,Min_Players,Max_Players,Play_Time,Weight,Genre,Console',
        'Aliased Board,Board Game,2,4,30,2,fun,',
        'Aliased Video,video game,,,,,retro,PS5',
        'Aliased Card,cardgame,2,6,15,1,quick,',
      ].join('\n'),
    ),
  );
  await expect(result(page)).toContainText('Imported 3 games');
  const types = await db.sql`select title, type from games order by title`;
  expect(types.map((r) => [r.title, r.type])).toEqual([
    ['Aliased Board', 'board'],
    ['Aliased Card', 'card'],
    ['Aliased Video', 'video'],
  ]);
});

test('IMP-03 bad rows are reported by line number and the good rows still import', async ({
  page,
  db,
}) => {
  await upload(
    page,
    csv(
      ['title,type', 'Good One,board', ',board', 'Bad Type,spaceship', 'Good Two,card'].join('\n'),
    ),
  );
  await expect(result(page).first()).toContainText('Imported 2 games');
  await expect(page.getByText('Line 3: Missing title')).toBeVisible();
  await expect(page.getByText('Line 4: Unknown type "spaceship"')).toBeVisible();
  expect(await db.count('games')).toBe(2);
});

test('IMP-04 quoted commas, escaped quotes, embedded newlines, CRLF and a BOM', async ({
  page,
  db,
}) => {
  const body =
    '﻿title,notes\r\n' +
    '"Hearts, Spades & Co",plain\r\n' +
    '"Say ""Hello""","line one\nline two"\r\n';
  await upload(page, csv(body));
  await expect(result(page)).toContainText('Imported 2 games');
  const rows = await db.sql`select title, notes from games order by title`;
  expect(rows.map((r) => r.title)).toEqual(['Hearts, Spades & Co', 'Say "Hello"']);
  expect(rows.find((r) => r.title === 'Say "Hello"')!.notes).toBe('line one\nline two');
});

test('IMP-05 re-importing the same file skips what is already there, ignoring case', async ({
  page,
  db,
}) => {
  const file = csv('title,type\nCatan,board\nZelda,video\n');
  await upload(page, file);
  await expect(result(page)).toContainText('Imported 2 games');

  await upload(page, csv('title,type\nCATAN,board\nZelda,video\nCatan,card\n'));
  await expect(result(page)).toContainText('Imported 1 game, skipped 2 already in the library');
  expect(await db.count('games')).toBe(3); // the same title as a card game is a different game
});

test('IMP-06 locations are created once and matched without regard to case', async ({
  page,
  db,
}) => {
  await upload(page, csv('title,location\nA,Shelf A\nB,shelf a\nC,SHELF A\nD,Shelf B\nE,\n'));
  await expect(result(page)).toContainText('Imported 5 games');
  const names = await db.sql`select name from locations order by name`;
  expect(names.map((r) => r.name)).toEqual(['Shelf A', 'Shelf B']);
});

test('IMP-07 empty, header-only, wrong-shape and over-limit files are refused with a message', async ({
  page,
  db,
}) => {
  const cases: [string, ReturnType<typeof csv>, RegExp][] = [
    ['empty file', csv('', 'empty.csv'), /choose a csv file/i],
    ['header only', csv('title,type\n', 'header.csv'), /no rows to import/i],
    ['no title column', csv('foo,bar\n1,2\n', 'notitle.csv'), /title.*column is required/i],
    [
      'too many rows',
      csv('title\n' + Array.from({ length: 2001 }, (_, i) => `G${i}`).join('\n'), 'big.csv'),
      /at most 2000 rows/i,
    ],
  ];
  for (const [name, file, message] of cases) {
    await upload(page, file);
    await expect(result(page), name).toContainText(message);
    expect(await db.count('games'), name).toBe(0);
  }
});

test('IMP-07b a few hundred rows import', async ({ page, db }) => {
  const rows = Array.from(
    { length: 300 },
    (_, i) => `Imported ${String(i).padStart(3, '0')},board,2,4,30`,
  );
  await upload(page, csv(['title,type,min_players,max_players,minutes', ...rows].join('\n')));
  await expect(result(page)).toContainText('Imported 300 games', { timeout: 30_000 });
  expect(await db.count('games')).toBe(300);
});

test('IMP-07c a file over 2 MB is refused', async ({ page, db }) => {
  const filler = 'x'.repeat(100);
  const rows = Array.from({ length: 22_000 }, (_, i) => `G${i},${filler}`);
  await upload(page, csv(['title,notes', ...rows].join('\n')));
  await expect(result(page)).toContainText(/larger than 2 MB/);
  expect(await db.count('games')).toBe(0);
});

test('IMP-08 imported rows belong to the household and carry one copy each', async ({
  page,
  db,
}) => {
  await upload(page, csv('title,platform\nOne,Switch\nTwo,\n'));
  await expect(result(page)).toContainText('Imported 2 games');
  const hh = await db.householdId();
  expect(await db.count('games', `household_id = '${hh}'`)).toBe(2);
  expect(await db.count('copies', `household_id = '${hh}'`)).toBe(2);
});

test('IMP-09 members can import; restricted profiles are turned away', async ({
  memberPage,
  kidPage,
}) => {
  await upload(memberPage, csv('title\nMember Import\n'));
  await expect(result(memberPage)).toContainText('Imported 1 game');
  await kidPage.goto('/import');
  await expect(kidPage).toHaveURL(/\/games$/);
});

test('IMP-08 columns the importer does not know are listed, and puzzle pieces are read', async ({
  page,
  db,
}) => {
  await upload(page, csv('title,type,pieces,Colour,Shelf Code\nAlpine Lake,puzzle,1000,blue,A1'));
  await expect(result(page)).toContainText('Imported 1 game');
  await expect(page.locator('[data-unused-columns]')).toContainText('Not used: Colour, Shelf Code');
  const [row] = await db.sql`select p.piece_count from puzzle_details p`;
  expect(row!.piece_count).toBe(1000);
});

test('IMP-09 the rows that failed can be downloaded, fixed and imported again', async ({
  page,
  db,
}) => {
  await upload(page, csv('title,type\nGood Game,board\n,board\nBad Type,spaceship'));
  await expect(result(page)).toContainText('Imported 1 game');
  const link = page.getByRole('link', { name: 'Download the rows that failed' });
  await expect(link).toHaveAttribute('download', 'rows-to-fix.csv');
  const href = (await link.getAttribute('href'))!;
  const text = await page.evaluate(async (url) => (await fetch(url)).text(), href);
  expect(text).toBe('title,type\r\n,board\r\nBad Type,spaceship\r\n');
  expect(await db.count('games')).toBe(1);
});
