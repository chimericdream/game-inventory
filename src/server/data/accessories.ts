import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { copies, copyAccessories, locations } from '../db/schema';
import {
  createdFields,
  diffFields,
  recordAudit,
  stampCreate,
  stampTrash,
  stampUpdate,
  trashedFields,
} from './audit';
import type { DataContext } from './context';
import { isUuid } from './ids';

/**
 * Accessories: playmats, deluxe trays, miniatures and the like. Each one belongs to a copy, and
 * may be kept somewhere other than the copy's box. Reads go through the game (see
 * `getGameDetail`), so the game's visibility rules cover them too.
 */

export const ACCESSORY_KINDS = [
  'playmat',
  'organizer',
  'upgraded_components',
  'miniatures',
  'sleeves',
  'other',
] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

export const accessoryInput = z.object({
  name: z.string().trim().min(1, 'Give it a name.').max(200),
  kind: z.enum(ACCESSORY_KINDS).default('other'),
  quantity: z.number().int().min(1).max(9999).default(1),
  /** Null keeps it with the copy. */
  locationId: z.string().uuid().nullable().optional(),
  acquiredOn: z.string().date().nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type AccessoryInput = z.input<typeof accessoryInput>;

const FIELDS = [
  'name',
  'kind',
  'quantity',
  'locationId',
  'acquiredOn',
  'priceCents',
  'notes',
] as const;

const auditable = (a: typeof copyAccessories.$inferSelect) =>
  Object.fromEntries(FIELDS.map((k) => [k, a[k]]));

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') {
    throw new Error('Restricted profiles cannot edit accessories');
  }
}

const values = (input: z.output<typeof accessoryInput>) => ({
  name: input.name,
  kind: input.kind,
  quantity: input.quantity,
  locationId: input.locationId ?? null,
  acquiredOn: input.acquiredOn ?? null,
  priceCents: input.priceCents ?? null,
  notes: input.notes ?? null,
});

async function assertLocation(ctx: DataContext, locationId: string | null | undefined) {
  if (!locationId) return;
  const [l] = await ctx.db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.householdId, ctx.householdId),
        isNull(locations.deletedAt),
      ),
    );
  if (!l) throw new Error('Unknown location');
}

/** A live copy in this household, or null. */
async function liveCopy(ctx: DataContext, copyId: string) {
  if (!isUuid(copyId)) return null;
  const [c] = await ctx.db
    .select({ id: copies.id, gameId: copies.gameId })
    .from(copies)
    .where(
      and(eq(copies.id, copyId), eq(copies.householdId, ctx.householdId), isNull(copies.deletedAt)),
    );
  return c ?? null;
}

/** A live accessory on a live copy in this household. */
const editable = (ctx: DataContext, id: string) =>
  and(
    eq(copyAccessories.id, id),
    eq(copyAccessories.householdId, ctx.householdId),
    isNull(copyAccessories.deletedAt),
    isNull(copies.deletedAt),
  );

export async function addAccessory(ctx: DataContext, copyId: string, raw: AccessoryInput) {
  assertCanEdit(ctx);
  const input = accessoryInput.parse(raw);
  const copy = await liveCopy(ctx, copyId);
  if (!copy) throw new Error('Copy not found');
  await assertLocation(ctx, input.locationId);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(copyAccessories)
      .values({ householdId: ctx.householdId, copyId, ...values(input), ...stampCreate(ctx) })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'accessory',
      entityId: row!.id,
      action: 'create',
      changes: {
        copyId: [null, copyId],
        gameId: [null, copy.gameId],
        ...createdFields(auditable(row!)),
      },
    });
    return row!;
  });
}

export async function updateAccessory(ctx: DataContext, id: string, raw: AccessoryInput) {
  assertCanEdit(ctx);
  if (!isUuid(id)) return null;
  const input = accessoryInput.parse(raw);
  await assertLocation(ctx, input.locationId);
  return ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ accessory: copyAccessories })
      .from(copyAccessories)
      .innerJoin(copies, eq(copies.id, copyAccessories.copyId))
      .where(editable(ctx, id));
    if (!found) return null;
    const before = found.accessory;
    const [row] = await tx
      .update(copyAccessories)
      .set({ ...values(input), ...stampUpdate(ctx) })
      .where(eq(copyAccessories.id, id))
      .returning();
    const changes = diffFields(auditable(before), auditable(row!));
    if (Object.keys(changes).length) {
      await recordAudit(tx, ctx, {
        entityType: 'accessory',
        entityId: id,
        action: 'update',
        changes,
      });
    }
    return row!;
  });
}

/** Moves one accessory to the trash. */
export async function deleteAccessory(ctx: DataContext, id: string): Promise<boolean> {
  assertCanEdit(ctx);
  if (!isUuid(id)) return false;
  return ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ accessory: copyAccessories, gameId: copies.gameId })
      .from(copyAccessories)
      .innerJoin(copies, eq(copies.id, copyAccessories.copyId))
      .where(editable(ctx, id));
    if (!found) return false;
    await tx
      .update(copyAccessories)
      .set({ ...stampTrash(ctx), ...stampUpdate(ctx) })
      .where(eq(copyAccessories.id, id));
    await recordAudit(tx, ctx, {
      entityType: 'accessory',
      entityId: id,
      action: 'update',
      changes: trashedFields({
        copyId: found.accessory.copyId,
        gameId: found.gameId,
        name: found.accessory.name,
      }),
    });
    return true;
  });
}

export type AccessoryRow = typeof copyAccessories.$inferSelect;

/**
 * Live accessories for these copies, oldest first. The caller has already checked that the
 * viewer may see the copies' game.
 */
export async function accessoriesForCopies(
  ctx: DataContext,
  copyIds: string[],
): Promise<AccessoryRow[]> {
  if (copyIds.length === 0) return [];
  return ctx.db
    .select()
    .from(copyAccessories)
    .where(
      and(
        eq(copyAccessories.householdId, ctx.householdId),
        isNull(copyAccessories.deletedAt),
        inArray(copyAccessories.copyId, copyIds),
      ),
    )
    .orderBy(asc(copyAccessories.createdAt), asc(copyAccessories.id));
}
