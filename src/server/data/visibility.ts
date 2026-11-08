import { and, eq, ne, type SQL } from 'drizzle-orm';

import { games } from '../db/schema';
import type { DataContext } from './context';

type Viewer = DataContext['viewer'];

export interface VisibleGameFields {
  visibility: 'normal' | 'hide_images' | 'hidden_restricted';
  coverImage: string | null;
}

/** SQL condition: which game rows this viewer may see at all. Always scoped to the household. */
export function gameVisibilityCondition(ctx: DataContext): SQL {
  const inHousehold = eq(games.householdId, ctx.householdId);
  if (ctx.viewer.role === 'restricted') {
    return and(inHousehold, ne(games.visibility, 'hidden_restricted')) as SQL;
  }
  return inHousehold;
}

/**
 * Apply per-viewer field redaction to a game row already allowed by `gameVisibilityCondition`.
 * Returns null if the viewer must not see the game (defence in depth for code paths that load
 * rows without the SQL condition).
 */
export function redactGame<T extends VisibleGameFields>(game: T, viewer: Viewer): T | null {
  if (viewer.role !== 'restricted') return game;
  if (game.visibility === 'hidden_restricted') return null;
  if (game.visibility === 'hide_images') return { ...game, coverImage: null };
  return game;
}
