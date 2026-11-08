import { Group, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { LinkButton } from '@/components/Links';
import { requireContext } from '@/server/auth/current';
import { GAME_TYPES, listCatalog, type CatalogFilters, type GameType } from '@/server/data/games';
import { listLocations, listTags } from '@/server/data/lookups';

import { FilterBar } from './FilterBar';
import { GameGrid } from './GameGrid';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const positiveInt = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

function parseFilters(sp: SearchParams): CatalogFilters {
  const type = first(sp.type);
  return {
    search: first(sp.q),
    type: GAME_TYPES.includes(type as GameType) ? (type as GameType) : undefined,
    players: positiveInt(first(sp.players)),
    maxMinutes: positiveInt(first(sp.maxMinutes)),
    tag: first(sp.tag),
    locationId: first(sp.location),
  };
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ctx } = await requireContext();
  const filters = parseFilters(await searchParams);
  const [games, tags, locations] = await Promise.all([
    listCatalog(ctx, filters),
    listTags(ctx),
    listLocations(ctx),
  ]);
  const canEdit = ctx.viewer.role !== 'restricted';
  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Games</Title>
        {canEdit && (
          <LinkButton href="/games/new" leftSection={<IconPlus size={16} />}>
            Add game
          </LinkButton>
        )}
      </Group>
      <FilterBar
        tags={tags.map((t) => t.name)}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      />
      {games.length === 0 ? (
        <Text c="dimmed">No games match.</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed" mb="xs">
            {games.length} game{games.length === 1 ? '' : 's'}
          </Text>
          <GameGrid games={games} />
        </>
      )}
    </>
  );
}
