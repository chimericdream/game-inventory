import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { listCatalog } from '@/server/data/games';
import { playStats, recentPlays } from '@/server/data/plays';

import { PlaysView } from './PlaysView';

export const dynamic = 'force-dynamic';

export default async function PlaysPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [catalog, plays, stats] = await Promise.all([
    listCatalog(ctx),
    recentPlays(ctx),
    playStats(ctx),
  ]);
  return (
    <>
      <Title order={2} mb="md">
        Play log
      </Title>
      <PlaysView
        games={catalog.map((g) => ({ value: g.id, label: g.title }))}
        plays={plays.map(({ play, title }) => ({
          id: play.id,
          title,
          playedOn: play.playedOn,
          durationMinutes: play.durationMinutes,
          playerNames: play.playerNames,
          winner: play.winner,
        }))}
        mostPlayed={stats.mostPlayed}
        neglected={stats.neglected}
      />
    </>
  );
}
