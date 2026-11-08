import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';

import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'gi_session';
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SessionUser {
  userId: string;
  householdId: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'restricted';
}

export async function createSession(
  db: Db,
  user: { id: string; householdId: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: hashToken(token),
    householdId: user.householdId,
    userId: user.id,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function validateSession(
  db: Db,
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      userId: users.id,
      householdId: users.householdId,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
