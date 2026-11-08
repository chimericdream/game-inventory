'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { addCopy, deleteCopy } from '@/server/data/copies';
import {
  createGame,
  deleteGame,
  gameInput,
  getGameDetail,
  setCoverImage,
  updateGame,
  type GameInput,
} from '@/server/data/games';
import { removeStored, saveCover } from '@/server/storage';

export interface ActionState {
  error?: string;
}

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const int = (fd: FormData, key: string) => {
  const v = text(fd, key);
  return v === null || Number.isNaN(Number(v)) ? null : Math.round(Number(v));
};

function parseGameForm(fd: FormData): GameInput {
  const type = text(fd, 'type') as GameInput['type'];
  return {
    title: text(fd, 'title') ?? '',
    type,
    description: text(fd, 'description'),
    notes: text(fd, 'notes'),
    visibility: (text(fd, 'visibility') ?? 'normal') as GameInput['visibility'],
    shareable: fd.get('shareable') === 'on',
    tags: (text(fd, 'tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    board:
      type === 'board' || type === 'card'
        ? {
            minPlayers: int(fd, 'minPlayers'),
            maxPlayers: int(fd, 'maxPlayers'),
            playTimeMinutes: int(fd, 'playTimeMinutes'),
            complexity: int(fd, 'complexity'),
            minAge: int(fd, 'minAge'),
          }
        : undefined,
    rpg:
      type === 'rpg' ? { system: text(fd, 'system'), bookKind: text(fd, 'bookKind') } : undefined,
  };
}

export async function saveGameAction(
  id: string | null,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { ctx } = await requireContext();
  const parsed = gameInput.safeParse(parseGameForm(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

  let gameId = id;
  try {
    if (id) {
      if (!(await updateGame(ctx, id, parsed.data))) return { error: 'Game not found.' };
    } else {
      gameId = (await createGame(ctx, parsed.data)).id;
    }

    const cover = fd.get('cover');
    if (gameId && cover instanceof File && cover.size > 0) {
      const old = (await getGameDetail(ctx, gameId))?.game.coverImage;
      await setCoverImage(ctx, gameId, await saveCover(ctx.householdId, gameId, cover));
      if (old) await removeStored(old);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' };
  }
  revalidatePath('/games');
  redirect(`/games/${gameId}`);
}

export async function deleteGameAction(id: string) {
  const { ctx } = await requireContext();
  const old = (await getGameDetail(ctx, id))?.game.coverImage;
  await deleteGame(ctx, id);
  await removeStored(old);
  revalidatePath('/games');
  redirect('/games');
}

export async function addCopyAction(
  gameId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { ctx } = await requireContext();
  const price = text(fd, 'price');
  try {
    await addCopy(ctx, gameId, {
      format: (text(fd, 'format') ?? 'physical') as 'physical' | 'digital',
      platform: text(fd, 'platform'),
      condition: (text(fd, 'condition') ?? 'good') as 'good',
      ownerUserId: text(fd, 'ownerUserId'),
      locationId: text(fd, 'locationId'),
      acquiredOn: text(fd, 'acquiredOn'),
      priceCents: price ? Math.round(Number(price) * 100) : null,
      notes: text(fd, 'notes'),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not add copy.' };
  }
  revalidatePath(`/games/${gameId}`);
  return {};
}

export async function deleteCopyAction(gameId: string, copyId: string) {
  const { ctx } = await requireContext();
  await deleteCopy(ctx, copyId);
  revalidatePath(`/games/${gameId}`);
}
