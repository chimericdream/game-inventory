import { purgeExpiredTrash, retentionDays } from './data/trash';
import { getDb } from './db/client';
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
