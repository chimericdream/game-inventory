import type { TileGame } from '@/components/shelf/GameTile';
import type { CatalogRow } from '@/server/data/catalog';

/**
 * The only fields that leave the server for a catalog tile. Notes, descriptions and everything
 * else on the row stay behind, and loan details exist only when the data layer supplied them
 * (never for restricted profiles).
 */
export function toTile(row: CatalogRow): TileGame {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    hasCover: row.coverImage !== null,
    expansion: row.isExpansion ? { of: row.baseTitle, standalone: row.standalone } : null,
    platforms: row.platforms,
    minPlayers: row.board?.minPlayers ?? null,
    maxPlayers: row.board?.maxPlayers ?? null,
    playTimeMinutes: row.board?.playTimeMinutes ?? null,
    loan: row.loan
      ? { borrower: row.loan.borrower, dueOn: row.loan.dueOn, daysOut: row.loan.daysOut }
      : null,
    out: row.onLoan,
  };
}

export const coverUrl = (id: string) => `/api/games/${id}/cover`;
