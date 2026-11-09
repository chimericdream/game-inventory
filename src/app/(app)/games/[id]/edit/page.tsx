import { Title } from '@mantine/core';
import { notFound, redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { getGameDetail } from '@/server/data/games';

import { saveGameAction } from '../../actions';
import { GameForm, type GameFormValues } from '../../GameForm';

export const dynamic = 'force-dynamic';

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect(`/games/${id}`);
  const detail = await getGameDetail(ctx, id);
  if (!detail) notFound();
  const { game, board, rpg } = detail;
  const initial: GameFormValues = {
    title: game.title,
    type: game.type,
    description: game.description ?? '',
    notes: game.notes ?? '',
    visibility: game.visibility,
    shareable: game.shareable,
    tags: detail.tags.join(', '),
    minPlayers: board?.minPlayers,
    maxPlayers: board?.maxPlayers,
    playTimeMinutes: board?.playTimeMinutes,
    complexity: board?.complexity,
    minAge: board?.minAge,
    system: rpg?.system ?? '',
    bookKind: rpg?.bookKind ?? '',
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
      />
    </>
  );
}
