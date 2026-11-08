import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';

import * as schema from './schema';

/** Driver-agnostic database type so production (postgres-js) and tests (PGlite) share it. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { giPg?: ReturnType<typeof postgres>; giDb?: Db };

/** Lazily connects, so importing this module never requires DATABASE_URL (e.g. during build). */
export function getDb(): Db {
  if (globalForDb.giDb) return globalForDb.giDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = (globalForDb.giPg ??= postgres(url));
  return (globalForDb.giDb = drizzle(client, { schema }));
}
