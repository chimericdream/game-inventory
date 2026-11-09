import { createHash, randomBytes } from 'node:crypto';

import { and, asc, desc, eq, gt, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import type { Db } from '../db/client';
import {
  boardGameDetails,
  copies,
  gameTags,
  games,
  locations,
  shareLinks,
  tags,
} from '../db/schema';
import { createdFields, recordAudit } from './audit';
import { maxMinutesCondition, playersCondition, searchCondition } from './catalogFilters';
import type { DataContext } from './context';
import { GAME_TYPES } from './games';
import { isUuid } from './ids';

/*
 * Guest access is deliberately separate from the household data layer. Everything a guest can
 * receive is listed explicitly in the `Guest*` types below; rows are never passed through.
 */

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const shareLinkInput = z.object({
  label: z.string().trim().min(1, 'Give the link a name').max(100),
  /** Days until the link stops working; omit for no expiry. */
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  hideTypes: z.array(z.enum(GAME_TYPES)).default([]),
  hideTags: z.array(z.string().trim().min(1).max(50)).default([]),
  showNotes: z.boolean().default(false),
  showLocations: z.boolean().default(false),
});
export type ShareLinkInput = z.input<typeof shareLinkInput>;

function assertAdmin(ctx: DataContext) {
  if (ctx.viewer.role !== 'admin') throw new Error('Only admins can manage guest links');
}

export async function createShareLink(ctx: DataContext, raw: ShareLinkInput) {
  assertAdmin(ctx);
  const input = shareLinkInput.parse(raw);
  const token = randomBytes(24).toString('base64url');
  return ctx.db.transaction(async (tx) => {
    const [link] = await tx
      .insert(shareLinks)
      .values({
        householdId: ctx.householdId,
        createdByUserId: ctx.viewer.userId,
        label: input.label,
        tokenHash: hashToken(token),
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        hideTypes: input.hideTypes,
        hideTags: input.hideTags,
        showNotes: input.showNotes,
        showLocations: input.showLocations,
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'share_link',
      entityId: link!.id,
      action: 'create',
      changes: createdFields({
        label: link!.label,
        expiresAt: link!.expiresAt,
        hideTypes: link!.hideTypes.length ? link!.hideTypes : null,
        hideTags: link!.hideTags.length ? link!.hideTags : null,
        showNotes: link!.showNotes,
        showLocations: link!.showLocations,
      }),
    });
    return { link: link!, token };
  });
}

export async function listShareLinks(ctx: DataContext) {
  assertAdmin(ctx);
  return ctx.db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.householdId, ctx.householdId))
    .orderBy(desc(shareLinks.createdAt));
}

export async function revokeShareLink(ctx: DataContext, id: string): Promise<boolean> {
  assertAdmin(ctx);
  return ctx.db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .update(shareLinks)
      .set({ revokedAt: now })
      .where(
        and(
          eq(shareLinks.id, id),
          eq(shareLinks.householdId, ctx.householdId),
          isNull(shareLinks.revokedAt),
        ),
      )
      .returning({ id: shareLinks.id });
    if (rows.length === 0) return false;
    await recordAudit(tx, ctx, {
      entityType: 'share_link',
      entityId: id,
      action: 'update',
      changes: { revokedAt: [null, now.toISOString()] },
    });
    return true;
  });
}

export type ShareLink = typeof shareLinks.$inferSelect;

/** Returns the link for a URL token, or null if unknown, revoked, or expired. */
export async function resolveShareLink(db: Db, token: string): Promise<ShareLink | null> {
  if (!token || token.length > 200) return null;
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.tokenHash, hashToken(token)),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return link ?? null;
}

export interface GuestGame {
  id: string;
  title: string;
  type: string;
  description: string | null;
  coverImage: string | null;
  tags: string[];
  platforms: string[];
  copyCount: number;
  board: {
    minPlayers: number | null;
    maxPlayers: number | null;
    playTimeMinutes: number | null;
    complexity: number | null;
    minAge: number | null;
  } | null;
  /** Only when the link opts in. */
  notes: string | null;
  locations: string[];
}

function guestConditions(link: ShareLink): SQL[] {
  const conds: SQL[] = [
    eq(games.householdId, link.householdId),
    eq(games.shareable, true),
    // Guests are treated like the most restricted household profile.
    sql`${games.visibility} <> 'hidden_restricted'`,
  ];
  if (link.hideTypes.length) conds.push(notInArray(games.type, link.hideTypes as never[]));
  if (link.hideTags.length) {
    const lowered = link.hideTags.map((t) => t.toLowerCase());
    conds.push(
      sql`not exists (select 1 from ${gameTags} gt join ${tags} t on t.id = gt.tag_id
        where gt.game_id = ${games.id} and lower(t.name) in (${sql.join(
          lowered.map((t) => sql`${t}`),
          sql`, `,
        )}))`,
    );
  }
  return conds;
}

async function hydrate(db: Db, link: ShareLink, ids: string[]) {
  if (ids.length === 0) return { tagRows: [], copyRows: [] };
  const idList = sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `,
  );
  const [tagRows, copyRows] = await Promise.all([
    db
      .select({ gameId: gameTags.gameId, name: tags.name })
      .from(gameTags)
      .innerJoin(tags, eq(tags.id, gameTags.tagId))
      .where(
        and(eq(gameTags.householdId, link.householdId), sql`${gameTags.gameId} in (${idList})`),
      ),
    db
      .select({ gameId: copies.gameId, platform: copies.platform, location: locations.name })
      .from(copies)
      .leftJoin(locations, eq(locations.id, copies.locationId))
      .where(and(eq(copies.householdId, link.householdId), sql`${copies.gameId} in (${idList})`)),
  ]);
  return { tagRows, copyRows };
}

export async function guestCatalog(
  db: Db,
  link: ShareLink,
  filters: { search?: string; type?: string; players?: number; maxMinutes?: number } = {},
  onlyId?: string,
): Promise<GuestGame[]> {
  if (onlyId !== undefined && !isUuid(onlyId)) return [];
  const conds = guestConditions(link);
  for (const shared of [
    searchCondition(filters.search),
    playersCondition(filters.players),
    maxMinutesCondition(filters.maxMinutes),
  ]) {
    if (shared) conds.push(shared);
  }
  if (filters.type) conds.push(eq(games.type, filters.type as never));
  if (onlyId) conds.push(eq(games.id, onlyId));

  const rows = await db
    .select({
      id: games.id,
      title: games.title,
      type: games.type,
      description: games.description,
      coverImage: games.coverImage,
      visibility: games.visibility,
      notes: games.notes,
      minPlayers: boardGameDetails.minPlayers,
      maxPlayers: boardGameDetails.maxPlayers,
      playTimeMinutes: boardGameDetails.playTimeMinutes,
      complexity: boardGameDetails.complexity,
      minAge: boardGameDetails.minAge,
      hasBoard: boardGameDetails.gameId,
    })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .where(and(...conds))
    .orderBy(asc(games.title));

  const { tagRows, copyRows } = await hydrate(
    db,
    link,
    rows.map((r) => r.id),
  );

  return rows.map((r) => {
    const gameCopies = copyRows.filter((c) => c.gameId === r.id);
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      description: r.description,
      // hide_images applies to guests too.
      coverImage: r.visibility === 'hide_images' ? null : r.coverImage,
      tags: tagRows.filter((t) => t.gameId === r.id).map((t) => t.name),
      platforms: [...new Set(gameCopies.flatMap((c) => (c.platform ? [c.platform] : [])))],
      copyCount: gameCopies.length,
      board: r.hasBoard
        ? {
            minPlayers: r.minPlayers,
            maxPlayers: r.maxPlayers,
            playTimeMinutes: r.playTimeMinutes,
            complexity: r.complexity,
            minAge: r.minAge,
          }
        : null,
      notes: link.showNotes ? r.notes : null,
      locations: link.showLocations
        ? [...new Set(gameCopies.flatMap((c) => (c.location ? [c.location] : [])))]
        : [],
    };
  });
}

export async function guestGame(db: Db, link: ShareLink, id: string): Promise<GuestGame | null> {
  const [game] = await guestCatalog(db, link, {}, id);
  return game ?? null;
}

/** Raw cover path for a game the guest may see, or null. */
export async function guestCoverPath(db: Db, link: ShareLink, id: string): Promise<string | null> {
  return (await guestGame(db, link, id))?.coverImage ?? null;
}
