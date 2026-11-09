import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy } from './copies';
import { listCatalog } from './catalog';
import { createGame } from './games';
import { lendCopy, listLendableCopies, listLoans, returnLoan } from './loans';
import { logPlay, playStats, recentPlays } from './plays';
import { addWishlistItem, listWishlist, markAcquired } from './wishlist';

let db: Db;
let admin: DataContext;
let kid: DataContext;
let other: DataContext;

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
  const { households, users } = await import('../db/schema');
  const [h2] = await db.insert(households).values({ name: 'Other' }).returning();
  const [u2] = await db
    .insert(users)
    .values({
      householdId: h2!.id,
      name: 'Bo',
      email: 'bo@example.com',
      passwordHash: 'x',
      role: 'admin',
    })
    .returning();
  other = createContext(db, h2!.id, { kind: 'user', userId: u2!.id, role: 'admin' });
});

describe('loans', () => {
  it('lends a copy, blocks double-lending, flags overdue, and records the return', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, {});
    const loan = await lendCopy(admin, { copyId: copy.id, borrower: 'Bob', dueOn: '2020-01-01' });

    await expect(lendCopy(admin, { copyId: copy.id, borrower: 'Cy' })).rejects.toThrow(/already/);
    expect(await listLendableCopies(admin)).toEqual([]);
    const active = await listLoans(admin);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ title: 'Catan', borrower: 'Bob', overdue: true });

    expect(await returnLoan(admin, loan.id)).not.toBeNull();
    expect(await listLoans(admin)).toHaveLength(0);
    expect(await listLendableCopies(admin)).toHaveLength(1);
    expect((await listLoans(admin, { includeReturned: true }))[0]?.overdue).toBe(false);
  });

  it('is isolated per household and off-limits to restricted profiles', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, {});
    await expect(lendCopy(other, { copyId: copy.id, borrower: 'Bob' })).rejects.toThrow(
      /not found/,
    );
    await expect(lendCopy(kid, { copyId: copy.id, borrower: 'Bob' })).rejects.toThrow(/cannot/);
    await expect(listLoans(kid)).rejects.toThrow(/cannot/);
  });
});

describe('wishlist', () => {
  it('adds, lists, and converts an item into a catalog game', async () => {
    const item = await addWishlistItem(admin, {
      title: 'Wingspan',
      type: 'board',
      url: 'https://example.com/w',
    });
    expect(await listWishlist(admin)).toHaveLength(1);
    const game = await markAcquired(admin, item.id);
    expect(game?.title).toBe('Wingspan');
    expect(await listWishlist(admin)).toHaveLength(0);
    expect((await listCatalog(admin)).map((g) => g.title)).toEqual(['Wingspan']);
  });

  it('rejects non-http links and restricted access', async () => {
    await expect(
      addWishlistItem(admin, { title: 'X', url: 'javascript:alert(1)' }),
    ).rejects.toThrow();
    await expect(addWishlistItem(kid, { title: 'X' })).rejects.toThrow(/cannot/);
  });
});

describe('play log', () => {
  it('logs plays and reports most played and neglected games', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    const uno = await createGame(admin, { title: 'Uno', type: 'card' });
    await createGame(admin, { title: 'Zelda', type: 'video' });
    await logPlay(admin, {
      gameId: catan.id,
      playedOn: '2020-01-01',
      newPlayers: ['Ada Guest', 'Bo'],
    });
    await logPlay(admin, { gameId: uno.id });
    await logPlay(admin, { gameId: uno.id });

    const stats = await playStats(admin);
    expect(stats.mostPlayed.map((g) => [g.title, g.plays])).toEqual([
      ['Uno', 2],
      ['Catan', 1],
    ]);
    expect(stats.neglected.map((g) => g.title)).toEqual(['Catan', 'Zelda']);
    expect((await recentPlays(admin))[0]?.title).toBe('Uno');
  });

  it('does not let another household log plays on a game', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    await expect(logPlay(other, { gameId: catan.id })).rejects.toThrow(/not found/);
  });

  it('hides restricted-hidden games from stats', async () => {
    await createGame(admin, { title: 'Secret', type: 'board', visibility: 'hidden_restricted' });
    await expect(playStats(kid)).rejects.toThrow(/cannot/);
    expect((await playStats(admin)).neglected.map((g) => g.title)).toEqual(['Secret']);
  });
});
