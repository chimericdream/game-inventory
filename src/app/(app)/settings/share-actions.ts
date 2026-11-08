'use server';

import { revalidatePath } from 'next/cache';

import { requireContext } from '@/server/auth/current';
import { createShareLink, revokeShareLink } from '@/server/data/guest';
import { GAME_TYPES, type GameType } from '@/server/data/games';

export interface ShareState {
  error?: string;
  /** Path of the new link, shown once; the token is not recoverable afterwards. */
  path?: string;
}

export async function createShareLinkAction(_prev: ShareState, fd: FormData): Promise<ShareState> {
  const { ctx } = await requireContext();
  const days = Number(fd.get('expiresInDays'));
  try {
    const { token } = await createShareLink(ctx, {
      label: String(fd.get('label') ?? ''),
      expiresInDays: Number.isInteger(days) && days > 0 ? days : null,
      hideTypes: fd
        .getAll('hideTypes')
        .filter((t): t is GameType => GAME_TYPES.includes(t as GameType)),
      hideTags: String(fd.get('hideTags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      showNotes: fd.get('showNotes') === 'on',
      showLocations: fd.get('showLocations') === 'on',
    });
    revalidatePath('/settings');
    return { path: `/g/${token}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the link.' };
  }
}

export async function revokeShareLinkAction(id: string) {
  const { ctx } = await requireContext();
  await revokeShareLink(ctx, id);
  revalidatePath('/settings');
}
