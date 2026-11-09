'use client';

import { useActionState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

import { TYPE_OPTIONS } from '../games/labels';
import { acquiredAction, addWishlistAction, removeWishlistAction } from '../tracking-actions';

export interface WishRow {
  id: string;
  title: string;
  type: string;
  url: string | null;
  priceCents: number | null;
  notes: string | null;
}

export function WishlistView({ items }: { items: WishRow[] }) {
  const [state, action, pending] = useActionState(addWishlistAction, {});
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        {items.length === 0 && <Text c="dimmed">The wishlist is empty.</Text>}
        {items.map((i) => (
          <Paper key={i.id} withBorder p="sm" radius="md">
            <Group justify="space-between">
              <div>
                <Group gap="xs">
                  {i.url ? (
                    <Anchor href={i.url} target="_blank" rel="noopener noreferrer" fw={600}>
                      {i.title}
                    </Anchor>
                  ) : (
                    <Text fw={600}>{i.title}</Text>
                  )}
                  <Badge variant="light">{i.type}</Badge>
                  {i.priceCents !== null && (
                    <Text size="sm">${(i.priceCents / 100).toFixed(2)}</Text>
                  )}
                </Group>
                {i.notes && (
                  <Text size="sm" c="dimmed">
                    {i.notes}
                  </Text>
                )}
              </div>
              <Group gap="xs">
                <form action={acquiredAction.bind(null, i.id)}>
                  <Button type="submit" variant="light" size="compact-sm">
                    We got it
                  </Button>
                </form>
                <form action={removeWishlistAction.bind(null, i.id)}>
                  <Button type="submit" variant="subtle" color="red" size="compact-sm">
                    Remove
                  </Button>
                </form>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>

      <form action={action}>
        <Paper withBorder p="md" radius="md" maw={640}>
          <Stack gap="xs">
            <Title order={2} size="h5">
              Add to the wishlist
            </Title>
            {state.error && (
              <Alert color="red" variant="light">
                {state.error}
              </Alert>
            )}
            <Group grow align="flex-start">
              <TextInput name="title" label="Title" required />
              <Select
                name="type"
                label="Type"
                data={TYPE_OPTIONS}
                defaultValue="board"
                allowDeselect={false}
              />
            </Group>
            <Group grow align="flex-start">
              <TextInput name="url" label="Link" placeholder="https://" />
              <NumberInput name="price" label="Price ($)" min={0} decimalScale={2} />
            </Group>
            <TextInput name="notes" label="Notes" />
            <Group>
              <Button type="submit" loading={pending}>
                Add
              </Button>
            </Group>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
