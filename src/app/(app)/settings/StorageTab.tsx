import { diskLevel, formatBytes, type DiskLevel } from '@/lib/bytes';
import { requireContext } from '@/server/auth/current';
import { storageStats } from '@/server/data/storage-stats';
import { retentionDays } from '@/server/data/trash';
import { directoryUsage, diskSpace } from '@/server/storage';

import classes from './Settings.module.css';
import storage from './Storage.module.css';

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const LEVEL_TEXT: Record<DiskLevel, string> = {
  ok: 'Plenty of room.',
  warning: 'Getting full. Free up some space soon.',
  critical: 'Almost full. Free up space now, or uploads and backups will start to fail.',
};

/** Admin only: how full the data disk is, and what is using it. */
export async function StorageTab() {
  const { ctx } = await requireContext();
  const [stats, disk, covers, files] = await Promise.all([
    storageStats(ctx),
    diskSpace(),
    directoryUsage(`covers/${ctx.householdId}`),
    directoryUsage(`files/${ctx.householdId}`),
  ]);
  const days = retentionDays();
  const used = disk ? disk.totalBytes - disk.freeBytes : 0;
  const level = disk ? diskLevel(used, disk.totalBytes) : 'ok';
  const percent = disk && disk.totalBytes > 0 ? Math.round((used / disk.totalBytes) * 100) : 0;

  return (
    <section className={classes.section} aria-labelledby="storage">
      <h2 id="storage">Storage</h2>
      <p className={classes.lede}>How much room is left, and what is using it.</p>

      {disk ? (
        <div className={storage.disk} data-level={level}>
          <p className={storage.headline}>
            <b>{formatBytes(disk.freeBytes)}</b> free of {formatBytes(disk.totalBytes)}
          </p>
          <div
            className={storage.bar}
            role="progressbar"
            aria-label="Disk space used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}% used`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className={storage.status} role="status">
            {percent}% used. {LEVEL_TEXT[level]}
          </p>
        </div>
      ) : (
        <p className={classes.problem} role="alert">
          Could not read the disk that holds the data folder.
        </p>
      )}

      <h3 className={storage.subhead}>What is using it</h3>
      <dl className={storage.rows}>
        <dt>Cover images</dt>
        <dd>
          {formatBytes(covers.bytes)}
          <small>{plural(covers.files, 'image')}</small>
        </dd>
        <dt>Print &amp; play files</dt>
        <dd>
          {formatBytes(files.bytes)}
          <small>{plural(files.files, 'file')}</small>
        </dd>
        <dt>Database</dt>
        <dd>
          {formatBytes(stats.databaseBytes)}
          <small>may be on a different disk</small>
        </dd>
      </dl>

      {stats.files.trashedCount > 0 && (
        <p className={classes.lede}>
          {plural(stats.files.trashedCount, 'file')} ({formatBytes(stats.files.trashedBytes)}) in
          the trash still {stats.files.trashedCount === 1 ? 'uses' : 'use'} space.{' '}
          {days > 0
            ? `They are deleted for good after ${plural(days, 'day')}, or sooner if you delete them from the trash.`
            : 'They stay until you delete them from the trash.'}
        </p>
      )}
      <p className={classes.lede}>
        The disk figures are for the disk that holds the data folder. Backups are stored wherever
        you point <code>scripts/backup.sh</code>, so they are not counted here.
      </p>
    </section>
  );
}
