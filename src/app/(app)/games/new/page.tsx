import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { getGameDetail, listBaseGameOptions } from '@/server/data/games';
import { listLocationOptions, listMembers } from '@/server/data/lookups';

import { NewGameClient } from './NewGameClient';

export const dynamic = 'force-dynamic';

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ expansionOf?: string }>;
}) {
  const { expansionOf } = await searchParams;
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [members, locations, baseGames, base] = await Promise.all([
    listMembers(ctx),
    listLocationOptions(ctx),
    listBaseGameOptions(ctx),
    expansionOf ? getGameDetail(ctx, expansionOf) : Promise.resolve(null),
  ]);
  // Only a game that is not itself an expansion can be a base.
  const baseGame = base && !base.game.isExpansion ? base.game : null;
  return (
    <>
      <Title order={1} mb="md">
        {baseGame ? `Add an expansion for ${baseGame.title}` : 'Add a game'}
      </Title>
      <NewGameClient
        members={members.map((m) => ({ value: m.id, label: m.name }))}
        locations={locations}
        baseGames={baseGames}
        base={
          baseGame
            ? { id: baseGame.id, type: baseGame.type, title: baseGame.title, bggId: baseGame.bggId }
            : null
        }
      />
    </>
  );
}
