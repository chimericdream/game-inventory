import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { locations, tags, users } from '../db/schema';
import { createdFields, recordAudit, stampCreate } from './audit';
import type { DataContext } from './context';

export async function listLocations(ctx: DataContext) {
  return ctx.db
    .select()
    .from(locations)
    .where(eq(locations.householdId, ctx.householdId))
    .orderBy(asc(locations.name));
}

export async function createLocation(ctx: DataContext, name: string, parentId?: string | null) {
  if (ctx.viewer.role === 'restricted')
    throw new Error('Restricted profiles cannot edit locations');
  const parsed = z.string().trim().min(1).max(100).parse(name);
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
