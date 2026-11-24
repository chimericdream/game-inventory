import { eq, sql } from 'drizzle-orm';

import { copies, copyFiles, households } from '../db/schema';
import type { DataContext } from './context';

export interface StorageStats {
  /** Size of the whole Postgres database. It is shared by every household on this install. */
  databaseBytes: number;
  files: {
    liveCount: number;
    liveBytes: number;
    /** Files in the trash, or on a copy in the trash. They still use disk until they are purged. */
    trashedCount: number;
    trashedBytes: number;
  };
}

/** What the database knows about space in use. Admins only; the disk itself is read in `storage.ts`. */
export async function storageStats(ctx: DataContext): Promise<StorageStats> {
  if (ctx.viewer.role !== 'admin') throw new Error('Only an admin can see storage use');
  const gone = sql`(${copyFiles.deletedAt} is not null or ${copies.deletedAt} is not null)`;
  const [[database], [files]] = await Promise.all([
    // Selected from the viewer's own household row, which always exists, to get exactly one row.
    ctx.db
      .select({ bytes: sql<number>`pg_database_size(current_database())::float8` })
      .from(households)
      .where(eq(households.id, ctx.householdId)),
    ctx.db
      .select({
        liveCount: sql<number>`count(*) filter (where not ${gone})::int`,
        liveBytes: sql<number>`coalesce(sum(${copyFiles.sizeBytes}) filter (where not ${gone}), 0)::float8`,
        trashedCount: sql<number>`count(*) filter (where ${gone})::int`,
        trashedBytes: sql<number>`coalesce(sum(${copyFiles.sizeBytes}) filter (where ${gone}), 0)::float8`,
      })
      .from(copyFiles)
      .innerJoin(copies, eq(copies.id, copyFiles.copyId))
      .where(eq(copyFiles.householdId, ctx.householdId)),
  ]);
  return {
    databaseBytes: Number(database?.bytes ?? 0),
    files: {
      liveCount: Number(files?.liveCount ?? 0),
      liveBytes: Number(files?.liveBytes ?? 0),
      trashedCount: Number(files?.trashedCount ?? 0),
      trashedBytes: Number(files?.trashedBytes ?? 0),
    },
  };
}
