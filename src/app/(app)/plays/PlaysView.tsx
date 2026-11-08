'use client';

import { useActionState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Grid,
  Group,
  List,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { deletePlayAction, logPlayAction } from '../tracking-actions';

export interface PlayRow {
  id: string;
  title: string;
  playedOn: string;
  durationMinutes: number | null;
  playerNames: string[];
  winner: string | null;
}

interface Props {
  games: { value: string; label: string }[];
  plays: PlayRow[];
  mostPlayed: { gameId: string; title: string; plays: number }[];
  neglected: { gameId: string; title: string; lastPlayed: string | null }[];
}

export function PlaysView({ games, plays, mostPlayed, neglected }: Props) {
  const [state, action, pending] = useActionState(logPlayAction, {});
  return (
    <Stack gap="lg">
      <form action={action}>
        <Paper withBorder p="md" radius="md" maw={640}>
          <Stack gap="xs">
            <Title order={5}>Log a play</Title>
            {state.error && (
              <Alert color="red" variant="light">
                {state.error}
              </Alert>
            )}
            <Select name="gameId" label="Game" data={games} searchable required />
            <Group grow align="flex-start">
              <TextInput name="playedOn" type="date" label="Date" />
              <NumberInput name="durationMinutes" label="Minutes" min={1} />
            </Group>
            <Group grow align="flex-start">
              <TextInput name="players" label="Players" description="Comma separated" />
              <TextInput name="winner" label="Winner" />
            </Group>
            <TextInput name="notes" label="Notes" />
            <Group>
              <Button type="submit" loading={pending}>
                Log play
              </Button>
            </Group>
          </Stack>
        </Paper>
      </form>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Title order={4} mb="xs">
            Recent plays
          </Title>
          {plays.length === 0 && <Text c="dimmed">No plays logged yet.</Text>}
          <Stack gap="xs">
            {plays.map((p) => (
              <Paper key={p.id} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={600}>{p.title}</Text>
                    <Text size="sm" c="dimmed">
                      {p.playedOn}
                      {p.durationMinutes ? ` · ${p.durationMinutes} min` : ''}
                      {p.playerNames.length ? ` · ${p.playerNames.join(', ')}` : ''}
                      {p.winner ? ` · won by ${p.winner}` : ''}
                    </Text>
                  </div>
                  <form action={deletePlayAction.bind(null, p.id)}>
                    <ActionIcon type="submit" variant="subtle" color="red" aria-label="Delete play">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </form>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Title order={4} mb="xs">
            Most played
          </Title>
          {mostPlayed.length === 0 ? (
            <Text c="dimmed" mb="lg">
              Nothing yet.
            </Text>
          ) : (
            <List mb="lg">
              {mostPlayed.map((g) => (
                <List.Item key={g.gameId}>
                  {g.title} ({g.plays})
                </List.Item>
              ))}
            </List>
          )}
          <Title order={4} mb="xs">
            Not played in a year
          </Title>
          <List>
            {neglected.slice(0, 25).map((g) => (
              <List.Item key={g.gameId}>
                {g.title}
                <Text span size="sm" c="dimmed">
                  {g.lastPlayed ? ` · last ${g.lastPlayed}` : ' · never'}
                </Text>
              </List.Item>
            ))}
          </List>
          {neglected.length > 25 && (
            <Text size="sm" c="dimmed" mt="xs">
              and {neglected.length - 25} more
            </Text>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
