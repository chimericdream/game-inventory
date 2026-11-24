import { purgeExpiredTrash, retentionDays } from './data/trash';
import { getDb } from './db/client';
import { sweepOrphanFiles } from './file-sweep';
import { removeAllStored } from './storage';

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function purgeOnce() {
  try {
    const { purged, covers, files } = await purgeExpiredTrash(getDb());
    const leftOnDisk = await removeAllStored([...covers, ...files]);
    if (leftOnDisk.length > 0) {
      // The rows are gone, so these paths are not recorded anywhere else.
      console.error(
        `Trash: could not remove ${leftOnDisk.length} stored file(s), delete them by hand: ${leftOnDisk.join(', ')}`,
      );
    }
    if (purged > 0) console.info(`Trash: permanently deleted ${purged} expired item(s)`);
  } catch (e) {
    console.error('Trash purge failed', e);
  }
}

/** Permanently deletes whatever has sat in the trash past TRASH_RETENTION_DAYS, now and every few hours. */
export function startTrashPurge() {
  if (retentionDays() === 0) return;
  void purgeOnce();
  setInterval(purgeOnce, SIX_HOURS).unref();
}

async function sweepOnce() {
  try {
    const { removed, failed, refused } = await sweepOrphanFiles(getDb());
    if (refused.length > 0) {
      console.error(
        `File sweep: ${refused.length} stored file(s) belong to nothing in the database, which is too many to delete automatically. Check that DATABASE_URL and DATA_DIR point at the same install. Nothing was deleted. Examples: ${refused.slice(0, 5).join(', ')}`,
      );
    }
    // Anything removed here means an earlier removal failed, so say so rather than clean up quietly.
    if (removed.length > 0) {
      console.warn(
        `File sweep: deleted ${removed.length} stored file(s) that no longer belong to anything: ${removed.join(', ')}`,
      );
    }
    if (failed.length > 0) {
      console.error(
        `File sweep: could not delete ${failed.length} unreferenced file(s), delete them by hand: ${failed.join(', ')}`,
      );
    }
  } catch (e) {
    console.error('File sweep failed', e);
  }
}

/** Deletes stored attachments that no row points to any more, now and every few hours. */
export function startFileSweep() {
  void sweepOnce();
  setInterval(sweepOnce, SIX_HOURS).unref();
}
