'use client';

import { useActionState, useState } from 'react';
import {
  Alert,
  Button,
  FileInput,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  TextInput,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import Link from 'next/link';

import type { ActionState } from './actions';
import { CopyFields, type Option } from './CopyFields';
import classes from './GameForm.module.css';
import { TYPE_OPTIONS, VISIBILITY_OPTIONS } from './labels';

export interface GameFormValues {
  title: string;
  type: string;
  description: string;
  publisher: string;
  notes: string;
  visibility: string;
  shareable: boolean;
  tags: string;
  isExpansion: boolean;
  baseGameId: string;
  standalone: boolean;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMinutes?: number | null;
  complexity?: number | null;
  minAge?: number | null;
  system: string;
  bookKind: string;
  pieceCount?: number | null;
  /** Cover from a BGG lookup; the server downloads it on save unless a file is uploaded. */
  bggImageUrl?: string | null;
  /** BoardGameGeek id from a lookup, saved with a new game. */
  bggId?: number | null;
}

export const EMPTY_GAME: GameFormValues = {
  title: '',
  type: 'board',
  description: '',
  publisher: '',
  notes: '',
  visibility: 'normal',
  // On for new games: sharing is the common case, and a guest link still needs its own allowlist.
  shareable: true,
  tags: '',
  isExpansion: false,
  baseGameId: '',
  standalone: false,
  system: '',
  bookKind: '',
};

interface Props {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: GameFormValues;
  cancelHref: string;
  /** Offer to add a copy to the collection along with the game (new games only). */
  copyOptions?: { members: Option[]; locations: Option[] };
  /** Games an expansion can belong to. */
  baseGames?: Option[];
}

export function GameForm({
  action,
  initial = EMPTY_GAME,
  cancelHref,
  copyOptions,
  baseGames = [],
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [addCopy, setAddCopy] = useState(true);
  const [type, setType] = useState(initial.type);
  const [isExpansion, setIsExpansion] = useState(initial.isExpansion);
  const isBoard = type === 'board' || type === 'card';

  return (
    <form action={formAction}>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            {state.error && (
              <Alert color="red" variant="light">
                {state.error}
              </Alert>
            )}
            <TextInput name="title" label="Title" defaultValue={initial.title} required />
            <Select
              name="type"
              label="Type"
              data={TYPE_OPTIONS}
              value={type}
              onChange={(v) => setType(v ?? 'board')}
              allowDeselect={false}
            />
            <TextInput name="publisher" label="Publisher" defaultValue={initial.publisher} />
            <Switch
              name="isExpansion"
              label="This is an expansion"
              description="Expansions are listed on their base game and found by search."
              checked={isExpansion}
              onChange={(e) => setIsExpansion(e.currentTarget.checked)}
            />
            {isExpansion && (
              <>
                <Select
                  name="baseGameId"
                  label="Base game"
                  placeholder="Search for the game this expands"
                  data={baseGames}
                  defaultValue={initial.baseGameId || null}
                  searchable
                  clearable
                />
                <Switch
                  name="standalone"
                  label="Standalone"
                  description="Can be played on its own, without the base game."
                  defaultChecked={initial.standalone}
                />
              </>
            )}

            {isBoard && (
              <>
                <Group grow align="flex-start">
                  <NumberInput
                    name="minPlayers"
                    label="Min players"
                    min={1}
                    defaultValue={initial.minPlayers ?? ''}
                  />
                  <NumberInput
                    name="maxPlayers"
                    label="Max players"
                    min={1}
                    defaultValue={initial.maxPlayers ?? ''}
                  />
                </Group>
                <Group grow align="flex-start">
                  <NumberInput
                    name="playTimeMinutes"
                    label="Play time (min)"
                    min={1}
                    defaultValue={initial.playTimeMinutes ?? ''}
                  />
                  <NumberInput
                    name="complexity"
                    label="Complexity (1–5)"
                    min={1}
                    max={5}
                    defaultValue={initial.complexity ?? ''}
                  />
                  <NumberInput
                    name="minAge"
                    label="Min age"
                    min={1}
                    defaultValue={initial.minAge ?? ''}
                  />
                </Group>
              </>
            )}
            {type === 'rpg' && (
              <Group grow align="flex-start">
                <TextInput
                  name="system"
                  label="System"
                  placeholder="D&D 5e"
                  defaultValue={initial.system}
                />
                <TextInput
                  name="bookKind"
                  label="Book kind"
                  placeholder="Core rulebook"
                  defaultValue={initial.bookKind}
                />
              </Group>
            )}

            {type === 'puzzle' && (
              <NumberInput
                name="pieceCount"
                label="Pieces"
                placeholder="1000"
                min={1}
                defaultValue={initial.pieceCount ?? ''}
              />
            )}

            <TextInput
              name="tags"
              label="Tags"
              description="Comma separated"
              defaultValue={initial.tags}
            />
            <Textarea
              name="description"
              label="Description"
              autosize
              minRows={2}
              defaultValue={initial.description}
            />
            <Textarea
              name="notes"
              label="Notes"
              autosize
              minRows={2}
              defaultValue={initial.notes}
            />

            <Group className={classes.saveBar}>
              <Button type="submit" loading={pending}>
                Save
              </Button>
              <Button component={Link} href={cancelHref} variant="default">
                Cancel
              </Button>
            </Group>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="md">
            <Stack>
              <Title order={2} size="h5">
                Cover and visibility
              </Title>
              {initial.bggId && <input type="hidden" name="bggId" value={initial.bggId} />}
              {initial.bggImageUrl && (
                <>
                  <input type="hidden" name="bggImageUrl" value={initial.bggImageUrl} />
                  <Text size="sm" data-bgg-cover>
                    The BoardGameGeek cover will be saved with this game. Choose a file below to use
                    your own instead.
                  </Text>
                </>
              )}
              <FileInput
                name="cover"
                label="Cover image"
                accept="image/jpeg,image/png,image/webp"
                clearable
              />
              <Select
                name="visibility"
                label="Visibility in this household"
                data={VISIBILITY_OPTIONS}
                defaultValue={initial.visibility}
                allowDeselect={false}
              />
              <Switch
                name="shareable"
                label="Allow on guest links"
                description="Guest links only ever show games marked as allowed."
                defaultChecked={initial.shareable}
              />
            </Stack>
          </Paper>
          {copyOptions && (
            <Paper withBorder p="md" mt="md">
              <Stack>
                <Title order={2} size="h5">
                  Our copy
                </Title>
                <Switch
                  name="addCopy"
                  label="Add a copy to our collection"
                  description="Turn off for games we play but don't own."
                  checked={addCopy}
                  onChange={(e) => setAddCopy(e.currentTarget.checked)}
                />
                {addCopy && (
                  <CopyFields members={copyOptions.members} locations={copyOptions.locations} />
                )}
              </Stack>
            </Paper>
          )}
        </Grid.Col>
      </Grid>
    </form>
  );
}
