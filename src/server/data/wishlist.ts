import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { wishlistItems } from '../db/schema';
import {
  createdFields,
  deletedFields,
  recordAudit,
  stampCreate,
  stampTrash,
  stampUpdate,
  trashedFields,
} from './audit';
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
    .where(and(eq(wishlistItems.householdId, ctx.householdId), isNull(wishlistItems.deletedAt)))
    .orderBy(asc(wishlistItems.createdAt));
}

export async function addWishlistItem(ctx: DataContext, raw: WishlistInput) {
  assertCanEdit(ctx);
  const input = wishlistInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [item] = await tx
      .insert(wishlistItems)
      .values({
        householdId: ctx.householdId,
        title: input.title,
        type: input.type,
        url: input.url ?? null,
        priceCents: input.priceCents ?? null,
        notes: input.notes ?? null,
        requestedByUserId: ctx.viewer.userId,
        ...stampCreate(ctx),
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'wishlist_item',
      entityId: item!.id,
      action: 'create',
      changes: createdFields({ title: item!.title, type: item!.type, url: item!.url }),
    });
    return item!;
  });
}

/** Moves a wishlist item to the trash. */
export async function removeWishlistItem(ctx: DataContext, id: string): Promise<boolean> {
  assertCanEdit(ctx);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .update(wishlistItems)
      .set({ ...stampTrash(ctx), ...stampUpdate(ctx) })
      .where(
        and(
          eq(wishlistItems.id, id),
          eq(wishlistItems.householdId, ctx.householdId),
          isNull(wishlistItems.deletedAt),
        ),
      )
      .returning();
    if (!row) return false;
    await recordAudit(tx, ctx, {
      entityType: 'wishlist_item',
      entityId: id,
      action: 'update',
      changes: trashedFields({ title: row.title, type: row.type }),
    });
    return true;
  });
}

/** Moves a wishlist item into the catalog and returns the new game. */
export async function markAcquired(ctx: DataContext, id: string) {
  assertCanEdit(ctx);
  const [item] = await ctx.db
    .select()
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.id, id),
        eq(wishlistItems.householdId, ctx.householdId),
        isNull(wishlistItems.deletedAt),
      ),
    );
  if (!item) return null;
  const game = await createGame(ctx, { title: item.title, type: item.type, notes: item.notes });
  // Getting it is not a deletion: the item has become a game, so it leaves the wishlist for good
  // instead of waiting in the trash where a restore would duplicate it.
  await ctx.db.transaction(async (tx) => {
    await tx.delete(wishlistItems).where(eq(wishlistItems.id, id));
    await recordAudit(tx, ctx, {
      entityType: 'wishlist_item',
      entityId: id,
      action: 'delete',
      changes: { ...deletedFields({ title: item.title, type: item.type }), acquired: [null, true] },
    });
  });
  return game;
}
