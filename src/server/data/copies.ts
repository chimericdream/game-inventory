import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { copies, games, locations, users } from '../db/schema';
import {
  createdFields,
  deletedFields,
  diffFields,
  recordAudit,
  stampCreate,
  stampUpdate,
} from './audit';
import type { DataContext } from './context';

export const copyInput = z.object({
  format: z.enum(['physical', 'digital']).default('physical'),
  platform: z.string().trim().max(100).nullable().optional(),
  condition: z
    .enum(['unopened', 'like_new', 'good', 'worn', 'damaged', 'incomplete'])
    .default('good'),
  conditionNotes: z.string().trim().max(500).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  acquiredOn: z.string().date().nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CopyInput = z.input<typeof copyInput>;

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot edit copies');
}

/** Referenced owner/location must belong to the same household. */
async function assertRefs(ctx: DataContext, input: z.output<typeof copyInput>) {
  if (input.ownerUserId) {
    const [u] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.ownerUserId), eq(users.householdId, ctx.householdId)));
    if (!u) throw new Error('Unknown owner');
  }
  if (input.locationId) {
    const [l] = await ctx.db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, input.locationId), eq(locations.householdId, ctx.householdId)));
    if (!l) throw new Error('Unknown location');
  }
}

const COPY_FIELDS = [
  'format',
  'platform',
  'condition',
  'conditionNotes',
  'ownerUserId',
  'locationId',
  'acquiredOn',
  'priceCents',
  'notes',
] as const;

const auditable = (c: typeof copies.$inferSelect) =>
  Object.fromEntries(COPY_FIELDS.map((k) => [k, c[k]]));

export async function addCopy(ctx: DataContext, gameId: string, raw: CopyInput) {
  assertCanEdit(ctx);
  const input = copyInput.parse(raw);
  const [game] = await ctx.db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.householdId, ctx.householdId)));
  if (!game) throw new Error('Game not found');
  await assertRefs(ctx, input);
  return ctx.db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(copies)
      .values({
        householdId: ctx.householdId,
        gameId,
        format: input.format,
        platform: input.platform ?? null,
        condition: input.condition,
        conditionNotes: input.conditionNotes ?? null,
        ownerUserId: input.ownerUserId ?? null,
        locationId: input.locationId ?? null,
        acquiredOn: input.acquiredOn ?? null,
        priceCents: input.priceCents ?? null,
        notes: input.notes ?? null,
        ...stampCreate(ctx),
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'copy',
      entityId: copy!.id,
      action: 'create',
      changes: { gameId: [null, gameId], ...createdFields(auditable(copy!)) },
    });
    return copy!;
  });
}

export async function updateCopy(ctx: DataContext, copyId: string, raw: CopyInput) {
  assertCanEdit(ctx);
  const input = copyInput.parse(raw);
  await assertRefs(ctx, input);
  return ctx.db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(copies)
      .where(and(eq(copies.id, copyId), eq(copies.householdId, ctx.householdId)));
    if (!before) return null;
    const [copy] = await tx
      .update(copies)
      .set({
        format: input.format,
        platform: input.platform ?? null,
        condition: input.condition,
        conditionNotes: input.conditionNotes ?? null,
        ownerUserId: input.ownerUserId ?? null,
        locationId: input.locationId ?? null,
        acquiredOn: input.acquiredOn ?? null,
        priceCents: input.priceCents ?? null,
        notes: input.notes ?? null,
        ...stampUpdate(ctx),
      })
      .where(and(eq(copies.id, copyId), eq(copies.householdId, ctx.householdId)))
      .returning();
    const changes = diffFields(auditable(before), auditable(copy!));
    if (Object.keys(changes).length) {
      await recordAudit(tx, ctx, {
        entityType: 'copy',
        entityId: copyId,
        action: 'update',
        changes,
      });
    }
    return copy ?? null;
  });
}

export async function deleteCopy(ctx: DataContext, copyId: string): Promise<boolean> {
  assertCanEdit(ctx);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .delete(copies)
      .where(and(eq(copies.id, copyId), eq(copies.householdId, ctx.householdId)))
      .returning();
    if (!row) return false;
    await recordAudit(tx, ctx, {
      entityType: 'copy',
      entityId: copyId,
      action: 'delete',
      changes: { gameId: [row.gameId, null], ...deletedFields(auditable(row)) },
    });
    return true;
  });
}
