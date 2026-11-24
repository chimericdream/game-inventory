import type { Db } from './db/client';
import { copyFiles } from './db/schema';
import { listStoredFiles, removeAllStored } from './storage';

/**
 * How long a file with no row must sit untouched before the sweep deletes it. Generous on purpose:
 * it keeps an upload in progress safe (its bytes land before its row does), and leaves time to
 * notice if a database backup was restored that does not know about newer files.
 */
export const ORPHAN_GRACE_MS = 7 * 86_400_000;

/**
 * Safety valve. A few leftovers are normal. A lot of them, making up most of the folder, means
 * the app is probably pointed at the wrong or an empty database, not that bytes were left behind,
 * so the sweep deletes nothing and asks a person to look.
 */
const DOUBT_AT = 5;

export interface SweepResult {
  /** Files with no row that were deleted. */
  removed: string[];
  /** Files with no row that could not be deleted. */
  failed: string[];
  /** Files with no row that were left alone because there were suspiciously many. */
  refused: string[];
}

/**
 * Deletes attached files under DATA_DIR/files that no `copy_files` row points to, in every
 * household. A trashed file still has its row, so it is kept until it is purged. This catches
 * bytes left behind when a removal failed after its row was already gone. Covers are not touched.
 */
export async function sweepOrphanFiles(
  db: Db,
  now = Date.now(),
  graceMs = ORPHAN_GRACE_MS,
): Promise<SweepResult> {
  // Disk first, rows second: a file whose row appears in between is simply treated as known.
  const onDisk = await listStoredFiles('files');
  const known = new Set(
    (await db.select({ path: copyFiles.storagePath }).from(copyFiles)).map((r) => r.path),
  );
  const orphans = onDisk
    .filter((f) => !known.has(f.rel) && now - f.modifiedMs > graceMs)
    .map((f) => f.rel)
    .toSorted();
  if (orphans.length >= DOUBT_AT && orphans.length * 2 > onDisk.length) {
    return { removed: [], failed: [], refused: orphans };
  }
  const failed = await removeAllStored(orphans);
  return { removed: orphans.filter((p) => !failed.includes(p)), failed, refused: [] };
}
