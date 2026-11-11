import { purgeExpiredTrash, retentionDays } from './data/trash';
import { getDb } from './db/client';
import { removeStored } from './storage';

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function purgeOnce() {
  try {
    const { purged, covers } = await purgeExpiredTrash(getDb());
    for (const cover of covers) await removeStored(cover);
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
