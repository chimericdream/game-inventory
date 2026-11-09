import { Badge, Container, Group, Image, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';

import { LinkAnchor } from '@/components/Links';
import { guestGame, resolveShareLink } from '@/server/data/guest';
import { getDb } from '@/server/db/client';

import { TYPE_LABELS, playersLabel } from '../../../(app)/games/labels';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default async function GuestGamePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const db = getDb();
  const link = await resolveShareLink(db, token);
  if (!link) notFound();
  const game = await guestGame(db, link, id);
  if (!game) notFound();

  const facts = [
    playersLabel(game.board?.minPlayers, game.board?.maxPlayers),
    game.board?.playTimeMinutes ? `${game.board.playTimeMinutes} min` : null,
    game.board?.complexity ? `Complexity ${game.board.complexity}/5` : null,
    game.board?.minAge ? `Ages ${game.board.minAge}+` : null,
  ].filter(Boolean);

  return (
    <Container size="md" py="lg">
      <LinkAnchor href={`/g/${token}`} size="sm">
        ← All games
      </LinkAnchor>
      <Stack gap="md" mt="sm">
        <div>
          <Title order={1}>{game.title}</Title>
          <Group gap="xs" mt={4}>
            <Badge variant="light">{TYPE_LABELS[game.type]}</Badge>
            {game.platforms.map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
            {game.tags.map((t) => (
              <Badge key={t} variant="outline" color="gray">
                {t}
              </Badge>
            ))}
          </Group>
        </div>
        <Group align="flex-start" wrap="nowrap">
          {game.coverImage && (
            <Image src={`/g/${token}/cover/${game.id}`} alt="" w={220} radius="md" />
          )}
          <Stack gap="xs">
            {facts.length > 0 && <Text>{facts.join(' · ')}</Text>}
            {game.description && <Text>{game.description}</Text>}
            {game.notes && <Text c="dimmed">{game.notes}</Text>}
            {game.locations.length > 0 && (
              <Text size="sm" c="dimmed">
                Kept in: {game.locations.join(', ')}
              </Text>
            )}
          </Stack>
        </Group>
      </Stack>
    </Container>
  );
}
