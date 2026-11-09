'use client';

import { useActionState, useState } from 'react';
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

import { CoverThumb } from '@/components/CoverThumb';

import { deletePlayAction, logPlayAction } from '../tracking-actions';

export interface PlayRow {
  id: string;
  gameId: string;
  hasCover: boolean;
  title: string;
  playedOn: string;
  durationMinutes: number | null;
  playerNames: string[];
}

interface Props {
  games: { value: string; label: string }[];
  plays: PlayRow[];
  mostPlayed: { gameId: string; title: string; plays: number }[];
  neglected: { gameId: string; title: string; lastPlayed: string | null }[];
}

const NEGLECT_PREVIEW = 5;

export function PlaysView({ games, plays, mostPlayed, neglected }: Props) {
  const [state, action, pending] = useActionState(logPlayAction, {});
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? neglected : neglected.slice(0, NEGLECT_PREVIEW);
  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="lg">
          <form action={action}>
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Title order={2} size="h5">
                  Log a play
                </Title>
                {state.error && (
                  <Alert color="red" variant="light">
                    {state.error}
                  </Alert>
                )}
                <Select name="gameId" label="Game" data={games} searchable required />
                <Group grow align="flex-start">
                  <TextInput name="playedOn" type="date" label="Date" />
                  <NumberInput name="durationMinutes" label="Minutes" min={1} hideControls />
                </Group>
                <TextInput name="players" label="Players" description="Comma separated" />
                <TextInput name="notes" label="Notes" />
                <Group>
                  <Button type="submit" loading={pending}>
                    Log play
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </form>

          <div>
            <Title order={2} size="h4" mb="xs">
              Recent plays
            </Title>
            {plays.length === 0 && <Text c="dimmed">No plays logged yet.</Text>}
            <Stack gap="xs">
              {plays.map((p) => (
                <Paper key={p.id} withBorder p="sm">
                  <Group justify="space-between" wrap="nowrap" align="center">
                    <CoverThumb gameId={p.gameId} hasCover={p.hasCover} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600}>{p.title}</Text>
                      <Text size="sm" c="dimmed">
                        {p.playedOn}
                        {p.durationMinutes ? ` · ${p.durationMinutes} min` : ''}
                        {p.playerNames.length ? ` · ${p.playerNames.join(', ')}` : ''}
                      </Text>
                    </div>
                    <form action={deletePlayAction.bind(null, p.id)}>
                      <ActionIcon
                        type="submit"
                        variant="subtle"
                        color="gray"
                        aria-label="Delete play"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </form>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </div>
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="lg">
          <div>
            <Title order={2} size="h4" mb="xs">
              Most played
            </Title>
            {mostPlayed.length === 0 ? (
              <Text c="dimmed">Nothing yet.</Text>
            ) : (
              <List>
                {mostPlayed.map((g) => (
                  <List.Item key={g.gameId}>
                    {g.title} ({g.plays})
                  </List.Item>
                ))}
              </List>
            )}
          </div>
          <div>
            <Title order={2} size="h4" mb="xs">
              Not played in a year
            </Title>
            <List>
              {shown.map((g) => (
                <List.Item key={g.gameId}>
                  {g.title}
                  <Text span size="sm" c="dimmed">
                    {g.lastPlayed ? ` · last ${g.lastPlayed}` : ' · never'}
                  </Text>
                </List.Item>
              ))}
            </List>
            {neglected.length > NEGLECT_PREVIEW && (
              <Button
                variant="subtle"
                size="compact-sm"
                mt="xs"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${neglected.length}`}
              </Button>
            )}
          </div>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
