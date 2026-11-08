import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { wishlistItems } from '../db/schema';
import type { DataContext } from './context';
import { createGame, GAME_TYPES } from './games';

export const wishlistInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.enum(GAME_TYPES).default('board'),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'Use an http(s) link')
    .nullable()
    .optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type WishlistInput = z.input<typeof wishlistInput>;

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted')
    throw new Error('Restricted profiles cannot edit the wishlist');
}

export async function listWishlist(ctx: DataContext) {
  assertCanEdit(ctx);
  return ctx.db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.householdId, ctx.householdId))
    .orderBy(asc(wishlistItems.createdAt));
}

export async function addWishlistItem(ctx: DataContext, raw: WishlistInput) {
  assertCanEdit(ctx);
  const input = wishlistInput.parse(raw);
  const [item] = await ctx.db
    .insert(wishlistItems)
    .values({
      householdId: ctx.householdId,
      title: input.title,
      type: input.type,
      url: input.url ?? null,
      priceCents: input.priceCents ?? null,
      notes: input.notes ?? null,
      requestedByUserId: ctx.viewer.userId,
    })
    .returning();
  return item!;
}

export async function removeWishlistItem(ctx: DataContext, id: string): Promise<boolean> {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.householdId, ctx.householdId)))
    .returning({ id: wishlistItems.id });
  return rows.length > 0;
}

/** Moves a wishlist item into the catalog and returns the new game. */
export async function markAcquired(ctx: DataContext, id: string) {
  assertCanEdit(ctx);
  const [item] = await ctx.db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.householdId, ctx.householdId)));
  if (!item) return null;
  const game = await createGame(ctx, { title: item.title, type: item.type, notes: item.notes });
  await removeWishlistItem(ctx, id);
  return game;
}
