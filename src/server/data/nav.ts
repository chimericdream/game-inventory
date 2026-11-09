import { and, count, eq, isNull } from 'drizzle-orm';

import { copies, games, loans, wishlistItems } from '../db/schema';
import type { DataContext } from './context';
import { gameVisibilityCondition } from './visibility';

export interface NavCounts {
  /** Copies currently out on loan. */
  loans: number;
  /** Items waiting on the wishlist. */
  wishlist: number;
}

/**
 * The small numbers on the navigation: only queues that need attention carry one. Restricted
 * profiles cannot see loans or the wishlist, so they always get zeros.
 */
export async function navCounts(ctx: DataContext): Promise<NavCounts> {
  if (ctx.viewer.role === 'restricted') return { loans: 0, wishlist: 0 };
  const [[loanRow], [wishRow]] = await Promise.all([
    ctx.db
      .select({ n: count() })
      .from(loans)
      .innerJoin(copies, eq(copies.id, loans.copyId))
      .innerJoin(games, eq(games.id, copies.gameId))
      .where(
        and(
          eq(loans.householdId, ctx.householdId),
          isNull(loans.returnedOn),
          gameVisibilityCondition(ctx),
        ),
      ),
    ctx.db
      .select({ n: count() })
      .from(wishlistItems)
      .where(eq(wishlistItems.householdId, ctx.householdId)),
  ]);
  return { loans: loanRow?.n ?? 0, wishlist: wishRow?.n ?? 0 };
}
