import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { locations, tags, users } from '../db/schema';
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
  const [row] = await ctx.db
    .insert(locations)
    .values({ householdId: ctx.householdId, name: parsed, parentId: parentId ?? null })
    .returning();
  return row!;
}

export async function listTags(ctx: DataContext) {
  return ctx.db
    .select()
    .from(tags)
    .where(eq(tags.householdId, ctx.householdId))
    .orderBy(asc(tags.name));
}

export async function listMembers(ctx: DataContext) {
  return ctx.db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.householdId, ctx.householdId)))
    .orderBy(asc(users.name));
}
