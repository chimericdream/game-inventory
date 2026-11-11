import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog, copies, games } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { eq } from 'drizzle-orm';
import { lastEdit, recentActivity } from './audit';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy, updateCopy } from './copies';
import { createGame, deleteGame, setCoverImage, updateGame } from './games';
import { purgeTrashed } from './trash';
import { createShareLink, revokeShareLink } from './guest';
import { lendCopy, returnLoan } from './loans';
import { createLocation } from './lookups';
import { logPlay } from './plays';
import { addWishlistItem, removeWishlistItem } from './wishlist';

let db: Db;
let admin: DataContext;
let member: DataContext;
let kid: DataContext;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const m = await createUser(
    db,
    a.householdId,
    { name: 'Max', email: 'max@example.com', password: 'password123', role: 'member' },
    a.id,
  );
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const k = await createUser(db, a.householdId, {
    name: 'Kid',
    email: 'kid@example.com',
    password: 'password123',
    role: 'restricted',
  });
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
});

const entries = () => db.select().from(auditLog);

describe('audit trail', () => {
  it('records who created a game and stamps the row', async () => {
    const game = await createGame(member, { title: 'Catan', type: 'board' });
    expect(game.createdByUserId).toBe(member.viewer.userId);
    expect(game.updatedByUserId).toBe(member.viewer.userId);
    const last = await lastEdit(admin, 'game', game.id);
    expect(last?.action).toBe('create');
    expect(last?.actorName).toBe('Max');
    expect(last?.changes.title).toEqual([null, 'Catan']);
  });

  it('records only the fields that changed, and who changed them', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board', tags: ['family'] });
    await updateGame(member, game.id, {
      title: 'Catan',
      type: 'board',
      notes: 'Missing a brick',
      tags: ['family', 'trading'],
    });
    const last = await lastEdit(admin, 'game', game.id);
    expect(last?.action).toBe('update');
    expect(last?.actorName).toBe('Max');
    expect(Object.keys(last!.changes).toSorted()).toEqual(['notes', 'tags']);
    expect(last?.changes.notes).toEqual([null, 'Missing a brick']);
    expect(last?.changes.tags).toEqual([['family'], ['family', 'trading']]);
    const [row] = await db.select().from(games).where(eq(games.id, game.id));
    expect(row?.updatedByUserId).toBe(member.viewer.userId);
    expect(row?.createdByUserId).toBe(admin.viewer.userId);
  });

  it('writes no entry for an edit that changes nothing', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const before = (await entries()).length;
    await updateGame(admin, game.id, { title: 'Catan', type: 'board' });
    expect((await entries()).length).toBe(before);
  });

  it('logs copies, loans, plays, wishlist, locations, covers and deletes', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, { condition: 'like_new' });
    await updateCopy(admin, copy.id, { condition: 'worn', conditionNotes: 'Box corner' });
    const loan = await lendCopy(admin, { copyId: copy.id, borrower: 'Dana' });
    await returnLoan(admin, loan.id, '2026-01-02');
    await logPlay(admin, { gameId: game.id, newPlayers: ['John'] });
    const wish = await addWishlistItem(admin, { title: 'Azul' });
    await removeWishlistItem(admin, wish.id);
    await purgeTrashed(admin, 'wishlist_item', wish.id);
    await createLocation(admin, 'Basement');
    await setCoverImage(admin, game.id, 'covers/x.png');
    await deleteCopy(admin, copy.id);
    await deleteGame(admin, game.id);
    await purgeTrashed(admin, 'game', game.id);

    const seen = (await entries()).map((e) => `${e.entityType}:${e.action}`);
    for (const expected of [
      'game:create',
      'copy:create',
      'copy:update',
      'loan:create',
      'loan:update',
      'play:create',
      'player:create',
      'wishlist_item:create',
      'wishlist_item:delete',
      'location:create',
      'game:update',
      'game:delete',
    ]) {
      expect(seen).toContain(expected);
    }
    const copyUpdate = (await entries()).find(
      (e) => e.entityType === 'copy' && e.action === 'update',
    );
    expect(copyUpdate?.changes.condition).toEqual(['like_new', 'worn']);
    expect(copyUpdate?.changes.conditionNotes).toEqual([null, 'Box corner']);
  });

  it('logs share links without ever storing the token', async () => {
    const { link, token } = await createShareLink(admin, { label: 'Neighbours' });
    await revokeShareLink(admin, link.id);
    const rows = await entries();
    expect(rows.filter((e) => e.entityType === 'share_link').map((e) => e.action)).toEqual([
      'create',
      'update',
    ]);
    const json = JSON.stringify(rows);
    expect(json).not.toContain(token);
    expect(json).not.toContain(link.tokenHash);
  });

  it('logs account creation without the password or its hash', async () => {
    const rows = (await entries()).filter((e) => e.entityType === 'user');
    expect(rows).toHaveLength(2); // the admin at setup, plus Max added by Ada (Kid had no actor)
    const json = JSON.stringify(rows);
    expect(json).not.toMatch(/password/i);
    expect(json).not.toContain('scrypt');
  });

  it('leaves no entry behind when the change fails', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const before = (await entries()).length;
    await expect(
      lendCopy(admin, { copyId: '00000000-0000-4000-8000-000000000000', borrower: 'X' }),
    ).rejects.toThrow();
    await expect(addCopy(admin, game.id, { ownerUserId: crypto.randomUUID() })).rejects.toThrow();
    expect((await entries()).length).toBe(before);
    expect(await db.select().from(copies)).toHaveLength(0);
  });

  it('lists household activity newest first and pages through it', async () => {
    for (const title of ['A', 'B', 'C', 'D']) await createGame(admin, { title, type: 'board' });
    const first = await recentActivity(admin, { limit: 3 });
    expect(first).toHaveLength(3);
    const rest = await recentActivity(admin, {
      limit: 50,
      before: { at: first[2]!.at, id: first[2]!.id },
    });
    const all = await recentActivity(admin, { limit: 50 });
    expect([...first, ...rest].map((e) => e.id)).toEqual(all.map((e) => e.id));
    expect(first[0]?.changes.title).toEqual([null, 'D']);
  });

  it('is closed to restricted profiles and scoped to the household', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    await expect(recentActivity(kid)).rejects.toThrow(/cannot/);
    await expect(lastEdit(kid, 'game', game.id)).rejects.toThrow(/cannot/);

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
    const other = createContext(db, h2!.id, { kind: 'user', userId: u2!.id, role: 'admin' });
    expect(await recentActivity(other)).toHaveLength(0);
    expect(await lastEdit(other, 'game', game.id)).toBeNull();
  });
});
