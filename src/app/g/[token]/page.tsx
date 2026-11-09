import { Container, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';

import { getDb } from '@/server/db/client';
import { guestCatalog, resolveShareLink } from '@/server/data/guest';

import { GameGrid } from '../../(app)/games/GameGrid';
import { GuestSearch } from './GuestSearch';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default async function GuestHome({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { token } = await params;
  const { q } = await searchParams;
  const db = getDb();
  const link = await resolveShareLink(db, token);
  if (!link) notFound();
  const games = await guestCatalog(db, link, { search: q });
  return (
    <Container size="lg" py="lg">
      <Title order={1}>Game Library</Title>
      <Text c="dimmed" mb="md">
        Shared with you · {link.label}
      </Text>
      <GuestSearch />
      {games.length === 0 ? (
        <Text c="dimmed">No games to show.</Text>
      ) : (
        <GameGrid
          games={games}
          linkBase={`/g/${token}`}
          coverPrefix={`/g/${token}/cover/`}
          coverSuffix=""
        />
      )}
    </Container>
  );
}
