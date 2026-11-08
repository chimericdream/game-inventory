'use client';

import { Badge, Card, Group, Image, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconDice5 } from '@tabler/icons-react';
import Link from 'next/link';

import type { CatalogRow } from '@/server/data/games';

import { TYPE_LABELS, playersLabel } from './labels';

export function GameGrid({ games }: { games: CatalogRow[] }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
      {games.map((g) => {
        const meta = [
          playersLabel(g.board?.minPlayers, g.board?.maxPlayers),
          g.board?.playTimeMinutes ? `${g.board.playTimeMinutes} min` : null,
        ].filter(Boolean);
        return (
          <Card
            key={g.id}
            component={Link}
            href={`/games/${g.id}`}
            withBorder
            padding="sm"
            radius="md"
          >
            <Card.Section>
              {g.coverImage ? (
                <Image src={`/api/games/${g.id}/cover`} alt="" h={150} fit="cover" />
              ) : (
                <Group h={150} justify="center" bg="var(--mantine-color-default-hover)">
                  <IconDice5 size={40} opacity={0.4} />
                </Group>
              )}
            </Card.Section>
            <Stack gap={4} mt="sm">
              <Text fw={600} lineClamp={2}>
                {g.title}
              </Text>
              <Group gap={6}>
                <Badge variant="light" size="sm">
                  {TYPE_LABELS[g.type]}
                </Badge>
                {g.platforms.map((p) => (
                  <Badge key={p} variant="outline" size="sm">
                    {p}
                  </Badge>
                ))}
              </Group>
              {meta.length > 0 && (
                <Text size="xs" c="dimmed">
                  {meta.join(' · ')}
                </Text>
              )}
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
