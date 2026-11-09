import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { playParticipants, players, users } from '../db/schema';
import { createdFields, deletedFields, recordAudit, stampUpdate } from './audit';
import type { DataContext } from './context';

/**
 * Players are the people who appear in plays. A player may be linked to a user account or not;
 * visiting friends and relatives are players with no account. A player holds only a display name.
 */

export class DuplicatePlayerError extends Error {
  constructor(
    readonly name: string,
    readonly existingId: string,
  ) {
    super(`A player named "${name}" already exists`);
  }
}

export interface PlayerRef {
  id: string;
  displayName: string;
  userId: string | null;
}

export function assertCanUsePlayers(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot use players');
}

const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ');

/** Case-insensitive lookup. If several share a name, the oldest wins. */
export async function findPlayerByName(
  db: Db,
  householdId: string,
  name: string,
): Promise<PlayerRef | null> {
  const [row] = await db
    .select({ id: players.id, displayName: players.displayName, userId: players.userId })
    .from(players)
    .where(
      and(
        eq(players.householdId, householdId),
        sql`lower(${players.displayName}) = ${cleanName(name).toLowerCase()}`,
      ),
    )
    .orderBy(asc(players.createdAt))
    .limit(1);
  return row ?? null;
}

/** Every user has exactly one linked player. Safe to call again: it never creates a second. */
export async function ensurePlayerForUser(
  db: Db,
  user: { householdId: string; id: string; name: string },
) {
  await db
    .insert(players)
    .values({
      householdId: user.householdId,
      displayName: cleanName(user.name),
      userId: user.id,
      createdByUserId: user.id,
      updatedByUserId: user.id,
    })
    .onConflictDoNothing({ target: players.userId });
}

/** Creates a non-user player. Throws `DuplicatePlayerError` if the name is already taken. */
export async function createPlayerIn(
  db: Db,
  ctx: DataContext,
  rawName: string,
): Promise<PlayerRef> {
  const name = cleanName(rawName);
  if (!name) throw new Error('A player needs a name');
  if (name.length > 60) throw new Error('Player names are limited to 60 characters');
  const existing = await findPlayerByName(db, ctx.householdId, name);
  if (existing) throw new DuplicatePlayerError(name, existing.id);
  const [row] = await db
    .insert(players)
    .values({
      householdId: ctx.householdId,
      displayName: name,
      createdByUserId: ctx.viewer.userId,
      updatedByUserId: ctx.viewer.userId,
    })
    .returning({ id: players.id, displayName: players.displayName, userId: players.userId });
  await recordAudit(db, ctx, {
    entityType: 'player',
    entityId: row!.id,
    action: 'create',
    changes: createdFields({ displayName: row!.displayName }),
  });
  return row!;
}

export async function createPlayer(ctx: DataContext, name: string): Promise<PlayerRef> {
  assertCanUsePlayers(ctx);
  return createPlayerIn(ctx.db, ctx, name);
}

export interface PlayerSummary extends PlayerRef {
  plays: number;
}

export async function listPlayers(ctx: DataContext): Promise<PlayerSummary[]> {
  assertCanUsePlayers(ctx);
  const rows = await ctx.db
    .select({
      id: players.id,
      displayName: players.displayName,
      userId: players.userId,
      plays: sql<number>`(select count(*)::int from ${playParticipants} pp where pp.player_id = ${players.id})`,
    })
    .from(players)
    .where(eq(players.householdId, ctx.householdId))
    .orderBy(asc(players.displayName));
  return rows;
}

/** Name to id for a list of typed names, creating any that do not exist yet. */
export async function resolvePlayerNames(ctx: DataContext, names: string[]): Promise<string[]> {
  assertCanUsePlayers(ctx);
  return ctx.db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const raw of names) {
      const name = cleanName(raw);
      if (!name) continue;
      const found = await findPlayerByName(tx, ctx.householdId, name);
      ids.push(found ? found.id : (await createPlayerIn(tx, ctx, name)).id);
    }
    return [...new Set(ids)];
  });
}

export async function loadParticipants(db: Db, householdId: string, playIds: string[]) {
  const map = new Map<string, PlayerRef[]>();
  if (playIds.length === 0) return map;
  const rows = await db
    .select({
      playId: playParticipants.playId,
      id: players.id,
      displayName: players.displayName,
      userId: players.userId,
    })
    .from(playParticipants)
    .innerJoin(players, eq(players.id, playParticipants.playerId))
    .where(
      and(eq(playParticipants.householdId, householdId), inArray(playParticipants.playId, playIds)),
    )
    .orderBy(asc(players.displayName));
  for (const { playId, ...p } of rows) {
    const list = map.get(playId) ?? [];
    list.push(p);
    map.set(playId, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Admin operations: rename, delete, link to an account, merge duplicates
// ---------------------------------------------------------------------------

function assertAdmin(ctx: DataContext) {
  if (ctx.viewer.role !== 'admin') throw new Error('Only admins can manage players');
}

async function getPlayer(db: Db, householdId: string, id: string) {
  const [row] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, id), eq(players.householdId, householdId)));
  return row ?? null;
}

async function countPlays(db: Db, playerId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(playParticipants)
    .where(eq(playParticipants.playerId, playerId));
  return row?.n ?? 0;
}

export async function renamePlayer(ctx: DataContext, id: string, rawName: string) {
  assertAdmin(ctx);
  const name = cleanName(rawName);
  if (!name) throw new Error('A player needs a name');
  if (name.length > 60) throw new Error('Player names are limited to 60 characters');
  return ctx.db.transaction(async (tx) => {
    const before = await getPlayer(tx, ctx.householdId, id);
    if (!before) return false;
    if (before.displayName === name) return true;
    await tx
      .update(players)
      .set({ displayName: name, ...stampUpdate(ctx) })
      .where(eq(players.id, id));
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: id,
      action: 'update',
      changes: { displayName: [before.displayName, name] },
    });
    return true;
  });
}

export type DeletePlayerResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'has_plays' | 'is_user'; plays?: number };

/** Only a player with no plays and no account can be deleted. Otherwise merge or keep it. */
export async function deletePlayer(ctx: DataContext, id: string): Promise<DeletePlayerResult> {
  assertAdmin(ctx);
  return ctx.db.transaction(async (tx): Promise<DeletePlayerResult> => {
    const player = await getPlayer(tx, ctx.householdId, id);
    if (!player) return { ok: false, reason: 'not_found' };
    if (player.userId) return { ok: false, reason: 'is_user' };
    const plays = await countPlays(tx, id);
    if (plays > 0) return { ok: false, reason: 'has_plays', plays };
    await tx.delete(players).where(eq(players.id, id));
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: id,
      action: 'delete',
      changes: deletedFields({ displayName: player.displayName }),
    });
    return { ok: true };
  });
}

export type MergePlayersResult =
  | { ok: true; survivorId: string; moved: number }
  | { ok: false; reason: 'not_found' | 'same_player' | 'both_linked' };

/**
 * Moves every play of `fromId` onto `intoId` and deletes `fromId`. If exactly one of the two is
 * linked to an account, that one survives whichever way round they were passed, so an account is
 * never orphaned. A session both took part in keeps a single row.
 */
export async function mergePlayers(
  ctx: DataContext,
  fromId: string,
  intoId: string,
): Promise<MergePlayersResult> {
  assertAdmin(ctx);
  if (fromId === intoId) return { ok: false, reason: 'same_player' };
  return ctx.db.transaction(async (tx): Promise<MergePlayersResult> => {
    const [a, b] = await Promise.all([
      getPlayer(tx, ctx.householdId, fromId),
      getPlayer(tx, ctx.householdId, intoId),
    ]);
    if (!a || !b) return { ok: false, reason: 'not_found' };
    if (a.userId && b.userId) return { ok: false, reason: 'both_linked' };
    const [gone, survivor] = a.userId ? [b, a] : [a, b];

    const moved = await countPlays(tx, gone.id);
    await tx.execute(sql`
      insert into play_participants (household_id, play_id, player_id)
      select household_id, play_id, ${survivor.id}::uuid
      from play_participants where player_id = ${gone.id}::uuid
      on conflict do nothing`);
    await tx.delete(players).where(eq(players.id, gone.id)); // cascades its old participant rows
    await tx
      .update(players)
      .set({ ...stampUpdate(ctx) })
      .where(eq(players.id, survivor.id));
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: survivor.id,
      action: 'update',
      changes: { merged: [null, { id: gone.id, displayName: gone.displayName, plays: moved }] },
    });
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: gone.id,
      action: 'delete',
      changes: { displayName: [gone.displayName, null], mergedInto: [null, survivor.id] },
    });
    return { ok: true, survivorId: survivor.id, moved };
  });
}

export type LinkPlayerResult =
  | { ok: true; playerId: string; moved: number }
  | { ok: false; reason: 'not_found' | 'already_linked' };

/**
 * Says that a non-user player (say, a visiting friend named John) is the same person as an
 * account. If the account already has its own player (every account does), the history is merged
 * into it; the account's player survives and keeps the account's name.
 */
export async function linkPlayerToUser(
  ctx: DataContext,
  playerId: string,
  userId: string,
): Promise<LinkPlayerResult> {
  assertAdmin(ctx);
  return ctx.db.transaction(async (tx): Promise<LinkPlayerResult> => {
    const player = await getPlayer(tx, ctx.householdId, playerId);
    if (!player) return { ok: false, reason: 'not_found' };
    if (player.userId) return { ok: false, reason: 'already_linked' };
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.householdId, ctx.householdId)));
    if (!user) return { ok: false, reason: 'not_found' };

    const [accountPlayer] = await tx.select().from(players).where(eq(players.userId, userId));
    if (!accountPlayer) {
      await tx
        .update(players)
        .set({ userId, ...stampUpdate(ctx) })
        .where(eq(players.id, playerId));
      await recordAudit(tx, ctx, {
        entityType: 'player',
        entityId: playerId,
        action: 'update',
        changes: { userId: [null, userId] },
      });
      return { ok: true, playerId, moved: await countPlays(tx, playerId) };
    }

    const moved = await countPlays(tx, playerId);
    await tx.execute(sql`
      insert into play_participants (household_id, play_id, player_id)
      select household_id, play_id, ${accountPlayer.id}::uuid
      from play_participants where player_id = ${playerId}::uuid
      on conflict do nothing`);
    await tx.delete(players).where(eq(players.id, playerId));
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: accountPlayer.id,
      action: 'update',
      changes: {
        linked: [null, { id: playerId, displayName: player.displayName, plays: moved }],
      },
    });
    await recordAudit(tx, ctx, {
      entityType: 'player',
      entityId: playerId,
      action: 'delete',
      changes: { displayName: [player.displayName, null], linkedTo: [null, accountPlayer.id] },
    });
    return { ok: true, playerId: accountPlayer.id, moved };
  });
}
