import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { games } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { eq } from 'drizzle-orm';
import { catalogFacets, librarySummary, listCatalogPage, parseCatalogFilters } from './catalog';
import { createContext, type DataContext } from './context';
import { addCopy } from './copies';
import { createGame } from './games';
import { lendCopy } from './loans';
import { createLocation } from './lookups';

let db: Db;
let admin: DataContext;
let kid: DataContext;
let basement: string;
let shelf: string;

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const k = await createUser(db, a.householdId, {
    name: 'Kid',
    email: 'kid@example.com',
    password: 'password123',
    role: 'restricted',
  });
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
  basement = (await createLocation(admin, 'Basement')).id;
  shelf = (await createLocation(admin, 'Shelf 3', basement)).id;
});

const titles = (page: { rows: { title: string }[] }) => page.rows.map((r) => r.title);

async function seed(count: number) {
  for (let i = 1; i <= count; i++) {
    await createGame(admin, { title: `Game ${String(i).padStart(3, '0')}`, type: 'board' });
  }
}

describe('paging and sorting', () => {
  it('pages in stable title order with no gaps or duplicates', async () => {
    await seed(25);
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await listCatalogPage(admin, { page }, 10);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(page < 3);
      seen.push(...titles(result));
    }
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    expect(seen).toEqual(seen.toSorted());
    expect((await listCatalogPage(admin, { page: 4 }, 10)).rows).toHaveLength(0);
  });

  it('sorts newest first, and still pages without duplicates', async () => {
    await seed(6);
    const all = await db.select().from(games);
    // Give every game a distinct creation time, newest = highest number.
    for (const g of all) {
      const n = Number(g.title.slice(-3));
      await db
        .update(games)
        .set({ createdAt: new Date(2026, 0, n) })
        .where(eq(games.id, g.id));
    }
    const one = await listCatalogPage(admin, { sort: 'newest', page: 1 }, 4);
    const two = await listCatalogPage(admin, { sort: 'newest', page: 2 }, 4);
    expect([...titles(one), ...titles(two)]).toEqual([
      'Game 006',
      'Game 005',
      'Game 004',
      'Game 003',
      'Game 002',
      'Game 001',
    ]);
  });
});

describe('filtering in the database', () => {
  it('filters by search, type, players, time, tag, owner and nested location', async () => {
    const catan = await createGame(admin, {
      title: 'Catan',
      type: 'board',
      board: { minPlayers: 3, maxPlayers: 4, playTimeMinutes: 90 },
      tags: ['Family'],
    });
    await addCopy(admin, catan.id, { locationId: shelf, ownerUserId: admin.viewer.userId });
    await createGame(admin, {
      title: 'Uno',
      type: 'card',
      board: { minPlayers: 2, maxPlayers: 10, playTimeMinutes: 20 },
    });
    await createGame(admin, { title: 'Zelda', type: 'video' });

    const run = async (f: Parameters<typeof listCatalogPage>[1]) =>
      titles(await listCatalogPage(admin, f));
    expect(await run({ search: 'cat' })).toEqual(['Catan']);
    expect(await run({ type: 'video' })).toEqual(['Zelda']);
    expect(await run({ players: 4 })).toEqual(['Catan', 'Uno']);
    expect(await run({ players: 6 })).toEqual(['Uno']);
    expect(await run({ maxMinutes: 30 })).toEqual(['Uno']);
    expect(await run({ tag: 'family' })).toEqual(['Catan']);
    expect(await run({ ownerUserId: admin.viewer.userId })).toEqual(['Catan']);
    // A copy on "Shelf 3" is found from its parent "Basement" too.
    expect(await run({ locationId: shelf })).toEqual(['Catan']);
    expect(await run({ locationId: basement })).toEqual(['Catan']);
  });

  it('treats malformed ids and values as matching nothing, never as an error', async () => {
    await seed(2);
    expect((await listCatalogPage(admin, { locationId: 'nope' })).rows).toEqual([]);
    expect((await listCatalogPage(admin, { ownerUserId: "x'; drop table games;--" })).total).toBe(
      0,
    );
    const parsed = parseCatalogFilters({
      players: 'abc',
      maxMinutes: '-5',
      type: 'wrong',
      availability: 'maybe',
      sort: 'random',
      page: '0',
      q: ['first', 'second'],
    });
    expect(parsed).toMatchObject({ search: 'first' });
    expect(parsed.players).toBeUndefined();
    expect(parsed.maxMinutes).toBeUndefined();
    expect(parsed.type).toBeUndefined();
    expect(parsed.availability).toBeUndefined();
    expect(parsed.sort).toBeUndefined();
    expect(parsed.page).toBeUndefined();
  });

  it('filters by availability and reports the borrower to household members only', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    await createGame(admin, { title: 'Uno', type: 'card' });
    const copy = await addCopy(admin, catan.id, {});
    await lendCopy(admin, { copyId: copy.id, borrower: 'Dana', dueOn: '2030-01-01' });

    expect(titles(await listCatalogPage(admin, { availability: 'out' }))).toEqual(['Catan']);
    expect(titles(await listCatalogPage(admin, { availability: 'here' }))).toEqual(['Uno']);
    const row = (await listCatalogPage(admin)).rows[0]!;
    expect(row.loan).toEqual({
      borrower: 'Dana',
      dueOn: '2030-01-01',
      daysOut: 0,
      copiesOut: 1,
    });

    // Restricted profiles see no loan information, and the filter cannot be used to probe it.
    const kidPage = await listCatalogPage(kid, { availability: 'out' });
    expect(kidPage.total).toBe(2);
    expect(JSON.stringify(kidPage)).not.toContain('Dana');
    expect(kidPage.rows.every((r) => r.loan === null)).toBe(true);
    // They may see that a game is out, never who has it or when it is due.
    expect(kidPage.rows.some((r) => r.onLoan)).toBe(true);
  });
});

describe('visibility in totals, pages and facets', () => {
  beforeEach(async () => {
    const secret = await createGame(admin, {
      title: 'Secret Game',
      type: 'board',
      visibility: 'hidden_restricted',
      tags: ['hush'],
    });
    await addCopy(admin, secret.id, { locationId: shelf });
    await createGame(admin, { title: 'Open Game', type: 'board', tags: ['family'] });
    await createGame(admin, {
      title: 'Secret Video',
      type: 'video',
      visibility: 'hidden_restricted',
    });
  });

  it('never counts hidden games for a restricted profile', async () => {
    const adminPage = await listCatalogPage(admin);
    const kidPage = await listCatalogPage(kid);
    expect(adminPage.total).toBe(3);
    expect(kidPage.total).toBe(1);
    expect(titles(kidPage)).toEqual(['Open Game']);
    expect((await librarySummary(kid)).games).toBe(1);
    expect((await librarySummary(admin)).games).toBe(3);
  });

  it('leaves hidden games out of every facet count', async () => {
    const kidFacets = await catalogFacets(kid);
    expect(kidFacets.types).toEqual([{ value: 'board', count: 1 }]);
    expect(kidFacets.tags).toEqual([{ name: 'family', count: 1 }]);
    expect(kidFacets.locations.find((l) => l.id === shelf)?.count).toBe(0);
    expect(kidFacets.locations.find((l) => l.id === basement)?.count).toBe(0);
    expect(kidFacets.owners).toEqual([]);
    expect(kidFacets.availability).toBeNull();
    expect(JSON.stringify(kidFacets)).not.toMatch(/hush|video|Secret/);

    const adminFacets = await catalogFacets(admin);
    expect(adminFacets.types.map((t) => [t.value, t.count])).toEqual([
      ['board', 2],
      ['video', 1],
    ]);
    expect(adminFacets.tags.map((t) => t.name)).toEqual(['family', 'hush']);
    expect(adminFacets.locations.find((l) => l.id === basement)?.count).toBe(1);
  });
});

describe('facets under filters', () => {
  it('counts each facet under the other filters but not its own', async () => {
    await createGame(admin, { title: 'A', type: 'board', tags: ['x'] });
    await createGame(admin, { title: 'B', type: 'card', tags: ['x'] });
    await createGame(admin, { title: 'C', type: 'card', tags: ['y'] });

    const facets = await catalogFacets(admin, { type: 'card', tag: 'x' });
    // Types are counted with the tag filter applied but the type filter left out.
    expect(facets.types.map((t) => [t.value, t.count])).toEqual([
      ['board', 1],
      ['card', 1],
    ]);
    // Tags are counted with the type filter applied but the tag filter left out.
    expect(facets.tags.map((t) => [t.name, t.count])).toEqual([
      ['x', 1],
      ['y', 1],
    ]);
  });

  it('rolls location counts up the tree and counts each game once', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    await addCopy(admin, catan.id, { locationId: shelf });
    await addCopy(admin, catan.id, { locationId: basement });
    const facets = await catalogFacets(admin);
    expect(facets.locations.find((l) => l.id === basement)?.count).toBe(1);
    expect(facets.locations.find((l) => l.id === shelf)?.count).toBe(1);
  });
});

describe('library summary', () => {
  it('counts games, shelves, loans, overdue and due this week', async () => {
    const make = async (title: string, dueOn: string | null) => {
      const g = await createGame(admin, { title, type: 'board' });
      const c = await addCopy(admin, g.id, { locationId: shelf });
      await lendCopy(admin, { copyId: c.id, borrower: 'Pat', dueOn });
    };
    await make('Late', day(-3));
    await make('Soon', day(2));
    await make('Open', null);
    await createGame(admin, { title: 'Home', type: 'board' });

    expect(await librarySummary(admin)).toEqual({
      games: 4,
      shelves: 1,
      onLoan: 3,
      overdue: 1,
      dueThisWeek: 1,
    });
    expect(await librarySummary(kid)).toEqual({
      games: 4,
      shelves: 1,
      onLoan: 0,
      overdue: 0,
      dueThisWeek: 0,
    });
  });
});

describe('expansions in the catalog', () => {
  it('leaves expansions out of browsing and counts, but search finds them with their base', async () => {
    const base = await createGame(admin, { title: 'Catan', type: 'board' });
    await createGame(admin, {
      title: 'Seafarers',
      type: 'board',
      isExpansion: true,
      baseGameId: base.id,
    });
    expect((await listCatalogPage(admin)).rows.map((r) => r.title)).toEqual(['Catan']);
    expect((await librarySummary(admin)).games).toBe(1);

    const found = await listCatalogPage(admin, { search: 'sea' });
    expect(found.rows.map((r) => [r.title, r.baseTitle])).toEqual([['Seafarers', 'Catan']]);
  });

  it('does not name a hidden base game to a restricted profile', async () => {
    const base = await createGame(admin, {
      title: 'Hidden base',
      type: 'board',
      visibility: 'hidden_restricted',
    });
    await createGame(admin, {
      title: 'Visible add-on',
      type: 'board',
      isExpansion: true,
      baseGameId: base.id,
    });
    const found = await listCatalogPage(kid, { search: 'add-on' });
    expect(found.rows.map((r) => [r.title, r.baseTitle])).toEqual([['Visible add-on', null]]);
  });
});
