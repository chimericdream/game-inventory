import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import {
  auditLog,
  copies,
  games,
  locations,
  playSessions,
  players,
  ratings,
  users,
  wishlistItems,
} from '../db/schema';
import { deletedFields, recordAudit, restoredFields, stampUpdate } from './audit';
import type { DataContext } from './context';
import { isUuid } from './ids';

/**
 * The trash. Every "delete" in the app is a soft delete: the row keeps its data but is hidden
 * (`deleted_at` is set) until someone restores it, an admin deletes it for good, or it has been
 * in the trash longer than the retention period.
 *
 * Who can do what: the person who deleted something can restore it; admins can restore anything
 * and are the only ones who can delete permanently.
 */
export const TRASH_KINDS = ['game', 'copy', 'play', 'wishlist_item', 'location', 'player'] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

export const isTrashKind = (v: unknown): v is TrashKind =>
  typeof v === 'string' && (TRASH_KINDS as readonly string[]).includes(v);

// Every trashable table has the same four columns, so one table type stands in for all of them.
const TABLES = {
  game: games,
  copy: copies,
  play: playSessions,
  wishlist_item: wishlistItems,
  location: locations,
  player: players,
} as const;
const table = (kind: TrashKind) => TABLES[kind] as typeof games;

export const DEFAULT_RETENTION_DAYS = 30;

/** Days an item stays in the trash before it is purged. `0` keeps everything until an admin acts. */
export function retentionDays(env: Record<string, string | undefined> = process.env): number {
  const raw = env.TRASH_RETENTION_DAYS?.trim();
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_RETENTION_DAYS;
}

/** When an item deleted at `deletedAt` is purged automatically, or null if that is switched off. */
export function purgeDate(deletedAt: Date, days = retentionDays()): Date | null {
  return days > 0 ? new Date(deletedAt.getTime() + days * 86_400_000) : null;
}

export interface TrashItem {
  kind: TrashKind;
  id: string;
  title: string;
  detail: string | null;
  deletedAt: Date;
  deletedByName: string | null;
  /** The viewer may bring it back (they deleted it, or they are an admin). */
  canRestore: boolean;
  /** What goes with a game if it is deleted for good. */
  plays: number;
  ratings: number;
  expansions: number;
}

const isAdmin = (ctx: DataContext) => ctx.viewer.role === 'admin';

function assertCanUseTrash(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot use the trash');
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const who = (t: typeof games) => ({
  deletedAt: t.deletedAt,
  deletedBy: t.deletedByUserId,
  deletedByName: users.name,
});

/**
 * What is in the trash, most recently deleted first. Admins see everything; everyone else sees
 * only what they deleted themselves.
 */
export async function listTrash(ctx: DataContext): Promise<TrashItem[]> {
  assertCanUseTrash(ctx);
  const mine = (t: typeof games) =>
    and(
      eq(t.householdId, ctx.householdId),
      isNotNull(t.deletedAt),
      isAdmin(ctx) ? undefined : eq(t.deletedByUserId, ctx.viewer.userId),
    );
  const empty = { plays: 0, ratings: 0, expansions: 0 };

  const [gameRows, copyRows, playRows, wishRows, locationRows, playerRows] = await Promise.all([
    ctx.db
      .select({
        id: games.id,
        title: games.title,
        type: games.type,
        ...who(games),
        plays: sql<number>`(select count(*)::int from ${playSessions} p where p.game_id = ${games.id})`,
        ratings: sql<number>`(select count(*)::int from ${ratings} r where r.game_id = ${games.id})`,
        expansions: sql<number>`(select count(*)::int from ${games} e where e.base_game_id = ${games.id})`,
      })
      .from(games)
      .leftJoin(users, eq(users.id, games.deletedByUserId))
      .where(mine(games)),
    ctx.db
      .select({
        id: copies.id,
        title: games.title,
        platform: copies.platform,
        gameDeleted: games.deletedAt,
        ...who(copies as unknown as typeof games),
      })
      .from(copies)
      .innerJoin(games, eq(games.id, copies.gameId))
      .leftJoin(users, eq(users.id, copies.deletedByUserId))
      .where(mine(copies as unknown as typeof games)),
    ctx.db
      .select({
        id: playSessions.id,
        title: games.title,
        playedOn: playSessions.playedOn,
        ...who(playSessions as unknown as typeof games),
      })
      .from(playSessions)
      .innerJoin(games, eq(games.id, playSessions.gameId))
      .leftJoin(users, eq(users.id, playSessions.deletedByUserId))
      .where(mine(playSessions as unknown as typeof games)),
    ctx.db
      .select({
        id: wishlistItems.id,
        title: wishlistItems.title,
        ...who(wishlistItems as unknown as typeof games),
      })
      .from(wishlistItems)
      .leftJoin(users, eq(users.id, wishlistItems.deletedByUserId))
      .where(mine(wishlistItems as unknown as typeof games)),
    ctx.db
      .select({
        id: locations.id,
        title: locations.name,
        ...who(locations as unknown as typeof games),
      })
      .from(locations)
      .leftJoin(users, eq(users.id, locations.deletedByUserId))
      .where(mine(locations as unknown as typeof games)),
    ctx.db
      .select({
        id: players.id,
        title: players.displayName,
        ...who(players as unknown as typeof games),
      })
      .from(players)
      .leftJoin(users, eq(users.id, players.deletedByUserId))
      .where(mine(players as unknown as typeof games)),
  ]);

  const item = (
    kind: TrashKind,
    r: {
      id: string;
      deletedAt: Date | null;
      deletedBy: string | null;
      deletedByName: string | null;
    },
    title: string,
    detail: string | null,
    extra: Partial<Pick<TrashItem, 'plays' | 'ratings' | 'expansions'>> = {},
  ): TrashItem => ({
    kind,
    id: r.id,
    title,
    detail,
    deletedAt: r.deletedAt!,
    deletedByName: r.deletedByName,
    canRestore: isAdmin(ctx) || r.deletedBy === ctx.viewer.userId,
    ...empty,
    ...extra,
  });

  return [
    ...gameRows.map((r) =>
      item('game', r, r.title, r.plays > 0 ? plural(r.plays, 'play') : null, r),
    ),
    ...copyRows.map((r) =>
      item(
        'copy',
        r,
        r.title,
        ['Copy', r.platform, r.gameDeleted ? 'game is in the trash' : null]
          .filter(Boolean)
          .join(' · '),
      ),
    ),
    ...playRows.map((r) => item('play', r, r.title, `Play on ${r.playedOn}`)),
    ...wishRows.map((r) => item('wishlist_item', r, r.title, 'Wishlist')),
    ...locationRows.map((r) => item('location', r, r.title, 'Place')),
    ...playerRows.map((r) => item('player', r, r.title, 'Player')),
  ].toSorted((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime() || a.id.localeCompare(b.id));
}

/** The fields that name a row in the activity feed. */
function labelFields(kind: TrashKind, row: Record<string, unknown>): Record<string, unknown> {
  switch (kind) {
    case 'game':
      return { title: row.title, type: row.type };
    case 'copy':
      return { gameId: row.gameId, platform: row.platform };
    case 'play':
      return { gameId: row.gameId, playedOn: row.playedOn };
    case 'wishlist_item':
      return { title: row.title, type: row.type };
    case 'location':
      return { name: row.name, parentId: row.parentId };
    case 'player':
      return { displayName: row.displayName };
  }
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

/**
 * Brings something back from the trash. A copy or a play needs its game back first, a copy needs
 * its place, and a place needs the place it sits in; otherwise it would reappear hanging off
 * something that is still deleted.
 */
export async function restoreTrashed(
  ctx: DataContext,
  kind: TrashKind,
  id: string,
): Promise<RestoreResult> {
  assertCanUseTrash(ctx);
  const gone: RestoreResult = { ok: false, error: 'That is no longer in the trash.' };
  if (!isUuid(id)) return gone;
  const t = table(kind);
  return ctx.db.transaction(async (tx): Promise<RestoreResult> => {
    const [row] = await tx
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.householdId, ctx.householdId), isNotNull(t.deletedAt)));
    if (!row) return gone;
    if (!isAdmin(ctx) && row.deletedByUserId !== ctx.viewer.userId) {
      return { ok: false, error: 'Only an admin can restore something someone else deleted.' };
    }

    const r = row as unknown as Record<string, unknown>;
    if (kind === 'copy' || kind === 'play') {
      const [game] = await tx
        .select({ deletedAt: games.deletedAt })
        .from(games)
        .where(eq(games.id, r.gameId as string));
      if (game?.deletedAt) return { ok: false, error: 'Restore the game first.' };
    }
    if (kind === 'copy' && r.locationId) {
      const [place] = await tx
        .select({ deletedAt: locations.deletedAt })
        .from(locations)
        .where(eq(locations.id, r.locationId as string));
      if (place?.deletedAt) return { ok: false, error: 'Restore the place it was kept in first.' };
    }
    if (kind === 'location' && r.parentId) {
      const [parent] = await tx
        .select({ deletedAt: locations.deletedAt })
        .from(locations)
        .where(eq(locations.id, r.parentId as string));
      if (parent?.deletedAt) return { ok: false, error: 'Restore the place it sits in first.' };
    }

    await tx
      .update(t)
      .set({ deletedAt: null, deletedByUserId: null, ...stampUpdate(ctx) })
      .where(eq(t.id, id));
    await recordAudit(tx, ctx, {
      entityType: kind,
      entityId: id,
      action: 'update',
      changes: restoredFields(labelFields(kind, r)),
    });
    return { ok: true };
  });
}

export type PurgeResult = { ok: true; coverImage: string | null } | { ok: false; error: string };

/**
 * Admin only: permanently deletes something that is already in the trash. A game takes its plays,
 * ratings and tags with it; its expansions stay but lose their base game. The cover path is
 * returned so the caller can remove the stored file.
 */
export async function purgeTrashed(
  ctx: DataContext,
  kind: TrashKind,
  id: string,
): Promise<PurgeResult> {
  if (!isAdmin(ctx)) throw new Error('Only an admin can delete permanently');
  if (!isUuid(id)) return { ok: false, error: 'That is no longer in the trash.' };
  const t = table(kind);
  return ctx.db.transaction(async (tx): Promise<PurgeResult> => {
    const [row] = await tx
      .delete(t)
      .where(and(eq(t.id, id), eq(t.householdId, ctx.householdId), isNotNull(t.deletedAt)))
      .returning();
    if (!row) return { ok: false, error: 'That is no longer in the trash.' };
    const r = row as unknown as Record<string, unknown>;
    await recordAudit(tx, ctx, {
      entityType: kind,
      entityId: id,
      action: 'delete',
      changes: { ...deletedFields(labelFields(kind, r)), permanent: [null, true] },
    });
    return {
      ok: true,
      coverImage: kind === 'game' ? ((r.coverImage as string | null) ?? null) : null,
    };
  });
}

/**
 * Permanently deletes everything that has been in the trash longer than the retention period, in
 * every household. Returns how many rows went and the cover files that no longer have a game.
 */
export async function purgeExpiredTrash(
  db: Db,
  now = new Date(),
  days = retentionDays(),
): Promise<{ purged: number; covers: string[] }> {
  if (days <= 0) return { purged: 0, covers: [] };
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  return db.transaction(async (tx) => {
    let purged = 0;
    const covers: string[] = [];
    // Children before parents, so a game's own trashed rows are counted on their own.
    const order: TrashKind[] = ['play', 'copy', 'wishlist_item', 'player', 'game', 'location'];
    for (const kind of order) {
      const t = table(kind);
      const rows = await tx
        .delete(t)
        .where(and(isNotNull(t.deletedAt), lt(t.deletedAt, cutoff)))
        .returning();
      for (const row of rows) {
        const r = row as unknown as Record<string, unknown>;
        purged++;
        if (kind === 'game' && typeof r.coverImage === 'string') covers.push(r.coverImage);
        await tx.insert(auditLog).values({
          householdId: row.householdId,
          actorUserId: null,
          entityType: kind,
          entityId: row.id,
          action: 'delete',
          changes: {
            ...deletedFields(labelFields(kind, r)),
            permanent: [null, true],
            automatic: [null, true],
          },
        });
      }
    }
    return { purged, covers };
  });
}
