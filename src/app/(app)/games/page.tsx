import { Button, Group, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

import { requireContext } from '@/server/auth/current';
import { listCatalog } from '@/server/data/games';

import { GameGrid } from './GameGrid';

export const dynamic = 'force-dynamic';

export default async function GamesPage() {
  const { ctx } = await requireContext();
  const games = await listCatalog(ctx);
  const canEdit = ctx.viewer.role !== 'restricted';
  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Games</Title>
        {canEdit && (
          <Button component={Link} href="/games/new" leftSection={<IconPlus size={16} />}>
            Add game
          </Button>
        )}
      </Group>
      {games.length === 0 ? <Text c="dimmed">No games yet.</Text> : <GameGrid games={games} />}
    </>
  );
}
