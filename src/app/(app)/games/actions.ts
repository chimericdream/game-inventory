'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { listCatalogPage, parseCatalogFilters } from '@/server/data/catalog';
import { addCopy, deleteCopy, updateCopy, type CopyInput } from '@/server/data/copies';
import {
  createGame,
  deleteGame,
  gameInput,
  getGameDetail,
  setCoverImage,
  updateGame,
  type GameInput,
} from '@/server/data/games';
import { clearRating, ratingSummary, setRating } from '@/server/data/ratings';
import { fetchBggImage } from '@/server/lookup/bgg';
import { removeStored, saveCover } from '@/server/storage';

import { toTile } from './tiles';

export interface ActionState {
  error?: string;
  saved?: boolean;
}

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const int = (fd: FormData, key: string) => {
  const v = text(fd, key);
  return v === null || Number.isNaN(Number(v)) ? null : Math.round(Number(v));
};

/** Copy details from a form; `prefix` namespaces the fields when the form also holds a game. */
function parseCopyForm(fd: FormData, prefix = ''): CopyInput {
  const t = (key: string) => text(fd, prefix + key);
  const price = t('price');
  return {
    format: (t('format') ?? 'physical') as 'physical' | 'digital',
    platform: t('platform'),
    condition: (t('condition') ?? 'good') as 'good',
    conditionNotes: t('conditionNotes'),
    ownerUserId: t('ownerUserId'),
    locationId: t('locationId'),
    acquiredOn: t('acquiredOn'),
    priceCents: price ? Math.round(Number(price) * 100) : null,
    notes: t('notes'),
  };
}

function parseGameForm(fd: FormData): GameInput {
  const type = text(fd, 'type') as GameInput['type'];
  return {
    title: text(fd, 'title') ?? '',
    type,
    description: text(fd, 'description'),
    publisher: text(fd, 'publisher'),
    notes: text(fd, 'notes'),
    visibility: (text(fd, 'visibility') ?? 'normal') as GameInput['visibility'],
    shareable: fd.get('shareable') === 'on',
    isExpansion: fd.get('isExpansion') === 'on',
    baseGameId: text(fd, 'baseGameId'),
    standalone: fd.get('standalone') === 'on',
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
    puzzle: type === 'puzzle' ? { pieceCount: int(fd, 'pieceCount') } : undefined,
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
      // Most games added are ones we own, so the form adds a copy by default.
      if (fd.get('addCopy') === 'on') await addCopy(ctx, gameId, parseCopyForm(fd, 'copy.'));
    }

    const upload = fd.get('cover');
    let cover: File | null = upload instanceof File && upload.size > 0 ? upload : null;
    // A cover picked from a BGG lookup is downloaded here, and an uploaded file wins over it.
    // The game is already saved, so a failed download leaves it without a cover instead of failing.
    const bggImage = text(fd, 'bggImageUrl');
    if (gameId && !cover && bggImage) cover = await fetchBggImage(bggImage).catch(() => null);
    if (gameId && cover) {
      const old = (await getGameDetail(ctx, gameId))?.game.coverImage;
      await setCoverImage(ctx, gameId, await saveCover(ctx.householdId, gameId, cover));
      if (old) await removeStored(old);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' };
  }
  revalidatePath('/games');
  // Adding several expansions in a row is the common case, so a new one returns to its base game.
  const base = !id ? parsed.data.baseGameId : null;
  if (base && parsed.data.isExpansion) {
    revalidatePath(`/games/${base}`);
    redirect(`/games/${base}`);
  }
  redirect(`/games/${gameId}`);
}

export async function deleteGameAction(id: string) {
  const { ctx } = await requireContext();
  const old = (await getGameDetail(ctx, id))?.game.coverImage;
  await deleteGame(ctx, id);
  await removeStored(old);
  revalidatePath('/games');
  revalidatePath('/games/[id]', 'page');
  redirect('/games');
}

export async function addCopyAction(
  gameId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { ctx } = await requireContext();
  try {
    await addCopy(ctx, gameId, parseCopyForm(fd));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not add copy.' };
  }
  revalidatePath(`/games/${gameId}`);
  return {};
}

export async function updateCopyAction(
  gameId: string,
  copyId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { ctx } = await requireContext();
  try {
    const updated = await updateCopy(ctx, copyId, parseCopyForm(fd));
    if (!updated) return { error: 'Copy not found.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save copy.' };
  }
  revalidatePath(`/games/${gameId}`);
  return { saved: true };
}

export async function deleteCopyAction(gameId: string, copyId: string) {
  const { ctx } = await requireContext();
  await deleteCopy(ctx, copyId);
  revalidatePath(`/games/${gameId}`);
}

export type LoadMoreResult =
  | { ok: true; tiles: ReturnType<typeof toTile>[]; hasMore: boolean }
  | { ok: false; error: string };

/**
 * The next page of the library for "Load more". It reads the same filters the page was built
 * from, goes through the same data layer, and returns only the fields a tile draws.
 */
export async function loadMoreGamesAction(query: string, page: number): Promise<LoadMoreResult> {
  const { ctx } = await requireContext();
  if (typeof query !== 'string' || query.length > 2000 || !Number.isInteger(page) || page < 2) {
    return { ok: false, error: 'Could not load more games.' };
  }
  const filters = parseCatalogFilters(Object.fromEntries(new URLSearchParams(query)));
  const result = await listCatalogPage(ctx, { ...filters, page });
  return { ok: true, tiles: result.rows.map(toTile), hasMore: result.hasMore };
}

/** Sets the viewer's rating from the star buttons; choosing the current score again clears it. */
export async function rateGameAction(gameId: string, fd: FormData) {
  const { ctx } = await requireContext();
  const score = Number(fd.get('score'));
  if (!Number.isInteger(score)) return;
  const { mine } = await ratingSummary(ctx, gameId);
  if (mine === score) await clearRating(ctx, gameId);
  else await setRating(ctx, gameId, score);
  revalidatePath(`/games/${gameId}`);
}
