import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm';
import { z } from 'zod';

import { games, playParticipants, playSessions, players } from '../db/schema';
import type { DataContext } from './context';
import { createPlayerIn, loadParticipants } from './players';
import { gameVisibilityCondition } from './visibility';

const today = () => new Date().toISOString().slice(0, 10);

export const playInput = z.object({
  gameId: z.string().uuid(),
  playedOn: z.string().date().optional(),
  durationMinutes: z.number().int().min(1).max(10_000).nullable().optional(),
  /** Existing players who took part (household users and previously used guests). */
  playerIds: z.array(z.string().uuid()).max(30).default([]),
  /** Names of people who have never played before: created as non-user players on save. */
  newPlayers: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type PlayInput = z.input<typeof playInput>;

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot log plays');
}

/**
 * Logs a play with its participants in one transaction. A name in `newPlayers` that matches an
 * existing player throws `DuplicatePlayerError`, so the caller can offer the existing one instead.
 */
export async function logPlay(ctx: DataContext, raw: PlayInput) {
  assertCanEdit(ctx);
  const input = playInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [game] = await tx
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.id, input.gameId), eq(games.householdId, ctx.householdId)));
    if (!game) throw new Error('Game not found');

    const wanted = [...new Set(input.playerIds)];
    if (wanted.length) {
      const found = await tx
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.householdId, ctx.householdId), inArray(players.id, wanted)));
      if (found.length !== wanted.length) throw new Error('Unknown player');
    }
    const playerIds = [...wanted];
    for (const name of input.newPlayers) {
      playerIds.push((await createPlayerIn(tx, ctx, name)).id);
    }

    const [play] = await tx
      .insert(playSessions)
      .values({
        householdId: ctx.householdId,
        gameId: input.gameId,
        playedOn: input.playedOn ?? today(),
        durationMinutes: input.durationMinutes ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (playerIds.length) {
      await tx.insert(playParticipants).values(
        [...new Set(playerIds)].map((playerId) => ({
          householdId: ctx.householdId,
          playId: play!.id,
          playerId,
        })),
      );
    }
    return play!;
  });
}

export async function deletePlay(ctx: DataContext, id: string): Promise<boolean> {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .delete(playSessions)
    .where(and(eq(playSessions.id, id), eq(playSessions.householdId, ctx.householdId)))
    .returning({ id: playSessions.id });
  return rows.length > 0;
}

export async function recentPlays(ctx: DataContext, limit = 25) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({ play: playSessions, title: games.title, coverImage: games.coverImage })
    .from(playSessions)
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(and(eq(playSessions.householdId, ctx.householdId), gameVisibilityCondition(ctx)))
    .orderBy(desc(playSessions.playedOn), desc(playSessions.id))
    .limit(limit);
  const participants = await loadParticipants(
    ctx.db,
    ctx.householdId,
    rows.map((r) => r.play.id),
  );
  return rows.map((r) => ({ ...r, participants: participants.get(r.play.id) ?? [] }));
}

export async function playsForGame(ctx: DataContext, gameId: string) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({ play: playSessions })
    .from(playSessions)
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(
      and(
        eq(playSessions.gameId, gameId),
        eq(playSessions.householdId, ctx.householdId),
        gameVisibilityCondition(ctx),
      ),
    )
    .orderBy(desc(playSessions.playedOn));
  const participants = await loadParticipants(
    ctx.db,
    ctx.householdId,
    rows.map((r) => r.play.id),
  );
  return rows.map(({ play }) => ({ ...play, participants: participants.get(play.id) ?? [] }));
}

export interface PlayStats {
  mostPlayed: { gameId: string; title: string; plays: number }[];
  /** Owned games with no play in the last `staleDays` days (or never played). */
  neglected: { gameId: string; title: string; lastPlayed: string | null }[];
}

export async function playStats(ctx: DataContext, staleDays = 365): Promise<PlayStats> {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({
      gameId: games.id,
      title: games.title,
      plays: count(playSessions.id),
      lastPlayed: max(playSessions.playedOn),
    })
    .from(games)
    .leftJoin(playSessions, eq(playSessions.gameId, games.id))
    .where(gameVisibilityCondition(ctx))
    .groupBy(games.id, games.title)
    .orderBy(asc(games.title));

  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    mostPlayed: rows
      .filter((r) => r.plays > 0)
      .toSorted((a, b) => b.plays - a.plays || a.title.localeCompare(b.title))
      .slice(0, 10)
      .map(({ gameId, title, plays }) => ({ gameId, title, plays })),
    neglected: rows
      .filter((r) => !r.lastPlayed || r.lastPlayed < cutoff)
      .map(({ gameId, title, lastPlayed }) => ({ gameId, title, lastPlayed })),
  };
}
