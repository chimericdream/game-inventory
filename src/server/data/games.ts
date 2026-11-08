import { and, asc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import { boardGameDetails, games, rpgDetails } from '../db/schema';
import type { DataContext } from './context';
import { gameVisibilityCondition, redactGame } from './visibility';

const optionalInt = z.number().int().positive().nullable().optional();

export const createGameInput = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(['board', 'card', 'rpg', 'video', 'puzzle', 'other']),
  description: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  visibility: z.enum(['normal', 'hide_images', 'hidden_restricted']).default('normal'),
  shareable: z.boolean().default(false),
  board: z
    .object({
      minPlayers: optionalInt,
      maxPlayers: optionalInt,
      playTimeMinutes: optionalInt,
      complexity: z.number().int().min(1).max(5).nullable().optional(),
      minAge: optionalInt,
    })
    .optional(),
  rpg: z
    .object({
      system: z.string().trim().max(200).nullable().optional(),
      bookKind: z.string().trim().max(200).nullable().optional(),
    })
    .optional(),
});
export type CreateGameInput = z.input<typeof createGameInput>;

export async function listGames(ctx: DataContext, opts: { search?: string } = {}) {
  const search = opts.search?.trim();
  const rows = await ctx.db
    .select()
    .from(games)
    .where(
      and(
        gameVisibilityCondition(ctx),
        search ? ilike(games.title, `%${search.replace(/[%_\\]/g, '\\$&')}%`) : undefined,
      ),
    )
    .orderBy(asc(games.title));
  return rows.flatMap((row) => redactGame(row, ctx.viewer) ?? []);
}

export async function getGame(ctx: DataContext, id: string) {
  const [row] = await ctx.db
    .select()
    .from(games)
    .where(and(eq(games.id, id), gameVisibilityCondition(ctx)))
    .limit(1);
  return row ? redactGame(row, ctx.viewer) : null;
}

export async function createGame(ctx: DataContext, raw: CreateGameInput) {
  if (ctx.viewer.role === 'restricted')
    throw new Error('Restricted profiles cannot edit the catalog');
  const input = createGameInput.parse(raw);

  return ctx.db.transaction(async (tx) => {
    const [game] = await tx
      .insert(games)
      .values({
        householdId: ctx.householdId,
        title: input.title,
        type: input.type,
        description: input.description ?? null,
        notes: input.notes ?? null,
        visibility: input.visibility,
        shareable: input.shareable,
      })
      .returning();
    if (!game) throw new Error('Failed to create game');

    if (input.board && (input.type === 'board' || input.type === 'card')) {
      await tx
        .insert(boardGameDetails)
        .values({ gameId: game.id, householdId: ctx.householdId, ...input.board });
    }
    if (input.rpg && input.type === 'rpg') {
      await tx.insert(rpgDetails).values({
        gameId: game.id,
        householdId: ctx.householdId,
        ...input.rpg,
      });
    }
    return game;
  });
}
