import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createContext, type DataContext } from '../data/context';
import { getDb } from '../db/client';
import { needsSetup } from './accounts';
import { SESSION_COOKIE, validateSession, type SessionUser } from './sessions';

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(getDb(), token);
});

/** For pages and actions that need a signed-in user. Redirects to setup/login otherwise. */
export async function requireContext(): Promise<{ ctx: DataContext; user: SessionUser }> {
  const user = await getSessionUser();
  if (!user) {
    redirect((await needsSetup(getDb())) ? '/setup' : '/login');
  }
  const ctx = createContext(getDb(), user.householdId, {
    kind: 'user',
    userId: user.userId,
    role: user.role,
  });
  return { ctx, user };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** For route handlers: returns null instead of redirecting when there is no session. */
export async function getApiContext(): Promise<DataContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return createContext(getDb(), user.householdId, {
    kind: 'user',
    userId: user.userId,
    role: user.role,
  });
}
