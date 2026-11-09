import { and, asc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import {
  boardGameDetails,
  copies,
  gameTags,
  games,
  locations,
  loans,
  puzzleDetails,
  rpgDetails,
  tags,
} from '../db/schema';
import {
  createdFields,
  deletedFields,
  diffFields,
  recordAudit,
  stampCreate,
  stampUpdate,
} from './audit';
import type { DataContext } from './context';
import { isUuid } from './ids';
import { gameVisibilityCondition, redactGame } from './visibility';

const optionalInt = z.number().int().positive().nullable().optional();
const optionalText = z.string().trim().max(5000).nullable().optional();

export const GAME_TYPES = ['board', 'card', 'rpg', 'video', 'puzzle', 'other'] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const gameInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.enum(GAME_TYPES),
  description: optionalText,
  notes: optionalText,
  visibility: z.enum(['normal', 'hide_images', 'hidden_restricted']).default('normal'),
  shareable: z.boolean().default(false),
  board: z
    .object({
      minPlayers: optionalInt,
      maxPlayers: optionalInt,
      playTimeMinutes: optionalInt,
      complexity: z.number().int().min(1).max(5).nullable().optional(),
      minAge: optionalInt,
    })
    .optional(),
  rpg: z
    .object({
      system: z.string().trim().max(200).nullable().optional(),
      bookKind: z.string().trim().max(200).nullable().optional(),
    })
    .optional(),
  puzzle: z
    .object({ pieceCount: z.number().int().min(1).max(100_000).nullable().optional() })
    .optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});
export type GameInput = z.input<typeof gameInput>;

export interface CatalogFilters {
  search?: string;
  type?: GameType;
  /** Games that can be played with exactly this many players. */
  players?: number;
  /** Games that take at most this many minutes. */
  maxMinutes?: number;
  tag?: string;
  locationId?: string;
  ownerUserId?: string;
}

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') {
    throw new Error('Restricted profiles cannot edit the catalog');
  }
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');

export async function listCatalog(ctx: DataContext, filters: CatalogFilters = {}) {
  if (filters.locationId && !isUuid(filters.locationId)) return [];
  if (filters.ownerUserId && !isUuid(filters.ownerUserId)) return [];
  const conditions: (SQL | undefined)[] = [gameVisibilityCondition(ctx)];
  const search = filters.search?.trim();
  if (search) conditions.push(ilike(games.title, `%${escapeLike(search)}%`));
  if (filters.type) conditions.push(eq(games.type, filters.type));
  if (filters.players) {
    conditions.push(
      and(
        or(
          sql`${boardGameDetails.minPlayers} is null`,
          lte(boardGameDetails.minPlayers, filters.players),
        ),
        or(
          sql`${boardGameDetails.maxPlayers} is null`,
          gte(boardGameDetails.maxPlayers, filters.players),
        ),
        sql`(${boardGameDetails.minPlayers} is not null or ${boardGameDetails.maxPlayers} is not null)`,
      ),
    );
  }
  if (filters.maxMinutes) {
    conditions.push(lte(boardGameDetails.playTimeMinutes, filters.maxMinutes));
  }
  if (filters.tag) {
    conditions.push(
      sql`exists (select 1 from ${gameTags} gt join ${tags} t on t.id = gt.tag_id
        where gt.game_id = ${games.id} and lower(t.name) = ${filters.tag.toLowerCase()})`,
    );
  }
  if (filters.locationId) {
    conditions.push(
      sql`exists (select 1 from ${copies} c where c.game_id = ${games.id} and c.location_id = ${filters.locationId})`,
    );
  }
  if (filters.ownerUserId) {
    conditions.push(
      sql`exists (select 1 from ${copies} c where c.game_id = ${games.id} and c.owner_user_id = ${filters.ownerUserId})`,
    );
  }

  const rows = await ctx.db
    .select({ game: games, board: boardGameDetails })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .where(and(...conditions))
    .orderBy(asc(games.title));

  const visible = rows.flatMap((r) => {
    const game = redactGame(r.game, ctx.viewer);
    return game ? [{ game, board: r.board }] : [];
  });
  const ids = visible.map((r) => r.game.id);
  if (ids.length === 0) return [];

  const canSeeLoans = ctx.viewer.role !== 'restricted';
  const [copyRows, tagRows, loanRows] = await Promise.all([
    ctx.db
      .select({ gameId: copies.gameId, platform: copies.platform })
      .from(copies)
      .where(and(eq(copies.householdId, ctx.householdId), inArray(copies.gameId, ids))),
    ctx.db
      .select({ gameId: gameTags.gameId, name: tags.name })
      .from(gameTags)
      .innerJoin(tags, eq(tags.id, gameTags.tagId))
      .where(and(eq(gameTags.householdId, ctx.householdId), inArray(gameTags.gameId, ids))),
    canSeeLoans
      ? ctx.db
          .select({ gameId: copies.gameId })
          .from(loans)
          .innerJoin(copies, eq(copies.id, loans.copyId))
          .where(
            and(
              eq(loans.householdId, ctx.householdId),
              isNull(loans.returnedOn),
              inArray(copies.gameId, ids),
            ),
          )
      : Promise.resolve([] as { gameId: string }[]),
  ]);
  const lentOut = new Set(loanRows.map((l) => l.gameId));

  return visible.map(({ game, board }) => ({
    ...game,
    board,
    onLoan: lentOut.has(game.id),
    copyCount: copyRows.filter((c) => c.gameId === game.id).length,
    platforms: [
      ...new Set(
        copyRows.filter((c) => c.gameId === game.id && c.platform).map((c) => c.platform!),
      ),
    ],
    tags: tagRows.filter((t) => t.gameId === game.id).map((t) => t.name),
  }));
}
export type CatalogRow = Awaited<ReturnType<typeof listCatalog>>[number];

export async function getGameDetail(ctx: DataContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await ctx.db
    .select({ game: games, board: boardGameDetails, rpg: rpgDetails, puzzle: puzzleDetails })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .leftJoin(rpgDetails, eq(rpgDetails.gameId, games.id))
    .leftJoin(puzzleDetails, eq(puzzleDetails.gameId, games.id))
    .where(and(eq(games.id, id), gameVisibilityCondition(ctx)))
    .limit(1);
  if (!row) return null;
  const game = redactGame(row.game, ctx.viewer);
  if (!game) return null;

  const [copyRows, tagRows] = await Promise.all([
    ctx.db
      .select({ copy: copies, locationName: locations.name })
      .from(copies)
      .leftJoin(locations, eq(locations.id, copies.locationId))
      .where(and(eq(copies.gameId, id), eq(copies.householdId, ctx.householdId))),
    ctx.db
      .select({ name: tags.name })
      .from(gameTags)
      .innerJoin(tags, eq(tags.id, gameTags.tagId))
      .where(and(eq(gameTags.gameId, id), eq(gameTags.householdId, ctx.householdId))),
  ]);
  return {
    game,
    board: row.board,
    rpg: row.rpg,
    puzzle: row.puzzle,
    copies: copyRows.map((c) => ({ ...c.copy, locationName: c.locationName })),
    tags: tagRows.map((t) => t.name),
  };
}

async function syncTags(ctx: DataContext, tx: DataContext['db'], gameId: string, names: string[]) {
  const seen = new Map<string, string>();
  for (const n of names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  const unique = [...seen.values()];
  await tx
    .delete(gameTags)
    .where(and(eq(gameTags.gameId, gameId), eq(gameTags.householdId, ctx.householdId)));
  if (unique.length === 0) return;

  const existing = await tx.select().from(tags).where(eq(tags.householdId, ctx.householdId));
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const missing = unique.filter((n) => !byLower.has(n.toLowerCase()));
  if (missing.length) {
    const created = await tx
      .insert(tags)
      .values(missing.map((name) => ({ householdId: ctx.householdId, name })))
      .returning();
    for (const t of created) byLower.set(t.name.toLowerCase(), t.id);
  }
  await tx.insert(gameTags).values(
    unique.map((n) => ({
      householdId: ctx.householdId,
      gameId,
      tagId: byLower.get(n.toLowerCase())!,
    })),
  );
}

async function writeDetails(
  ctx: DataContext,
  tx: DataContext['db'],
  gameId: string,
  input: z.output<typeof gameInput>,
) {
  const isBoard = input.type === 'board' || input.type === 'card';
  if (isBoard && input.board) {
    await tx
      .insert(boardGameDetails)
      .values({ gameId, householdId: ctx.householdId, ...input.board })
      .onConflictDoUpdate({ target: boardGameDetails.gameId, set: input.board });
  } else {
    await tx.delete(boardGameDetails).where(eq(boardGameDetails.gameId, gameId));
  }
  if (input.type === 'rpg' && input.rpg) {
    await tx
      .insert(rpgDetails)
      .values({ gameId, householdId: ctx.householdId, ...input.rpg })
      .onConflictDoUpdate({ target: rpgDetails.gameId, set: input.rpg });
  } else {
    await tx.delete(rpgDetails).where(eq(rpgDetails.gameId, gameId));
  }
  if (input.type === 'puzzle' && input.puzzle) {
    await tx
      .insert(puzzleDetails)
      .values({ gameId, householdId: ctx.householdId, ...input.puzzle })
      .onConflictDoUpdate({ target: puzzleDetails.gameId, set: input.puzzle });
  } else {
    await tx.delete(puzzleDetails).where(eq(puzzleDetails.gameId, gameId));
  }
}

export async function createGame(ctx: DataContext, raw: GameInput) {
  assertCanEdit(ctx);
  const input = gameInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [game] = await tx
      .insert(games)
      .values({
        householdId: ctx.householdId,
        title: input.title,
        type: input.type,
        description: input.description ?? null,
        notes: input.notes ?? null,
        visibility: input.visibility,
        shareable: input.shareable,
        ...stampCreate(ctx),
      })
      .returning();
    if (!game) throw new Error('Failed to create game');
    await writeDetails(ctx, tx, game.id, input);
    if (input.tags) await syncTags(ctx, tx, game.id, input.tags);
    await recordAudit(tx, ctx, {
      entityType: 'game',
      entityId: game.id,
      action: 'create',
      changes: createdFields({
        title: game.title,
        type: game.type,
        visibility: game.visibility,
        shareable: game.shareable,
      }),
    });
    return game;
  });
}

const GAME_AUDIT_FIELDS = [
  'title',
  'type',
  'description',
  'notes',
  'visibility',
  'shareable',
  'coverImage',
] as const;

const auditable = (g: typeof games.$inferSelect) =>
  Object.fromEntries(GAME_AUDIT_FIELDS.map((k) => [k, g[k]]));

async function tagNames(tx: DataContext['db'], gameId: string) {
  const rows = await tx
    .select({ name: tags.name })
    .from(gameTags)
    .innerJoin(tags, eq(tags.id, gameTags.tagId))
    .where(eq(gameTags.gameId, gameId));
  return rows.map((r) => r.name).toSorted((a, b) => a.localeCompare(b));
}

const strip = <T extends { gameId: string; householdId: string } | undefined>(row: T) => {
  if (!row) return null;
  const { gameId: _g, householdId: _h, ...rest } = row;
  return rest;
};

/** Type-specific details without their key columns, for comparing before and after an edit. */
async function detailsSnapshot(tx: DataContext['db'], gameId: string) {
  const [[board], [rpg], [puzzle]] = await Promise.all([
    tx.select().from(boardGameDetails).where(eq(boardGameDetails.gameId, gameId)),
    tx.select().from(rpgDetails).where(eq(rpgDetails.gameId, gameId)),
    tx.select().from(puzzleDetails).where(eq(puzzleDetails.gameId, gameId)),
  ]);
  return { board: strip(board), rpg: strip(rpg), puzzle: strip(puzzle) };
}

export async function updateGame(ctx: DataContext, id: string, raw: GameInput) {
  assertCanEdit(ctx);
  const input = gameInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(games)
      .where(and(eq(games.id, id), eq(games.householdId, ctx.householdId)));
    if (!before) return null;
    const [tagsBefore, detailsBefore] = await Promise.all([
      tagNames(tx, id),
      detailsSnapshot(tx, id),
    ]);

    const [game] = await tx
      .update(games)
      .set({
        title: input.title,
        type: input.type,
        description: input.description ?? null,
        notes: input.notes ?? null,
        visibility: input.visibility,
        shareable: input.shareable,
        ...stampUpdate(ctx),
      })
      .where(and(eq(games.id, id), eq(games.householdId, ctx.householdId)))
      .returning();
    if (!game) return null;
    await writeDetails(ctx, tx, id, input);
    if (input.tags) await syncTags(ctx, tx, id, input.tags);

    const [tagsAfter, detailsAfter] = await Promise.all([
      tagNames(tx, id),
      detailsSnapshot(tx, id),
    ]);
    const changes = {
      ...diffFields(auditable(before), auditable(game)),
      ...diffFields({ tags: tagsBefore, ...detailsBefore }, { tags: tagsAfter, ...detailsAfter }),
    };
    if (Object.keys(changes).length) {
      await recordAudit(tx, ctx, { entityType: 'game', entityId: id, action: 'update', changes });
    }
    return game;
  });
}

export async function setCoverImage(ctx: DataContext, id: string, path: string | null) {
  assertCanEdit(ctx);
  return ctx.db.transaction(async (tx) => {
    const [before] = await tx
      .select({ coverImage: games.coverImage })
      .from(games)
      .where(and(eq(games.id, id), eq(games.householdId, ctx.householdId)));
    if (!before) return false;
    await tx
      .update(games)
      .set({ coverImage: path, ...stampUpdate(ctx) })
      .where(and(eq(games.id, id), eq(games.householdId, ctx.householdId)));
    await recordAudit(tx, ctx, {
      entityType: 'game',
      entityId: id,
      action: 'update',
      changes: { coverImage: [before.coverImage, path] },
    });
    return true;
  });
}

export async function deleteGame(ctx: DataContext, id: string): Promise<boolean> {
  assertCanEdit(ctx);
  return ctx.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(games)
      .where(and(eq(games.id, id), eq(games.householdId, ctx.householdId)))
      .returning({ id: games.id, title: games.title, type: games.type });
    const [row] = deleted;
    if (!row) return false;
    await recordAudit(tx, ctx, {
      entityType: 'game',
      entityId: id,
      action: 'delete',
      changes: deletedFields({ title: row.title, type: row.type }),
    });
    return true;
  });
}
