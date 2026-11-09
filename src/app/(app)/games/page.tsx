import { Group, Text, Title } from '@mantine/core';

import { LinkAnchor } from '@/components/Links';
import { requireContext } from '@/server/auth/current';
import { listCatalogPage, parseCatalogFilters } from '@/server/data/catalog';
import { listLocations, listTags } from '@/server/data/lookups';

import { FilterBar } from './FilterBar';
import { GameGrid } from './GameGrid';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function pageHref(params: SearchParams, page: number) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && key !== 'page') qs.set(key, v);
  }
  if (page > 1) qs.set('page', String(page));
  const text = qs.toString();
  return text ? `/games?${text}` : '/games';
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ctx } = await requireContext();
  const params = await searchParams;
  const filters = parseCatalogFilters(params);
  const [result, tags, locations] = await Promise.all([
    listCatalogPage(ctx, filters),
    listTags(ctx),
    listLocations(ctx),
  ]);
  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={1}>Games</Title>
      </Group>
      <FilterBar
        tags={tags.map((t) => t.name)}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      />
      {result.rows.length === 0 ? (
        <Text c="dimmed">No games match.</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed" mb="xs">
            {result.total} game{result.total === 1 ? '' : 's'}
          </Text>
          <GameGrid games={result.rows} />
          <Group justify="center" mt="lg" gap="md">
            {result.page > 1 && (
              <LinkAnchor href={pageHref(params, result.page - 1)}>Previous</LinkAnchor>
            )}
            {result.hasMore && (
              <LinkAnchor href={pageHref(params, result.page + 1)}>Next</LinkAnchor>
            )}
          </Group>
        </>
      )}
    </>
  );
}
