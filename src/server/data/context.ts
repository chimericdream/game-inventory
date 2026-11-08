import type { Db } from '../db/client';

/**
 * The only way to touch the database from routes and components. Every data-access function takes
 * a `DataContext`, so a household scope (and later a visibility scope) cannot be forgotten.
 */
export interface DataContext {
  db: Db;
  householdId: string;
  /** Who is asking; drives per-profile visibility (e.g. `restricted` kid profiles). */
  viewer: { kind: 'user'; userId: string; role: 'admin' | 'member' | 'restricted' };
}

export function createContext(
  db: Db,
  householdId: string,
  viewer: DataContext['viewer'],
): DataContext {
  if (!householdId) throw new Error('A household id is required');
  return { db, householdId, viewer };
}
