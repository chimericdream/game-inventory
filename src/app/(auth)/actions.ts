'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import {
  authenticate,
  credentialsInput,
  needsSetup,
  setupHousehold,
  setupInput,
} from '@/server/auth/accounts';
import { clearSessionCookie, setSessionCookie } from '@/server/auth/current';
import { createSession, deleteSession, SESSION_COOKIE } from '@/server/auth/sessions';
import { getDb } from '@/server/db/client';

export interface FormState {
  error?: string;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };

  const db = getDb();
  const user = await authenticate(db, parsed.data.email, parsed.data.password);
  if (!user) return { error: 'Incorrect email or password.' };

  const { token, expiresAt } = await createSession(db, user);
  await setSessionCookie(token, expiresAt);
  redirect('/games');
}

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const db = getDb();
  if (!(await needsSetup(db))) redirect('/login');

  const parsed = setupInput.safeParse({
    householdName: formData.get('householdName'),
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

  const user = await setupHousehold(db, parsed.data);
  const { token, expiresAt } = await createSession(db, user);
  await setSessionCookie(token, expiresAt);
  redirect('/games');
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await deleteSession(getDb(), token);
  await clearSessionCookie();
  redirect('/login');
}
