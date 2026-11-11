import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog, copies, games, playSessions, ratings, wishlistItems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { listCatalog } from './catalog';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy } from './copies';
import { createGame, deleteGame, getGameDetail, updateGame } from './games';
import { createShareLink, guestCatalog, resolveShareLink } from './guest';
import { lendCopy, listLendableCopies } from './loans';
import { createLocation, deleteLocation, listLocationOptions } from './lookups';
import { deletePlay, logPlay, playStats, recentPlays } from './plays';
import { deletePlayer, listPlayers } from './players';
import { ratingSummary, setRating } from './ratings';
import {
  listTrash,
  purgeDate,
  purgeExpiredTrash,
  purgeTrashed,
  restoreTrashed,
  retentionDays,
} from './trash';
import { addWishlistItem, listWishlist, removeWishlistItem } from './wishlist';

let db: Db;
let admin: DataContext;
let member: DataContext;
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
  const make = (name: string, role: 'member' | 'restricted') =>
    createUser(db, a.householdId, {
      name,
      email: `${name.toLowerCase()}@example.com`,
      password: 'password123',
      role,
    });
  const m = await make('Max', 'member');
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const k = await make('Kid', 'restricted');
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

const mk = (title: string, extra = {}) => createGame(admin, { title, type: 'board', ...extra });

describe('deleting a game', () => {
  it('hides it and its plays everywhere, and restoring brings them back', async () => {
    const game = await mk('Catan', { shareable: true });
    await logPlay(admin, { gameId: game.id, newPlayers: ['John'] });
    await setRating(admin, game.id, 4);
    const { token } = await createShareLink(admin, { label: 'Friends' });
    const link = (await resolveShareLink(db, token))!;
    expect(await guestCatalog(db, link)).toHaveLength(1);

    expect(await deleteGame(admin, game.id)).toEqual({ ok: true });
    expect(await getGameDetail(admin, game.id)).toBeNull();
    expect(await listCatalog(admin)).toHaveLength(0);
    expect(await recentPlays(admin)).toHaveLength(0);
    expect((await playStats(admin)).mostPlayed).toHaveLength(0);
    expect(await guestCatalog(db, link)).toHaveLength(0);
    // Nothing was destroyed.
    expect(await db.select().from(playSessions)).toHaveLength(1);
    expect(await db.select().from(ratings)).toHaveLength(1);

    expect(await restoreTrashed(admin, 'game', game.id)).toEqual({ ok: true });
    expect((await getGameDetail(admin, game.id))?.game.title).toBe('Catan');
    expect(await recentPlays(admin)).toHaveLength(1);
    expect((await ratingSummary(admin, game.id)).average).toBe(4);
  });

  it('refuses while the game has owned copies, and allows it once they are gone', async () => {
    const game = await mk('Catan');
    const copy = await addCopy(admin, game.id, {});
    expect(await deleteGame(admin, game.id)).toEqual({
      ok: false,
      reason: 'has_copies',
      copies: 1,
    });
    await deleteCopy(admin, copy.id);
    expect(await deleteGame(admin, game.id)).toEqual({ ok: true });
  });

  it('cannot be edited, copied, rated or played while in the trash', async () => {
    const game = await mk('Catan');
    await deleteGame(admin, game.id);
    expect(await updateGame(admin, game.id, { title: 'X', type: 'board' })).toBeNull();
    await expect(addCopy(admin, game.id, {})).rejects.toThrow(/not found/);
    await expect(logPlay(admin, { gameId: game.id, newPlayers: ['A'] })).rejects.toThrow(
      /not found/,
    );
    await expect(setRating(admin, game.id, 3)).rejects.toThrow(/not found/);
  });

  it('keeps expansions, which lose the base game only until it is restored', async () => {
    const base = await mk('Catan');
    const exp = await mk('Seafarers', { isExpansion: true, baseGameId: base.id });
    await deleteGame(admin, base.id);
    expect((await getGameDetail(admin, exp.id))?.baseGame).toBeNull();
    await restoreTrashed(admin, 'game', base.id);
    expect((await getGameDetail(admin, exp.id))?.baseGame?.title).toBe('Catan');
  });
});

describe('deleting a copy', () => {
  it('stops it counting as owned, and restoring needs the game to be live', async () => {
    const game = await mk('Catan');
    const copy = await addCopy(admin, game.id, {});
    await lendCopy(admin, { copyId: copy.id, borrower: 'Dana' });
    await deleteCopy(admin, copy.id);
    expect((await getGameDetail(admin, game.id))?.copies).toHaveLength(0);
    expect(await listLendableCopies(admin)).toHaveLength(0);

    await deleteGame(admin, game.id);
    expect(await restoreTrashed(admin, 'copy', copy.id)).toEqual({
      ok: false,
      error: 'Restore the game first.',
    });
    await restoreTrashed(admin, 'game', game.id);
    expect(await restoreTrashed(admin, 'copy', copy.id)).toEqual({ ok: true });
    expect((await getGameDetail(admin, game.id))?.copies).toHaveLength(1);
  });
});

describe('deleting plays, wishlist items, places and players', () => {
  it('hides each one and restores it', async () => {
    const game = await mk('Catan');
    const play = await logPlay(admin, { gameId: game.id, newPlayers: ['John'] });
    await deletePlay(admin, play.id);
    expect(await recentPlays(admin)).toHaveLength(0);
    await restoreTrashed(admin, 'play', play.id);
    expect(await recentPlays(admin)).toHaveLength(1);

    const wish = await addWishlistItem(admin, { title: 'Azul' });
    await removeWishlistItem(admin, wish.id);
    expect(await listWishlist(admin)).toHaveLength(0);
    await restoreTrashed(admin, 'wishlist_item', wish.id);
    expect(await listWishlist(admin)).toHaveLength(1);

    const hall = await createLocation(admin, 'Hall');
    expect(await deleteLocation(admin, hall.id)).toEqual({ ok: true });
    expect(await listLocationOptions(admin)).toHaveLength(0);
    await restoreTrashed(admin, 'location', hall.id);
    expect(await listLocationOptions(admin)).toHaveLength(1);

    const [john] = (await listPlayers(admin)).filter((p) => p.displayName === 'John');
    const spare = await logPlay(admin, { gameId: game.id, newPlayers: ['Spare'] });
    await deletePlay(admin, spare.id);
    expect(john).toBeDefined();
    // A player who took part in a play cannot be removed, trashed plays included.
    expect(await deletePlayer(admin, john!.id)).toMatchObject({ ok: false, reason: 'has_plays' });
  });

  it('a place cannot be restored while the place it sat in is deleted, and not at all if copies sit in a trashed place', async () => {
    const house = await createLocation(admin, 'House');
    const hall = await createLocation(admin, 'Hall', house.id);
    await deleteLocation(admin, hall.id);
    await deleteLocation(admin, house.id);
    expect(await restoreTrashed(admin, 'location', hall.id)).toMatchObject({ ok: false });
    await restoreTrashed(admin, 'location', house.id);
    expect(await restoreTrashed(admin, 'location', hall.id)).toEqual({ ok: true });
  });
});

describe('who can use the trash', () => {
  it('lets members restore their own deletions only; admins see and do everything', async () => {
    const mine = await addWishlistItem(member, { title: 'Mine' });
    const theirs = await addWishlistItem(admin, { title: 'Theirs' });
    await removeWishlistItem(member, mine.id);
    await removeWishlistItem(admin, theirs.id);

    expect((await listTrash(member)).map((t) => t.title)).toEqual(['Mine']);
    expect((await listTrash(admin)).map((t) => t.title).toSorted()).toEqual(['Mine', 'Theirs']);
    expect((await restoreTrashed(member, 'wishlist_item', theirs.id)).ok).toBe(false);
    expect(await restoreTrashed(member, 'wishlist_item', mine.id)).toEqual({ ok: true });
    await expect(purgeTrashed(member, 'wishlist_item', theirs.id)).rejects.toThrow(/admin/);
    expect(await restoreTrashed(admin, 'wishlist_item', theirs.id)).toEqual({ ok: true });
    await expect(listTrash(kid)).rejects.toThrow(/Restricted/);
  });

  it('is scoped to the household', async () => {
    const wish = await addWishlistItem(admin, { title: 'Azul' });
    await removeWishlistItem(admin, wish.id);
    expect(await listTrash(other)).toEqual([]);
    expect((await restoreTrashed(other, 'wishlist_item', wish.id)).ok).toBe(false);
    expect((await purgeTrashed(other, 'wishlist_item', wish.id)).ok).toBe(false);
  });
});

describe('deleting for good', () => {
  it('only removes things already in the trash, taking a game’s plays and ratings with it', async () => {
    const live = await mk('Live');
    expect((await purgeTrashed(admin, 'game', live.id)).ok).toBe(false);
    const game = await mk('Catan');
    await logPlay(admin, { gameId: game.id, newPlayers: ['John'] });
    await setRating(admin, game.id, 2);
    await deleteGame(admin, game.id);
    expect(await purgeTrashed(admin, 'game', game.id)).toMatchObject({ ok: true });
    expect(await db.select().from(playSessions).where(eq(playSessions.gameId, game.id))).toEqual(
      [],
    );
    expect(await db.select().from(ratings).where(eq(ratings.gameId, game.id))).toEqual([]);
    expect(await listTrash(admin)).toEqual([]);
    expect((await getGameDetail(admin, live.id))?.game.title).toBe('Live');
  });
});

describe('automatic purge', () => {
  it('reads the retention period from the environment', () => {
    expect(retentionDays({})).toBe(30);
    expect(retentionDays({ TRASH_RETENTION_DAYS: '7' })).toBe(7);
    expect(retentionDays({ TRASH_RETENTION_DAYS: '0' })).toBe(0);
    expect(retentionDays({ TRASH_RETENTION_DAYS: 'soon' })).toBe(30);
    expect(purgeDate(new Date('2026-01-01T00:00:00Z'), 30)?.toISOString()).toBe(
      '2026-01-31T00:00:00.000Z',
    );
    expect(purgeDate(new Date(), 0)).toBeNull();
  });

  it('deletes only what has been in the trash longer than the retention period', async () => {
    const old = await mk('Old');
    const recent = await mk('Recent');
    const wish = await addWishlistItem(admin, { title: 'Azul' });
    await deleteGame(admin, old.id);
    await deleteGame(admin, recent.id);
    await removeWishlistItem(admin, wish.id);
    const day = 86_400_000;
    await db
      .update(games)
      .set({ deletedAt: new Date(Date.now() - 40 * day) })
      .where(eq(games.id, old.id));
    await db
      .update(games)
      .set({ deletedAt: new Date(Date.now() - 5 * day) })
      .where(eq(games.id, recent.id));
    await db
      .update(wishlistItems)
      .set({ deletedAt: new Date(Date.now() - 31 * day) })
      .where(eq(wishlistItems.id, wish.id));

    expect(await purgeExpiredTrash(db, new Date(), 0)).toEqual({ purged: 0, covers: [] });
    const result = await purgeExpiredTrash(db, new Date(), 30);
    expect(result.purged).toBe(2);
    expect((await listTrash(admin)).map((t) => t.title)).toEqual(['Recent']);
    expect(await db.select().from(wishlistItems)).toHaveLength(0);
    const logged = await db.select().from(auditLog).where(eq(auditLog.action, 'delete'));
    expect(logged.map((e) => e.entityType).toSorted()).toEqual(['game', 'wishlist_item']);
    expect(logged.every((e) => e.actorUserId === null)).toBe(true);
  });

  it('removes a trashed copy along with its game', async () => {
    const game = await mk('Catan');
    const copy = await addCopy(admin, game.id, {});
    await deleteCopy(admin, copy.id);
    await deleteGame(admin, game.id);
    await db
      .update(games)
      .set({ deletedAt: new Date(Date.now() - 90 * 86_400_000) })
      .where(eq(games.id, game.id));
    await purgeExpiredTrash(db, new Date(), 30);
    expect(await db.select().from(copies)).toHaveLength(0);
  });
});
