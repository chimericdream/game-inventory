import 'server-only';

import { access, constants } from 'node:fs/promises';

import { sql } from 'drizzle-orm';

import { getDb } from '@/server/db/client';
import { dataDir } from '@/server/storage';

export const dynamic = 'force-dynamic';

/** `/healthz` convention: 200 with `{ status, message?, version? }`. No auth, no internals in `message`. */
export async function GET() {
  const version = process.env.APP_VERSION || undefined;
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
    await access(dataDir(), constants.W_OK);
  } catch {
    return Response.json(
      { status: 'degraded', message: 'data directory not writable', version },
      noStore,
    );
  }

  return Response.json({ status: 'ok', version }, noStore);
}
