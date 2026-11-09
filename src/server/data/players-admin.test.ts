import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog, playParticipants, players } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { createGame } from './games';
import { logPlay, playsForGame } from './plays';
import { deletePlayer, linkPlayerToUser, listPlayers, mergePlayers, renamePlayer } from './players';

let db: Db;
let householdId: string;
let joe: DataContext;
let jane: DataContext;
let gameId: string;

const named = async (ctx: DataContext, name: string) =>
  (await listPlayers(ctx)).find((p) => p.displayName === name)!;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Joe',
    email: 'joe@example.com',
    password: 'password123',
  });
  householdId = a.householdId;
  joe = createContext(db, householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const j = await createUser(
    db,
    householdId,
    { name: 'Jane', email: 'jane@example.com', password: 'password123', role: 'member' },
    a.id,
  );
  jane = createContext(db, householdId, { kind: 'user', userId: j.id, role: 'member' });
  gameId = (await createGame(joe, { title: 'Catan', type: 'board' })).id;
});

describe('game night with friends', () => {
  it('lets a member record non-users, then an admin links John to his new account', async () => {
    // The next day, Jane records game night. Nobody here has an account.
    await logPlay(jane, {
      gameId,
      playedOn: '2026-11-07',
      playerIds: [(await named(jane, 'Jane')).id],
      newPlayers: ['John', 'Sarah', 'Mikey', 'Melissa'],
    });
    await logPlay(jane, {
      gameId,
      playedOn: '2026-11-08',
      playerIds: [(await named(jane, 'Jane')).id, (await named(jane, 'John')).id],
    });
    expect((await named(joe, 'John')).plays).toBe(2);

    // Months later John gets an account.
    const johnUser = await createUser(
      db,
      householdId,
      { name: 'John Smith', email: 'john@example.com', password: 'password123', role: 'member' },
      joe.viewer.userId,
    );
    const anonymousJohn = await named(joe, 'John');
    const result = await linkPlayerToUser(joe, anonymousJohn.id, johnUser.id);
    expect(result).toMatchObject({ ok: true, moved: 2 });

    // History now belongs to the account's player; the anonymous row is gone.
    const all = await listPlayers(joe);
    expect(all.find((p) => p.displayName === 'John')).toBeUndefined();
    const account = all.find((p) => p.userId === johnUser.id)!;
    expect(account.displayName).toBe('John Smith');
    expect(account.plays).toBe(2);

    const plays = await playsForGame(joe, gameId);
    for (const play of plays) {
      expect(play.participants.map((p) => p.displayName)).toContain('John Smith');
      expect(play.participants.map((p) => p.displayName)).not.toContain('John');
    }
  });

  it('keeps one participant row when both players were in the same session', async () => {
    const play = await logPlay(jane, { gameId, newPlayers: ['John', 'Jon'] });
    const john = await named(joe, 'John');
    const jon = await named(joe, 'Jon');
    const merged = await mergePlayers(joe, jon.id, john.id);
    expect(merged).toMatchObject({ ok: true, survivorId: john.id, moved: 1 });
    const rows = await db
      .select()
      .from(playParticipants)
      .where(eq(playParticipants.playId, play.id));
    expect(rows).toHaveLength(1);
    expect(await db.select().from(players).where(eq(players.id, jon.id))).toHaveLength(0);
  });

  it('never orphans an account when merging, whichever way round', async () => {
    await logPlay(jane, { gameId, newPlayers: ['Janie'] });
    const janie = await named(joe, 'Janie');
    const account = await named(joe, 'Jane');
    const result = await mergePlayers(joe, account.id, janie.id); // account passed as "from"
    expect(result).toMatchObject({ ok: true, survivorId: account.id });
    expect((await named(joe, 'Jane')).plays).toBe(1);
  });

  it('refuses to merge two accounts, a player into itself, or an unknown id', async () => {
    const a = await named(joe, 'Joe');
    const b = await named(joe, 'Jane');
    expect(await mergePlayers(joe, a.id, b.id)).toEqual({ ok: false, reason: 'both_linked' });
    expect(await mergePlayers(joe, a.id, a.id)).toEqual({ ok: false, reason: 'same_player' });
    expect(await mergePlayers(joe, a.id, crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('refuses to link a player that already has an account', async () => {
    const janePlayer = await named(joe, 'Jane');
    const result = await linkPlayerToUser(joe, janePlayer.id, joe.viewer.userId);
    expect(result).toEqual({ ok: false, reason: 'already_linked' });
  });

  it('keeps history when an account is deleted', async () => {
    const { users } = await import('../db/schema');
    await logPlay(joe, { gameId, playerIds: [(await named(joe, 'Jane')).id] });
    await db.delete(users).where(eq(users.id, jane.viewer.userId));
    const janePlayer = await named(joe, 'Jane');
    expect(janePlayer.userId).toBeNull();
    expect(janePlayer.plays).toBe(1);
  });

  it('only deletes a player with no plays and no account', async () => {
    await logPlay(jane, { gameId, newPlayers: ['John'] });
    await logPlay(jane, { gameId, newPlayers: ['Idle'] }); // has a play, then we remove it below
    const john = await named(joe, 'John');
    expect(await deletePlayer(joe, john.id)).toMatchObject({ ok: false, reason: 'has_plays' });
    expect(await deletePlayer(joe, (await named(joe, 'Jane')).id)).toMatchObject({
      ok: false,
      reason: 'is_user',
    });
    await db.delete(playParticipants).where(eq(playParticipants.playerId, john.id));
    expect(await deletePlayer(joe, john.id)).toEqual({ ok: true });
  });

  it('is admin-only, household-scoped, and audited', async () => {
    await logPlay(jane, { gameId, newPlayers: ['John'] });
    const john = await named(joe, 'John');
    await expect(renamePlayer(jane, john.id, 'Johnny')).rejects.toThrow(/admins/);
    await expect(mergePlayers(jane, john.id, john.id)).rejects.toThrow(/admins/);
    await expect(linkPlayerToUser(jane, john.id, jane.viewer.userId)).rejects.toThrow(/admins/);
    await expect(deletePlayer(jane, john.id)).rejects.toThrow(/admins/);

    expect(await renamePlayer(joe, john.id, '  Johnny   B ')).toBe(true);
    expect((await named(joe, 'Johnny B')).id).toBe(john.id);
    const rename = (
      await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, john.id), eq(auditLog.action, 'update')))
    )[0];
    expect(rename?.changes.displayName).toEqual(['John', 'Johnny B']);

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
    expect(await renamePlayer(other, john.id, 'Hacked')).toBe(false);
    expect(await mergePlayers(other, john.id, john.id)).toEqual({
      ok: false,
      reason: 'same_player',
    });
    expect(await deletePlayer(other, john.id)).toEqual({ ok: false, reason: 'not_found' });
  });
});
