import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { copies, games, locations, tags, users } from '../db/schema';
import { createdFields, deletedFields, recordAudit, stampCreate } from './audit';
import type { DataContext } from './context';
import { isUuid } from './ids';
import { gameVisibilityCondition } from './visibility';

export async function listLocations(ctx: DataContext) {
  return ctx.db
    .select()
    .from(locations)
    .where(eq(locations.householdId, ctx.householdId))
    .orderBy(asc(locations.name));
}

/**
 * Locations as picker options: "Office › Small bookcase" labels, ordered as a tree so every
 * child sits directly under its parent.
 */
export async function listLocationOptions(
  ctx: DataContext,
): Promise<{ value: string; label: string }[]> {
  const locs = await listLocations(ctx);
  const children = new Map<string | null, typeof locs>();
  const ids = new Set(locs.map((l) => l.id));
  for (const l of locs) {
    // An orphan (parent missing) is treated as a root so it never disappears.
    const key = l.parentId && ids.has(l.parentId) ? l.parentId : null;
    children.set(key, [...(children.get(key) ?? []), l]);
  }
  const out: { value: string; label: string }[] = [];
  const walk = (parent: string | null, prefix: string) => {
    for (const l of children.get(parent) ?? []) {
      const label = prefix ? `${prefix} › ${l.name}` : l.name;
      out.push({ value: l.id, label });
      walk(l.id, label);
    }
  };
  walk(null, '');
  return out;
}

export interface LocationWithCounts {
  id: string;
  name: string;
  parentId: string | null;
  /** Copies kept directly here. */
  copies: number;
  /** Copies here and anywhere underneath. */
  total: number;
}

/**
 * Every location with how many copies it holds, in tree order. Counts only include copies of
 * games this viewer may see, so a restricted profile never learns that hidden games exist.
 */
export async function listLocationsWithCounts(ctx: DataContext): Promise<LocationWithCounts[]> {
  const [locs, counts] = await Promise.all([
    listLocations(ctx),
    ctx.db
      .select({ locationId: copies.locationId, n: sql<number>`count(*)::int` })
      .from(copies)
      .innerJoin(games, eq(games.id, copies.gameId))
      .where(and(eq(copies.householdId, ctx.householdId), gameVisibilityCondition(ctx)))
      .groupBy(copies.locationId),
  ]);
  const direct = new Map(counts.map((c) => [c.locationId, c.n]));
  const children = new Map<string | null, typeof locs>();
  for (const l of locs) children.set(l.parentId, [...(children.get(l.parentId) ?? []), l]);
  const out: LocationWithCounts[] = [];
  const walk = (parent: string | null): number => {
    let sum = 0;
    for (const l of children.get(parent) ?? []) {
      const index = out.length;
      out.push({
        id: l.id,
        name: l.name,
        parentId: l.parentId,
        copies: direct.get(l.id) ?? 0,
        total: 0,
      });
      const below = walk(l.id);
      out[index]!.total = (direct.get(l.id) ?? 0) + below;
      sum += out[index]!.total;
    }
    return sum;
  };
  walk(null);
  return out;
}

export async function createLocation(ctx: DataContext, name: string, parentId?: string | null) {
  if (ctx.viewer.role === 'restricted')
    throw new Error('Restricted profiles cannot edit locations');
  const parsed = z.string().trim().min(1).max(100).parse(name);
  if (parentId) {
    const [parent] = await ctx.db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, parentId), eq(locations.householdId, ctx.householdId)));
    if (!parent) throw new Error('Unknown parent location');
  }
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(locations)
      .values({
        householdId: ctx.householdId,
        name: parsed,
        parentId: parentId ?? null,
        ...stampCreate(ctx),
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'location',
      entityId: row!.id,
      action: 'create',
      changes: createdFields({ name: row!.name, parentId: row!.parentId }),
    });
    return row!;
  });
}

export async function listTags(ctx: DataContext) {
  // A tag used only on games hidden from restricted profiles must not reveal that those exist.
  const onVisibleGame =
    ctx.viewer.role === 'restricted'
      ? sql`exists (select 1 from game_tags gt join games g on g.id = gt.game_id
          where gt.tag_id = ${tags.id} and g.visibility <> 'hidden_restricted')`
      : undefined;
  return ctx.db
    .select()
    .from(tags)
    .where(and(eq(tags.householdId, ctx.householdId), onVisibleGame))
    .orderBy(asc(tags.name));
}

export async function listMembers(ctx: DataContext) {
  return ctx.db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.householdId, ctx.householdId)))
    .orderBy(asc(users.name));
}

export type DeleteLocationResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'has_copies'; copies: number }
  | { ok: false; reason: 'has_children'; children: number };

/**
 * Deletes an empty location. A location that holds copies (directly or anywhere underneath it) or
 * has sub-locations is never deleted, so copies cannot silently lose their place.
 */
export async function deleteLocation(ctx: DataContext, id: string): Promise<DeleteLocationResult> {
  if (ctx.viewer.role === 'restricted')
    throw new Error('Restricted profiles cannot edit locations');
  if (!isUuid(id)) return { ok: false, reason: 'not_found' };
  return ctx.db.transaction(async (tx): Promise<DeleteLocationResult> => {
    const [row] = await tx
      .select()
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.householdId, ctx.householdId)));
    if (!row) return { ok: false, reason: 'not_found' };

    const [counts] = await tx
      .select({
        copies: sql<number>`(
          with recursive tree(id) as (
            select ${id}::uuid
            union all
            select l.id from ${locations} l join tree t on l.parent_id = t.id
          )
          select count(*)::int from ${copies} c
          where c.location_id in (select id from tree) and c.household_id = ${ctx.householdId})`,
        children: sql<number>`(
          select count(*)::int from ${locations} ch
          where ch.parent_id = ${id}::uuid and ch.household_id = ${ctx.householdId})`,
      })
      .from(locations)
      .where(eq(locations.id, id));
    if (counts && counts.copies > 0)
      return { ok: false, reason: 'has_copies', copies: counts.copies };
    if (counts && counts.children > 0) {
      return { ok: false, reason: 'has_children', children: counts.children };
    }

    await tx.delete(locations).where(eq(locations.id, id));
    await recordAudit(tx, ctx, {
      entityType: 'location',
      entityId: id,
      action: 'delete',
      changes: deletedFields({ name: row.name, parentId: row.parentId }),
    });
    return { ok: true };
  });
}
