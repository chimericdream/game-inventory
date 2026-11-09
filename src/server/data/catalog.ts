import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import {
  boardGameDetails,
  copies,
  gameTags,
  games,
  loans,
  locations,
  tags,
  users,
} from '../db/schema';
import {
  intParam,
  maxMinutesCondition,
  playersCondition,
  searchCondition,
  textParam,
} from './catalogFilters';
import type { DataContext } from './context';
import { GAME_TYPES, type GameType } from './games';
import { isUuid } from './ids';
import { gameVisibilityCondition, redactGame } from './visibility';

export const CATALOG_SORTS = ['title', 'newest'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export const CATALOG_PAGE_SIZE = 48;

export interface CatalogFilters {
  search?: string;
  type?: GameType;
  /** Games that can be played with exactly this many players. */
  players?: number;
  /** Games that take at most this many minutes. */
  maxMinutes?: number;
  tag?: string;
  /** A location and everything nested under it. */
  locationId?: string;
  ownerUserId?: string;
  /** `out`: some copy is on loan. `here`: nothing is on loan. Ignored for restricted profiles. */
  availability?: 'here' | 'out';
  sort?: CatalogSort;
  /** 1-based. */
  page?: number;
}

type RawParams = Record<string, string | string[] | undefined>;

/** Reads filters from URL search params. Malformed values are dropped, never an error. */
export function parseCatalogFilters(sp: RawParams): CatalogFilters {
  const type = textParam(sp, 'type');
  const availability = textParam(sp, 'availability');
  const sort = textParam(sp, 'sort');
  return {
    search: textParam(sp, 'q'),
    type: GAME_TYPES.includes(type as GameType) ? (type as GameType) : undefined,
    players: intParam(sp, 'players'),
    maxMinutes: intParam(sp, 'maxMinutes'),
    tag: textParam(sp, 'tag'),
    locationId: textParam(sp, 'location'),
    ownerUserId: textParam(sp, 'owner'),
    availability: availability === 'here' || availability === 'out' ? availability : undefined,
    sort: CATALOG_SORTS.includes(sort as CatalogSort) ? (sort as CatalogSort) : undefined,
    page: intParam(sp, 'page'),
  };
}

type FilterKey = 'type' | 'tag' | 'locationId' | 'ownerUserId' | 'availability';

const canSeeLoans = (ctx: DataContext) => ctx.viewer.role !== 'restricted';

function onLoanSql(ctx: DataContext): SQL {
  return sql`exists (select 1 from ${loans} l join ${copies} c on c.id = l.copy_id
    where c.game_id = ${games.id} and l.household_id = ${ctx.householdId} and l.returned_on is null)`;
}

/** Whether a filter value can possibly match (malformed ids can never match anything). */
function hasImpossibleFilter(f: CatalogFilters) {
  return (
    (f.locationId !== undefined && !isUuid(f.locationId)) ||
    (f.ownerUserId !== undefined && !isUuid(f.ownerUserId))
  );
}

/**
 * Every WHERE condition for a catalog query, always starting with household visibility. `omit`
 * leaves one facet's own filter out, so its counts show what choosing each value would give.
 */
function conditions(ctx: DataContext, f: CatalogFilters, omit?: FilterKey): SQL[] {
  const out: (SQL | undefined)[] = [
    gameVisibilityCondition(ctx),
    searchCondition(f.search),
    playersCondition(f.players),
    maxMinutesCondition(f.maxMinutes),
  ];
  if (f.type && omit !== 'type') out.push(sql`${games.type} = ${f.type}`);
  if (f.tag && omit !== 'tag') {
    out.push(
      sql`exists (select 1 from ${gameTags} gt join ${tags} t on t.id = gt.tag_id
        where gt.game_id = ${games.id} and lower(t.name) = ${f.tag.toLowerCase()})`,
    );
  }
  if (f.locationId && omit !== 'locationId') {
    out.push(
      sql`exists (select 1 from ${copies} c where c.game_id = ${games.id}
        and c.household_id = ${ctx.householdId} and c.location_id in (
          with recursive tree(id) as (
            select id from ${locations} where id = ${f.locationId} and household_id = ${ctx.householdId}
            union all
            select l.id from ${locations} l join tree t on l.parent_id = t.id
          ) select id from tree))`,
    );
  }
  if (f.ownerUserId && omit !== 'ownerUserId') {
    out.push(
      sql`exists (select 1 from ${copies} c where c.game_id = ${games.id}
        and c.household_id = ${ctx.householdId} and c.owner_user_id = ${f.ownerUserId})`,
    );
  }
  if (f.availability && omit !== 'availability' && canSeeLoans(ctx)) {
    out.push(f.availability === 'out' ? onLoanSql(ctx) : sql`not ${onLoanSql(ctx)}`);
  }
  return out.filter((c): c is SQL => c !== undefined);
}

export interface CatalogLoan {
  borrower: string;
  dueOn: string | null;
  copiesOut: number;
}

async function hydrate(
  ctx: DataContext,
  visible: {
    game: typeof games.$inferSelect;
    board: typeof boardGameDetails.$inferSelect | null;
  }[],
) {
  const ids = visible.map((r) => r.game.id);
  if (ids.length === 0) return [];
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
    canSeeLoans(ctx)
      ? ctx.db
          .select({ gameId: copies.gameId, borrower: loans.borrower, dueOn: loans.dueOn })
          .from(loans)
          .innerJoin(copies, eq(copies.id, loans.copyId))
          .where(
            and(
              eq(loans.householdId, ctx.householdId),
              isNull(loans.returnedOn),
              inArray(copies.gameId, ids),
            ),
          )
          .orderBy(asc(loans.lentOn), asc(loans.id))
      : Promise.resolve([] as { gameId: string; borrower: string; dueOn: string | null }[]),
  ]);

  return visible.map(({ game, board }) => {
    const out = loanRows.filter((l) => l.gameId === game.id);
    const loan: CatalogLoan | null = out[0]
      ? { borrower: out[0].borrower, dueOn: out[0].dueOn, copiesOut: out.length }
      : null;
    return {
      ...game,
      board,
      onLoan: out.length > 0,
      loan,
      copyCount: copyRows.filter((c) => c.gameId === game.id).length,
      platforms: [
        ...new Set(
          copyRows.filter((c) => c.gameId === game.id && c.platform).map((c) => c.platform!),
        ),
      ],
      tags: tagRows.filter((t) => t.gameId === game.id).map((t) => t.name),
    };
  });
}

export type CatalogRow = Awaited<ReturnType<typeof hydrate>>[number];

export interface CatalogPage {
  rows: CatalogRow[];
  /** Games matching the filters that this viewer may see. Never counts hidden games. */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const emptyPage = (page: number, pageSize: number): CatalogPage => ({
  rows: [],
  total: 0,
  page,
  pageSize,
  hasMore: false,
});

/** One page of the catalog. Filtering, sorting and paging all happen in the database. */
export async function listCatalogPage(
  ctx: DataContext,
  filters: CatalogFilters = {},
  pageSize = CATALOG_PAGE_SIZE,
): Promise<CatalogPage> {
  const page = Math.max(1, filters.page ?? 1);
  if (hasImpossibleFilter(filters)) return emptyPage(page, pageSize);
  const where = and(...conditions(ctx, filters));

  const [totalRow] = await ctx.db
    .select({ n: count() })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .where(where);
  const total = totalRow?.n ?? 0;

  const order =
    filters.sort === 'newest'
      ? [desc(games.createdAt), desc(games.id)]
      : [asc(games.title), asc(games.id)];
  const raw = await ctx.db
    .select({ game: games, board: boardGameDetails })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .where(where)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const visible = raw.flatMap((r) => {
    const game = redactGame(r.game, ctx.viewer);
    return game ? [{ game, board: r.board }] : [];
  });
  return {
    rows: await hydrate(ctx, visible),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Every matching game, unpaged. Only for small pickers and internal use; screens that list the
 * catalog must use `listCatalogPage` so the full list never reaches the browser.
 */
export async function listCatalog(ctx: DataContext, filters: CatalogFilters = {}) {
  if (hasImpossibleFilter(filters)) return [];
  const raw = await ctx.db
    .select({ game: games, board: boardGameDetails })
    .from(games)
    .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
    .where(and(...conditions(ctx, filters)))
    .orderBy(asc(games.title), asc(games.id));
  const visible = raw.flatMap((r) => {
    const game = redactGame(r.game, ctx.viewer);
    return game ? [{ game, board: r.board }] : [];
  });
  return hydrate(ctx, visible);
}

// ---------------------------------------------------------------------------
// Facets and summary
// ---------------------------------------------------------------------------

export interface CatalogFacets {
  types: { value: GameType; count: number }[];
  tags: { name: string; count: number }[];
  /** Every location with the number of matching games in it or anything nested under it. */
  locations: { id: string; name: string; parentId: string | null; count: number }[];
  owners: { userId: string; name: string; count: number }[];
  /** Null for restricted profiles, who cannot see loans. */
  availability: { here: number; out: number } | null;
}

/**
 * Counts for the filter sidebar. Each facet is counted under all the other active filters and the
 * viewer's visibility, so a restricted profile never sees a count that includes hidden games.
 */
export async function catalogFacets(
  ctx: DataContext,
  filters: CatalogFilters = {},
): Promise<CatalogFacets> {
  const empty: CatalogFacets = {
    types: [],
    tags: [],
    locations: [],
    owners: [],
    availability: canSeeLoans(ctx) ? { here: 0, out: 0 } : null,
  };
  if (hasImpossibleFilter(filters)) return empty;

  const [typeRows, tagRows, locationLinks, allLocations, ownerRows, availabilityRow] =
    await Promise.all([
      ctx.db
        .select({ type: games.type, n: count() })
        .from(games)
        .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
        .where(and(...conditions(ctx, filters, 'type')))
        .groupBy(games.type),
      ctx.db
        .select({ name: tags.name, n: sql<number>`count(distinct ${games.id})::int` })
        .from(games)
        .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
        .innerJoin(gameTags, eq(gameTags.gameId, games.id))
        .innerJoin(tags, eq(tags.id, gameTags.tagId))
        .where(and(...conditions(ctx, filters, 'tag')))
        .groupBy(tags.name)
        .orderBy(asc(tags.name)),
      ctx.db
        .selectDistinct({ locationId: copies.locationId, gameId: games.id })
        .from(games)
        .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
        .innerJoin(copies, eq(copies.gameId, games.id))
        .where(and(...conditions(ctx, filters, 'locationId'), isNotNull(copies.locationId))),
      ctx.db
        .select({ id: locations.id, name: locations.name, parentId: locations.parentId })
        .from(locations)
        .where(eq(locations.householdId, ctx.householdId))
        .orderBy(asc(locations.name)),
      canSeeLoans(ctx)
        ? ctx.db
            .select({
              userId: users.id,
              name: users.name,
              n: sql<number>`count(distinct ${games.id})::int`,
            })
            .from(games)
            .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
            .innerJoin(copies, eq(copies.gameId, games.id))
            .innerJoin(users, eq(users.id, copies.ownerUserId))
            .where(and(...conditions(ctx, filters, 'ownerUserId')))
            .groupBy(users.id, users.name)
            .orderBy(asc(users.name))
        : Promise.resolve([] as { userId: string; name: string; n: number }[]),
      canSeeLoans(ctx)
        ? ctx.db
            .select({
              out: sql<number>`count(*) filter (where ${onLoanSql(ctx)})::int`,
              here: sql<number>`count(*) filter (where not ${onLoanSql(ctx)})::int`,
            })
            .from(games)
            .leftJoin(boardGameDetails, eq(boardGameDetails.gameId, games.id))
            .where(and(...conditions(ctx, filters, 'availability')))
        : Promise.resolve([]),
    ]);

  const gamesAt = new Map<string, Set<string>>();
  for (const { locationId, gameId } of locationLinks) {
    if (!locationId) continue;
    const set = gamesAt.get(locationId) ?? new Set<string>();
    set.add(gameId);
    gamesAt.set(locationId, set);
  }
  const children = new Map<string | null, string[]>();
  for (const l of allLocations) {
    const list = children.get(l.parentId) ?? [];
    list.push(l.id);
    children.set(l.parentId, list);
  }
  const subtree = (id: string, into: Set<string>) => {
    for (const g of gamesAt.get(id) ?? []) into.add(g);
    for (const child of children.get(id) ?? []) subtree(child, into);
    return into;
  };

  return {
    types: typeRows
      .map((r) => ({ value: r.type, count: r.n }))
      .toSorted((a, b) => GAME_TYPES.indexOf(a.value) - GAME_TYPES.indexOf(b.value)),
    tags: tagRows.map((r) => ({ name: r.name, count: r.n })),
    locations: allLocations.map((l) => ({
      ...l,
      count: subtree(l.id, new Set()).size,
    })),
    owners: ownerRows.map((r) => ({ userId: r.userId, name: r.name, count: r.n })),
    availability: canSeeLoans(ctx)
      ? { here: availabilityRow[0]?.here ?? 0, out: availabilityRow[0]?.out ?? 0 }
      : null,
  };
}

export interface LibrarySummary {
  /** Games this viewer can see. Hidden games are not counted. */
  games: number;
  /** Locations that hold at least one visible game. */
  shelves: number;
  /** Open loans, overdue and due-this-week counts. Zero for restricted profiles. */
  onLoan: number;
  overdue: number;
  dueThisWeek: number;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The numbers behind the one-line summary at the top of the library. */
export async function librarySummary(ctx: DataContext): Promise<LibrarySummary> {
  const [gamesRow] = await ctx.db
    .select({ n: count() })
    .from(games)
    .where(gameVisibilityCondition(ctx));
  const [shelvesRow] = await ctx.db
    .select({ n: sql<number>`count(distinct ${copies.locationId})::int` })
    .from(copies)
    .innerJoin(games, eq(games.id, copies.gameId))
    .where(and(eq(copies.householdId, ctx.householdId), gameVisibilityCondition(ctx)));
  const base = { games: gamesRow?.n ?? 0, shelves: shelvesRow?.n ?? 0 };
  if (!canSeeLoans(ctx)) return { ...base, onLoan: 0, overdue: 0, dueThisWeek: 0 };

  const today = new Date();
  const [loanRow] = await ctx.db
    .select({
      onLoan: count(),
      overdue: sql<number>`count(*) filter (where ${loans.dueOn} < ${isoDay(today)})::int`,
      dueThisWeek: sql<number>`count(*) filter (where ${loans.dueOn} >= ${isoDay(today)}
        and ${loans.dueOn} <= ${isoDay(new Date(today.getTime() + 7 * 86_400_000))})::int`,
    })
    .from(loans)
    .innerJoin(copies, eq(copies.id, loans.copyId))
    .innerJoin(games, eq(games.id, copies.gameId))
    .where(
      and(
        eq(loans.householdId, ctx.householdId),
        isNull(loans.returnedOn),
        gameVisibilityCondition(ctx),
      ),
    );
  return {
    ...base,
    onLoan: loanRow?.onLoan ?? 0,
    overdue: loanRow?.overdue ?? 0,
    dueThisWeek: loanRow?.dueThisWeek ?? 0,
  };
}
