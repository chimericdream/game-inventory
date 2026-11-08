'use server';

import { revalidatePath } from 'next/cache';

import { createUser, newUserInput } from '@/server/auth/accounts';
import { requireContext } from '@/server/auth/current';
import { createLocation } from '@/server/data/lookups';

export interface SettingsState {
  error?: string;
  ok?: boolean;
}

export async function addMemberAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { ctx } = await requireContext();
  if (ctx.viewer.role !== 'admin') return { error: 'Only admins can add people.' };
  const parsed = newUserInput.safeParse({
    name: fd.get('name'),
    email: fd.get('email'),
    password: fd.get('password'),
    role: fd.get('role'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  try {
    await createUser(ctx.db, ctx.householdId, parsed.data);
  } catch {
    return { error: 'Could not add that person (is the email already used?).' };
  }
  revalidatePath('/settings');
  return { ok: true };
}

export async function addLocationAction(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  try {
    await createLocation(ctx, String(fd.get('name') ?? ''), (fd.get('parentId') as string) || null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not add location.' };
  }
  revalidatePath('/settings');
  return { ok: true };
}
