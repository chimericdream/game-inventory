import { and, eq, sql } from 'drizzle-orm';

import { games, locations } from '../db/schema';
import type { ImportRow } from '../import/csv';
import { addCopy } from './copies';
import type { DataContext } from './context';
import { createGame } from './games';

export interface ImportSummary {
  created: number;
  skipped: string[];
}

/** Imports parsed rows. A game with the same title and type already in the household is skipped. */
export async function importGames(ctx: DataContext, rows: ImportRow[]): Promise<ImportSummary> {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot import');
  const summary: ImportSummary = { created: 0, skipped: [] };
  const locationIds = new Map<string, string>();

  async function locationId(name: string) {
    const key = name.toLowerCase();
    const cached = locationIds.get(key);
    if (cached) return cached;
    const [existing] = await ctx.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.householdId, ctx.householdId), sql`lower(${locations.name}) = ${key}`),
      );
    let id = existing?.id;
    if (!id) {
      const [created] = await ctx.db
        .insert(locations)
        .values({ householdId: ctx.householdId, name })
        .returning({ id: locations.id });
      id = created!.id;
    }
    locationIds.set(key, id);
    return id;
  }

  for (const row of rows) {
    const [dupe] = await ctx.db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          eq(games.householdId, ctx.householdId),
          eq(games.type, row.type),
          sql`lower(${games.title}) = ${row.title.toLowerCase()}`,
        ),
      );
    if (dupe) {
      summary.skipped.push(row.title);
      continue;
    }
    const isBoard = row.type === 'board' || row.type === 'card';
    const game = await createGame(ctx, {
      title: row.title,
      type: row.type,
      notes: row.notes,
      tags: row.tags,
      board: isBoard
        ? {
            minPlayers: row.minPlayers,
            maxPlayers: row.maxPlayers,
            playTimeMinutes: row.playTimeMinutes,
            complexity: row.complexity,
          }
        : undefined,
    });
    await addCopy(ctx, game.id, {
      platform: row.platform,
      locationId: row.location ? await locationId(row.location) : null,
    });
    summary.created++;
  }
  return summary;
}
