import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { playParticipants, players } from '../db/schema';
import { createdFields, recordAudit } from './audit';
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
