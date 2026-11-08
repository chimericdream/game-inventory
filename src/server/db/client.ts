import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

// Reuse one connection pool across dev hot reloads.
const client = (globalForDb.pg ??= postgres(connectionString()));

export const db = drizzle(client, { schema });
export type Db = typeof db;
