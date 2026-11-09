import { Badge, Button, Flex, Group, Image, Stack, Text, Title } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { notFound } from 'next/navigation';

import { LinkButton } from '@/components/Links';
import { requireContext } from '@/server/auth/current';
import { getGameDetail } from '@/server/data/games';
import { listLocations, listMembers } from '@/server/data/lookups';

import { deleteGameAction } from '../actions';
import { TYPE_LABELS, playersLabel } from '../labels';
import { CopiesPanel } from './CopiesPanel';

export const dynamic = 'force-dynamic';

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireContext();
  const detail = await getGameDetail(ctx, id);
  if (!detail) notFound();
  const { game, board, rpg } = detail;
  const canEdit = ctx.viewer.role !== 'restricted';

  const [members, locations] = await Promise.all([listMembers(ctx), listLocations(ctx)]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  const facts = [
    playersLabel(board?.minPlayers, board?.maxPlayers),
    board?.playTimeMinutes ? `${board.playTimeMinutes} min` : null,
    board?.complexity ? `Complexity ${board.complexity}/5` : null,
    board?.minAge ? `Ages ${board.minAge}+` : null,
    rpg?.system,
    rpg?.bookKind,
  ].filter(Boolean);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>{game.title}</Title>
          <Group gap="xs" mt={4}>
            <Badge variant="light">{TYPE_LABELS[game.type]}</Badge>
            {detail.tags.map((t) => (
              <Badge key={t} variant="default">
                {t}
              </Badge>
            ))}
          </Group>
        </div>
        {canEdit && (
          <Group>
            <LinkButton
              href={`/games/${id}/edit`}
              variant="default"
              leftSection={<IconPencil size={16} />}
            >
              Edit
            </LinkButton>
            <form action={deleteGameAction.bind(null, id)}>
              <Button type="submit" color="red" variant="default" c="red.8">
                Delete
              </Button>
            </form>
          </Group>
        )}
      </Group>

      <Flex gap="xl" direction={{ base: 'column', sm: 'row' }} align="flex-start">
        {game.coverImage && (
          <Image
            src={`/api/games/${id}/cover`}
            alt=""
            w={{ base: '100%', sm: 240 }}
            maw={{ base: 320, sm: 240 }}
            radius="md"
            style={{ flex: 'none' }}
          />
        )}
        <Stack gap="lg" style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Stack gap="xs">
            {facts.length > 0 && <Text>{facts.join(' · ')}</Text>}
            {game.description && <Text maw={640}>{game.description}</Text>}
            {canEdit && game.notes && (
              <Text c="dimmed" maw={640}>
                {game.notes}
              </Text>
            )}
          </Stack>

          <div>
            <Title order={2} size="h4" mb="xs">
              Copies
            </Title>
            <CopiesPanel
              gameId={id}
              canEdit={canEdit}
              members={members.map((m) => ({ value: m.id, label: m.name }))}
              locations={locations.map((l) => ({ value: l.id, label: l.name }))}
              copies={detail.copies.map((c) => ({
                id: c.id,
                format: c.format,
                platform: c.platform,
                condition: c.condition,
                ownerName: c.ownerUserId ? (memberName.get(c.ownerUserId) ?? null) : null,
                locationName: c.locationName,
                priceCents: c.priceCents,
              }))}
            />
          </div>
        </Stack>
      </Flex>
    </Stack>
  );
}
