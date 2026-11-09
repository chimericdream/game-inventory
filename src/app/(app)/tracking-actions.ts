'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';

import { requireContext } from '@/server/auth/current';
import { GAME_TYPES, type GameType } from '@/server/data/games';
import { lendCopy, returnLoan } from '@/server/data/loans';
import { deletePlay, logPlay } from '@/server/data/plays';
import { resolvePlayerNames } from '@/server/data/players';
import { addWishlistItem, markAcquired, removeWishlistItem } from '@/server/data/wishlist';

export interface TrackState {
  error?: string;
  ok?: boolean;
}

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const fail = (e: unknown, fallback: string): TrackState => ({
  error:
    e instanceof ZodError
      ? (e.issues[0]?.message ?? fallback)
      : e instanceof Error
        ? e.message
        : fallback,
});

export async function lendAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const { ctx } = await requireContext();
  try {
    await lendCopy(ctx, {
      copyId: text(fd, 'copyId') ?? '',
      borrower: text(fd, 'borrower') ?? '',
      dueOn: text(fd, 'dueOn'),
    });
  } catch (e) {
    return fail(e, 'Could not record the loan.');
  }
  revalidatePath('/loans');
  revalidatePath('/games', 'layout');
  return { ok: true };
}

export async function returnLoanAction(loanId: string) {
  const { ctx } = await requireContext();
  await returnLoan(ctx, loanId);
  revalidatePath('/loans');
  revalidatePath('/games', 'layout');
}

export async function addWishlistAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const { ctx } = await requireContext();
  const type = text(fd, 'type');
  const price = text(fd, 'price');
  try {
    await addWishlistItem(ctx, {
      title: text(fd, 'title') ?? '',
      type: GAME_TYPES.includes(type as GameType) ? (type as GameType) : 'board',
      url: text(fd, 'url'),
      priceCents: price ? Math.round(Number(price) * 100) : null,
      notes: text(fd, 'notes'),
    });
  } catch (e) {
    return fail(e, 'Could not add that.');
  }
  revalidatePath('/wishlist');
  return { ok: true };
}

export async function removeWishlistAction(id: string) {
  const { ctx } = await requireContext();
  await removeWishlistItem(ctx, id);
  revalidatePath('/wishlist');
}

export async function acquiredAction(id: string) {
  const { ctx } = await requireContext();
  const game = await markAcquired(ctx, id);
  revalidatePath('/wishlist');
  revalidatePath('/games');
  if (game) redirect(`/games/${game.id}/edit`);
}

export async function logPlayAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const { ctx } = await requireContext();
  const minutes = Number(fd.get('durationMinutes'));
  try {
    await logPlay(ctx, {
      gameId: text(fd, 'gameId') ?? '',
      playedOn: text(fd, 'playedOn') ?? undefined,
      durationMinutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
      playerIds: await resolvePlayerNames(
        ctx,
        (text(fd, 'players') ?? '').split(',').map((n) => n.trim()),
      ),
      notes: text(fd, 'notes'),
    });
  } catch (e) {
    return fail(e, 'Could not log that play.');
  }
  revalidatePath('/plays');
  return { ok: true };
}

export async function deletePlayAction(id: string) {
  const { ctx } = await requireContext();
  await deletePlay(ctx, id);
  revalidatePath('/plays');
}
