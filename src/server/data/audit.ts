import { and, desc, eq, lt, or } from 'drizzle-orm';

import type { Db } from '../db/client';
import { auditLog, users } from '../db/schema';
import type { DataContext } from './context';

export type AuditEntity =
  | 'game'
  | 'copy'
  | 'loan'
  | 'play'
  | 'player'
  | 'wishlist_item'
  | 'location'
  | 'share_link'
  | 'user';

export type AuditAction = 'create' | 'update' | 'delete';

/** Who is acting, and in which household. A `DataContext` satisfies this. */
export interface AuditActor {
  householdId: string;
  viewer: { userId: string };
}
export type AuditChanges = Record<string, [unknown, unknown]>;

/** Fields that must never be written to the audit log, whatever the caller passes. */
const NEVER_LOG = new Set(['passwordHash', 'password', 'tokenHash', 'token']);

function scrub(changes: AuditChanges): AuditChanges {
  return Object.fromEntries(Object.entries(changes).filter(([k]) => !NEVER_LOG.has(k)));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Only the fields whose value differs, as `[before, after]`. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChanges {
  const out: AuditChanges = {};
  for (const key of Object.keys(after)) {
    if (!same(before[key], after[key])) out[key] = [before[key] ?? null, after[key] ?? null];
  }
  return out;
}

/** `{ title: 'Catan' }` becomes `{ title: [null, 'Catan'] }`. */
export const createdFields = (values: Record<string, unknown>): AuditChanges =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, [null, v] as [unknown, unknown]]),
  );

/** `{ title: 'Catan' }` becomes `{ title: ['Catan', null] }`. */
export const deletedFields = (values: Record<string, unknown>): AuditChanges =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, [v, null] as [unknown, unknown]]),
  );

/**
 * Writes one audit entry. Call it with the same transaction as the change it describes, so a
 * failed change never leaves a log entry behind (and vice versa).
 */
export async function recordAudit(
  db: Db,
  ctx: AuditActor,
  entry: {
    entityType: AuditEntity;
    entityId: string;
    action: AuditAction;
    changes?: AuditChanges;
  },
) {
  await db.insert(auditLog).values({
    householdId: ctx.householdId,
    actorUserId: ctx.viewer.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    changes: scrub(entry.changes ?? {}),
  });
}

/** Stamp for rows written on behalf of the current viewer. */
export const stampCreate = (ctx: DataContext) => ({
  createdByUserId: ctx.viewer.userId,
  updatedByUserId: ctx.viewer.userId,
});

export const stampUpdate = (ctx: DataContext) => ({
  updatedByUserId: ctx.viewer.userId,
  updatedAt: new Date(),
});

function assertCanReadAudit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot see activity');
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changes: AuditChanges;
  at: Date;
  actorName: string | null;
}

const entryColumns = {
  id: auditLog.id,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  action: auditLog.action,
  changes: auditLog.changes,
  at: auditLog.at,
  actorName: users.name,
};

/** The most recent entry for one record: "who last changed this, and when". */
export async function lastEdit(
  ctx: DataContext,
  entityType: AuditEntity,
  entityId: string,
): Promise<AuditEntry | null> {
  assertCanReadAudit(ctx);
  const [row] = await ctx.db
    .select(entryColumns)
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(
      and(
        eq(auditLog.householdId, ctx.householdId),
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId),
      ),
    )
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(1);
  return row ?? null;
}

/** Every entry for one record, newest first. */
export async function historyFor(
  ctx: DataContext,
  entityType: AuditEntity,
  entityId: string,
  limit = 50,
): Promise<AuditEntry[]> {
  assertCanReadAudit(ctx);
  return ctx.db
    .select(entryColumns)
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(
      and(
        eq(auditLog.householdId, ctx.householdId),
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId),
      ),
    )
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit);
}

/** Household-wide activity, newest first. Pass the last entry's `at` and `id` to continue. */
export async function recentActivity(
  ctx: DataContext,
  opts: { limit?: number; before?: { at: Date; id: string } } = {},
): Promise<AuditEntry[]> {
  assertCanReadAudit(ctx);
  const before = opts.before;
  return ctx.db
    .select(entryColumns)
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(
      and(
        eq(auditLog.householdId, ctx.householdId),
        before
          ? or(
              lt(auditLog.at, before.at),
              and(eq(auditLog.at, before.at), lt(auditLog.id, before.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(opts.limit ?? 50);
}
