import { and, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';

import { boardGameDetails, games } from '../db/schema';

/*
 * Filter conditions shared by the household catalog and the guest catalog, so the two cannot
 * drift apart. Every condition assumes the query joins `board_game_details` (a left join).
 */

export const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');

export function searchCondition(search?: string): SQL | undefined {
  const q = search?.trim();
  return q ? ilike(games.title, `%${escapeLike(q)}%`) : undefined;
}

/** Games that can be played with exactly this many players. Unknown player counts never match. */
export function playersCondition(players?: number): SQL | undefined {
  if (!players) return undefined;
  return and(
    or(sql`${boardGameDetails.minPlayers} is null`, lte(boardGameDetails.minPlayers, players)),
    or(sql`${boardGameDetails.maxPlayers} is null`, gte(boardGameDetails.maxPlayers, players)),
    sql`(${boardGameDetails.minPlayers} is not null or ${boardGameDetails.maxPlayers} is not null)`,
  );
}

/** Games that take at most this many minutes. Unknown play times never match. */
export function maxMinutesCondition(maxMinutes?: number): SQL | undefined {
  return maxMinutes ? lte(boardGameDetails.playTimeMinutes, maxMinutes) : undefined;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const positiveInt = (v: string | undefined): number | undefined => {
  if (v === undefined || !/^\d{1,6}$/.test(v)) return undefined;
  const n = Number(v);
  return n > 0 ? n : undefined;
};

/** Reads a numeric search param; anything malformed is treated as absent, never an error. */
export const intParam = (sp: RawParams, key: string) => positiveInt(first(sp[key]));
export const textParam = (sp: RawParams, key: string) => {
  const v = first(sp[key])?.trim();
  return v ? v.slice(0, 200) : undefined;
};
