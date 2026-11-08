import { and, asc, count, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';

import { games, playSessions } from '../db/schema';
import type { DataContext } from './context';
import { gameVisibilityCondition } from './visibility';

const today = () => new Date().toISOString().slice(0, 10);

export const playInput = z.object({
  gameId: z.string().uuid(),
  playedOn: z.string().date().optional(),
  durationMinutes: z.number().int().min(1).max(10_000).nullable().optional(),
  playerNames: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  winner: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type PlayInput = z.input<typeof playInput>;

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot log plays');
}

export async function logPlay(ctx: DataContext, raw: PlayInput) {
  assertCanEdit(ctx);
  const input = playInput.parse(raw);
  const [game] = await ctx.db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.id, input.gameId), eq(games.householdId, ctx.householdId)));
  if (!game) throw new Error('Game not found');
  const [play] = await ctx.db
    .insert(playSessions)
    .values({
      householdId: ctx.householdId,
      gameId: input.gameId,
      playedOn: input.playedOn ?? today(),
      durationMinutes: input.durationMinutes ?? null,
      playerNames: input.playerNames,
      winner: input.winner ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return play!;
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
  return ctx.db
    .select({ play: playSessions, title: games.title })
    .from(playSessions)
    .innerJoin(games, eq(games.id, playSessions.gameId))
    .where(and(eq(playSessions.householdId, ctx.householdId), gameVisibilityCondition(ctx)))
    .orderBy(desc(playSessions.playedOn), desc(playSessions.id))
    .limit(limit);
}

export async function playsForGame(ctx: DataContext, gameId: string) {
  assertCanEdit(ctx);
  return ctx.db
    .select()
    .from(playSessions)
    .where(and(eq(playSessions.gameId, gameId), eq(playSessions.householdId, ctx.householdId)))
    .orderBy(desc(playSessions.playedOn));
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
