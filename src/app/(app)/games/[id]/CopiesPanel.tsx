'use client';

import { useActionState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { addCopyAction, deleteCopyAction, type ActionState } from '../actions';
import { CONDITION_OPTIONS } from '../labels';

interface CopyRow {
  id: string;
  format: string;
  platform: string | null;
  condition: string;
  ownerName: string | null;
  locationName: string | null;
  priceCents: number | null;
}

interface Props {
  gameId: string;
  copies: CopyRow[];
  members: { value: string; label: string }[];
  locations: { value: string; label: string }[];
  canEdit: boolean;
}

export function CopiesPanel({ gameId, copies, members, locations, canEdit }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addCopyAction.bind(null, gameId),
    {},
  );
  return (
    <Stack>
      {copies.length === 0 && <Text c="dimmed">No copies recorded yet.</Text>}
      {copies.map((c) => (
        <Paper key={c.id} withBorder p="sm" radius="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge variant="light">{c.format}</Badge>
              {c.platform && <Badge variant="outline">{c.platform}</Badge>}
              <Text size="sm">{c.condition}</Text>
              {c.ownerName && (
                <Text size="sm" c="dimmed">
                  Owner: {c.ownerName}
                </Text>
              )}
              {c.locationName && (
                <Text size="sm" c="dimmed">
                  Location: {c.locationName}
                </Text>
              )}
              {c.priceCents !== null && (
                <Text size="sm" c="dimmed">
                  ${(c.priceCents / 100).toFixed(2)}
                </Text>
              )}
            </Group>
            {canEdit && (
              <form action={deleteCopyAction.bind(null, gameId, c.id)}>
                <ActionIcon type="submit" variant="subtle" color="red" aria-label="Delete copy">
                  <IconTrash size={16} />
                </ActionIcon>
              </form>
            )}
          </Group>
        </Paper>
      ))}

      {canEdit && (
        <form action={formAction}>
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Text fw={600}>Add a copy</Text>
              {state.error && (
                <Alert color="red" variant="light">
                  {state.error}
                </Alert>
              )}
              <Group grow align="flex-start">
                <Select
                  name="format"
                  label="Format"
                  data={['physical', 'digital']}
                  defaultValue="physical"
                  allowDeselect={false}
                />
                <TextInput name="platform" label="Platform" placeholder="Switch, PS5…" />
                <Select
                  name="condition"
                  label="Condition"
                  data={CONDITION_OPTIONS}
                  defaultValue="good"
                  allowDeselect={false}
                />
              </Group>
              <Group grow align="flex-start">
                <Select name="ownerUserId" label="Owner" data={members} clearable />
                <Select name="locationId" label="Location" data={locations} clearable />
                <NumberInput name="price" label="Price ($)" min={0} decimalScale={2} />
              </Group>
              <Group>
                <Button type="submit" loading={pending} size="sm">
                  Add copy
                </Button>
              </Group>
            </Stack>
          </Paper>
        </form>
      )}
    </Stack>
  );
}
