import { Title } from '@mantine/core';
import { notFound, redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { getGameDetail, listBaseGameOptions } from '@/server/data/games';

import { saveGameAction } from '../../actions';
import { GameForm, type GameFormValues } from '../../GameForm';

export const dynamic = 'force-dynamic';

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect(`/games/${id}`);
  const detail = await getGameDetail(ctx, id);
  if (!detail) notFound();
  const { game, board, rpg, puzzle } = detail;
  const initial: GameFormValues = {
    title: game.title,
    type: game.type,
    description: game.description ?? '',
    publisher: game.publisher ?? '',
    notes: game.notes ?? '',
    visibility: game.visibility,
    shareable: game.shareable,
    tags: detail.tags.join(', '),
    isExpansion: game.isExpansion,
    baseGameId: game.baseGameId ?? '',
    standalone: game.standalone,
    minPlayers: board?.minPlayers,
    maxPlayers: board?.maxPlayers,
    playTimeMinutes: board?.playTimeMinutes,
    complexity: board?.complexity,
    minAge: board?.minAge,
    system: rpg?.system ?? '',
    bookKind: rpg?.bookKind ?? '',
    pieceCount: puzzle?.pieceCount,
  };
  return (
    <>
      <Title order={1} mb="md">
        Edit {game.title}
      </Title>
      <GameForm
        action={saveGameAction.bind(null, id)}
        initial={initial}
        cancelHref={`/games/${id}`}
        baseGames={detail.expansions.length > 0 ? [] : await listBaseGameOptions(ctx, id)}
      />
    </>
  );
}
