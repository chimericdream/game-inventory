'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createUser, newUserInput } from '@/server/auth/accounts';
import { requireContext } from '@/server/auth/current';
import { createLocation, deleteLocation } from '@/server/data/lookups';
import { isUuid } from '@/server/data/ids';
import { isTrashKind, purgeTrashed, restoreTrashed } from '@/server/data/trash';
import { removeStored } from '@/server/storage';
import { deletePlayer, linkPlayerToUser, mergePlayers, renamePlayer } from '@/server/data/players';

export interface SettingsState {
  error?: string;
  ok?: boolean;
  message?: string;
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
  const existingPlayer = String(fd.get('linkPlayerId') ?? '');
  try {
    const user = await createUser(ctx.db, ctx.householdId, parsed.data, ctx.viewer.userId);
    if (existingPlayer) {
      if (!isUuid(existingPlayer)) return { error: 'Choose someone from the list.' };
      const linked = await linkPlayerToUser(ctx, existingPlayer, user.id);
      if (!linked.ok) {
        revalidatePath('/settings');
        return { error: `Added ${user.name}, but their earlier plays could not be linked.` };
      }
      revalidatePath('/settings');
      return {
        ok: true,
        message: `Added ${user.name}. ${linked.moved} earlier plays now count for them.`,
      };
    }
  } catch {
    return { error: 'Could not add that person (is the email already used?).' };
  }
  revalidatePath('/settings');
  return { ok: true, message: 'Added.' };
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

export async function deleteLocationAction(
  id: string,
  _prev: SettingsState,
  _fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  try {
    const result = await deleteLocation(ctx, id);
    if (!result.ok) {
      if (result.reason === 'has_copies') {
        return {
          error: `It holds ${result.copies} ${result.copies === 1 ? 'copy' : 'copies'}. Move ${result.copies === 1 ? 'it' : 'them'} first.`,
        };
      }
      if (result.reason === 'has_children') {
        return { error: 'It has places inside it. Remove those first.' };
      }
      return { error: 'That place no longer exists.' };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not remove it.' };
  }
  revalidatePath('/settings');
  revalidatePath('/games', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Players who are not users (admin only)
// ---------------------------------------------------------------------------

export async function renamePlayerAction(
  playerId: string,
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  try {
    const ok = await renamePlayer(ctx, playerId, String(fd.get('name') ?? ''));
    if (!ok) return { error: 'That person no longer exists.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not rename.' };
  }
  revalidatePath('/settings');
  revalidatePath('/plays');
  return { ok: true, message: 'Renamed.' };
}

export async function linkPlayerAction(
  playerId: string,
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  const userId = String(fd.get('userId') ?? '');
  if (!isUuid(userId)) return { error: 'Choose an account first.' };
  let moved = 0;
  try {
    const result = await linkPlayerToUser(ctx, playerId, userId);
    if (!result.ok) {
      return {
        error:
          result.reason === 'already_linked'
            ? 'That person already has an account.'
            : 'Could not find them or that account.',
      };
    }
    moved = result.moved;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not link.' };
  }
  // The person disappears from the list, so the confirmation has to live on the page itself.
  revalidatePath('/settings');
  revalidatePath('/plays');
  redirect(`/settings?done=linked&n=${moved}`);
}

export async function mergePlayersAction(
  playerId: string,
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  const intoId = String(fd.get('intoId') ?? '');
  if (!isUuid(intoId)) return { error: 'Choose who they are the same as.' };
  let moved = 0;
  try {
    const result = await mergePlayers(ctx, playerId, intoId);
    if (!result.ok) {
      return {
        error:
          result.reason === 'both_linked'
            ? 'Both of those have accounts, so they cannot be merged.'
            : result.reason === 'same_player'
              ? 'Choose someone else.'
              : 'Could not find one of them.',
      };
    }
    moved = result.moved;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not merge.' };
  }
  revalidatePath('/settings');
  revalidatePath('/plays');
  redirect(`/settings?done=merged&n=${moved}`);
}

export async function deletePlayerAction(
  playerId: string,
  _prev: SettingsState,
  _fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  try {
    const result = await deletePlayer(ctx, playerId);
    if (!result.ok) {
      return {
        error:
          result.reason === 'has_plays'
            ? `They have ${result.plays} plays. Merge them into someone instead.`
            : result.reason === 'is_user'
              ? 'They have an account.'
              : 'That person no longer exists.',
      };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not remove them.' };
  }
  revalidatePath('/settings');
  return { ok: true };
}

/** What to refresh after something comes back or goes for good. */
function refreshAll() {
  revalidatePath('/settings');
  revalidatePath('/games', 'layout');
  revalidatePath('/plays');
  revalidatePath('/wishlist');
  revalidatePath('/loans');
}

export async function restoreTrashedAction(
  kind: string,
  id: string,
  _prev: SettingsState,
  _fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  if (!isTrashKind(kind)) return { error: 'Unknown item.' };
  try {
    const result = await restoreTrashed(ctx, kind, id);
    if (!result.ok) return { error: result.error };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not restore it.' };
  }
  refreshAll();
  return { ok: true };
}

/** The browser asks for a typed word first; deleting permanently needs the admin role either way. */
export async function purgeTrashedAction(
  kind: string,
  id: string,
  _prev: SettingsState,
  _fd: FormData,
): Promise<SettingsState> {
  const { ctx } = await requireContext();
  if (!isTrashKind(kind)) return { error: 'Unknown item.' };
  try {
    const result = await purgeTrashed(ctx, kind, id);
    if (!result.ok) return { error: result.error };
    await removeStored(result.coverImage);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not delete it.' };
  }
  refreshAll();
  return { ok: true };
}
