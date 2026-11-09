import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { ratings } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { listCatalog } from './catalog';
import { createGame, getGameDetail } from './games';
import { createShareLink, guestCatalog, guestGame, resolveShareLink } from './guest';
import { clearRating, ratingSummary, setRating } from './ratings';

let db: Db;
let admin: DataContext;
let member: DataContext;
let kid: DataContext;
let gameId: string;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const m = await createUser(db, a.householdId, {
    name: 'Max',
    email: 'max@example.com',
    password: 'password123',
    role: 'member',
  });
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const k = await createUser(db, a.householdId, {
    name: 'Kid',
    email: 'kid@example.com',
    password: 'password123',
    role: 'restricted',
  });
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
  gameId = (await createGame(admin, { title: 'Catan', type: 'board', shareable: true })).id;
});

describe('ratings', () => {
  it('keeps one score per user and reports the family average', async () => {
    await setRating(admin, gameId, 5);
    await setRating(member, gameId, 4);
    await setRating(member, gameId, 3); // changes Max's score, does not add a second
    const forAdmin = await ratingSummary(admin, gameId);
    expect(forAdmin).toEqual({ mine: 5, average: 4, count: 2 });
    expect((await ratingSummary(member, gameId)).mine).toBe(3);
    await clearRating(member, gameId);
    expect(await ratingSummary(admin, gameId)).toEqual({ mine: 5, average: 5, count: 1 });
  });

  it('rejects scores outside 1 to 5', async () => {
    await expect(setRating(admin, gameId, 0)).rejects.toThrow();
    await expect(setRating(admin, gameId, 6)).rejects.toThrow();
    await expect(setRating(admin, gameId, 3.5)).rejects.toThrow();
    expect(await db.select().from(ratings)).toHaveLength(0);
  });

  it('reports no average when nobody has rated', async () => {
    expect(await ratingSummary(admin, gameId)).toEqual({ mine: null, average: null, count: 0 });
  });

  it('is closed to restricted profiles', async () => {
    await expect(setRating(kid, gameId, 5)).rejects.toThrow(/cannot/);
    await expect(ratingSummary(kid, gameId)).rejects.toThrow(/cannot/);
    await expect(clearRating(kid, gameId)).rejects.toThrow(/cannot/);
  });

  it('cannot rate a game the viewer cannot see, or one that does not exist', async () => {
    const hidden = await createGame(admin, {
      title: 'Hidden',
      type: 'board',
      visibility: 'hidden_restricted',
    });
    // A member can see it; a restricted profile cannot rate at all, so check the not-found path.
    await setRating(member, hidden.id, 4);
    await expect(setRating(member, crypto.randomUUID(), 4)).rejects.toThrow(/not found/);
    await expect(setRating(member, 'not-a-uuid', 4)).rejects.toThrow(/not found/);
  });

  it('never appears in restricted or guest responses', async () => {
    await setRating(admin, gameId, 5);
    await setRating(member, gameId, 1);

    const catalog = JSON.stringify(await listCatalog(kid));
    const detail = JSON.stringify(await getGameDetail(kid, gameId));
    for (const json of [catalog, detail]) expect(json).not.toMatch(/rating|score/i);

    const { token } = await createShareLink(admin, { label: 'Neighbours' });
    const link = (await resolveShareLink(db, token))!;
    const guestJson = JSON.stringify([
      await guestCatalog(db, link, {}),
      await guestGame(db, link, gameId),
    ]);
    expect(guestJson).not.toMatch(/rating|score|average/i);
  });
});
