import 'server-only';

import { access, constants, stat } from 'node:fs/promises';

import { sql } from 'drizzle-orm';

import pkg from '../../../package.json';
import { diskLevel } from '@/lib/bytes';
import { getDb } from '@/server/db/client';
import { dataDir, diskSpace } from '@/server/storage';

export const dynamic = 'force-dynamic';

/** `/healthz` convention: 200 with `{ status, message?, version? }`. No auth, no internals in `message`. */
export async function GET() {
  const version = process.env.APP_VERSION || pkg.version;
  const noStore = { headers: { 'Cache-Control': 'no-store' } };

  try {
    await getDb().execute(sql`select 1`);
  } catch {
    return Response.json(
      { status: 'error', message: 'database unreachable', version },
      { status: 503, ...noStore },
    );
  }

  try {
    if (!(await stat(dataDir())).isDirectory()) throw new Error('not a directory');
    await access(dataDir(), constants.W_OK);
  } catch {
    return Response.json(
      { status: 'degraded', message: 'data directory not writable', version },
      noStore,
    );
  }

  // 90% used or more: still serving, but someone needs to free space before uploads and backups fail.
  const disk = await diskSpace();
  if (disk && diskLevel(disk.totalBytes - disk.freeBytes, disk.totalBytes) === 'critical') {
    return Response.json({ status: 'degraded', message: 'disk almost full', version }, noStore);
  }

  return Response.json({ status: 'ok', version }, noStore);
}
