import { and, avg, count, eq } from 'drizzle-orm';
import { z } from 'zod';

import { games, ratings } from '../db/schema';
import type { DataContext } from './context';
import { isUuid } from './ids';
import { gameVisibilityCondition } from './visibility';

/*
 * Ratings are personal. Household members see their own score and the family average; nobody sees
 * another member's individual score. Restricted profiles can neither rate nor read ratings, and
 * guests never receive them (the guest types have no rating field at all).
 *
 * Ratings are deliberately not written to the audit log: an activity feed would otherwise reveal
 * who rated what.
 */

const score = z.number().int().min(1, 'Pick 1 to 5').max(5, 'Pick 1 to 5');

function assertCanRate(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot use ratings');
}

async function assertVisibleGame(ctx: DataContext, gameId: string) {
  if (!isUuid(gameId)) throw new Error('Game not found');
  const [row] = await ctx.db
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.id, gameId),
        eq(games.householdId, ctx.householdId),
        gameVisibilityCondition(ctx),
      ),
    );
  if (!row) throw new Error('Game not found');
}

export async function setRating(ctx: DataContext, gameId: string, raw: number) {
  assertCanRate(ctx);
  const value = score.parse(raw);
  await assertVisibleGame(ctx, gameId);
  await ctx.db
    .insert(ratings)
    .values({
      householdId: ctx.householdId,
      userId: ctx.viewer.userId,
      gameId,
      score: value,
    })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.gameId],
      set: { score: value, updatedAt: new Date() },
    });
}

export async function clearRating(ctx: DataContext, gameId: string) {
  assertCanRate(ctx);
  if (!isUuid(gameId)) return;
  await ctx.db
    .delete(ratings)
    .where(
      and(
        eq(ratings.userId, ctx.viewer.userId),
        eq(ratings.gameId, gameId),
        eq(ratings.householdId, ctx.householdId),
      ),
    );
}

export interface RatingSummary {
  /** The viewer's own score, or null. */
  mine: number | null;
  /** Mean of everyone's scores in the household, to one decimal; null with no ratings. */
  average: number | null;
  count: number;
}

export async function ratingSummary(ctx: DataContext, gameId: string): Promise<RatingSummary> {
  assertCanRate(ctx);
  await assertVisibleGame(ctx, gameId);
  const [agg] = await ctx.db
    .select({ average: avg(ratings.score), n: count() })
    .from(ratings)
    .where(and(eq(ratings.gameId, gameId), eq(ratings.householdId, ctx.householdId)));
  const [mine] = await ctx.db
    .select({ score: ratings.score })
    .from(ratings)
    .where(
      and(
        eq(ratings.gameId, gameId),
        eq(ratings.userId, ctx.viewer.userId),
        eq(ratings.householdId, ctx.householdId),
      ),
    );
  const n = agg?.n ?? 0;
  return {
    mine: mine?.score ?? null,
    average: n > 0 && agg?.average !== null ? Math.round(Number(agg!.average) * 10) / 10 : null,
    count: n,
  };
}
