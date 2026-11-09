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
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { addCopyAction, deleteCopyAction, type ActionState } from '../actions';
import { CONDITION_OPTIONS } from '../labels';
import classes from './CopiesPanel.module.css';

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

const Dash = () => <span className={classes.none}>&mdash;</span>;

export function CopiesPanel({ gameId, copies, members, locations, canEdit }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addCopyAction.bind(null, gameId),
    {},
  );
  return (
    <Stack gap="md">
      {copies.length === 0 ? (
        <Text c="dimmed">No copies recorded yet.</Text>
      ) : (
        <Table.ScrollContainer minWidth={520}>
          <Table className={classes.table} verticalSpacing="sm" horizontalSpacing="sm">
            <Table.Thead className={classes.head}>
              <Table.Tr>
                <Table.Th>Format</Table.Th>
                <Table.Th>Condition</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Location</Table.Th>
                <Table.Th ta="right">Price</Table.Th>
                {canEdit && <Table.Th w={44} aria-label="Actions" />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {copies.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td className={classes.cell}>
                    <Group gap={6} wrap="nowrap">
                      <Badge>{c.format}</Badge>
                      {c.platform && <Badge variant="default">{c.platform}</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td className={`${classes.cell} ${classes.condition}`}>
                    {c.condition}
                  </Table.Td>
                  <Table.Td className={classes.cell}>{c.ownerName ?? <Dash />}</Table.Td>
                  <Table.Td className={classes.cell}>{c.locationName ?? <Dash />}</Table.Td>
                  <Table.Td className={classes.cell} ta="right">
                    {c.priceCents !== null ? `$${(c.priceCents / 100).toFixed(2)}` : <Dash />}
                  </Table.Td>
                  {canEdit && (
                    <Table.Td ta="right">
                      <form action={deleteCopyAction.bind(null, gameId, c.id)}>
                        <ActionIcon
                          type="submit"
                          variant="subtle"
                          color="red"
                          aria-label="Delete copy"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </form>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {canEdit && (
        <form action={formAction}>
          <Paper withBorder p="md">
            <Stack gap="sm">
              <Title order={3} size="h5">
                Add a copy
              </Title>
              {state.error && (
                <Alert color="red" variant="light">
                  {state.error}
                </Alert>
              )}
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
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
                <Select name="ownerUserId" label="Owner" data={members} clearable />
                <Select name="locationId" label="Location" data={locations} clearable />
                <NumberInput name="price" label="Price ($)" min={0} decimalScale={2} hideControls />
              </SimpleGrid>
              <Group>
                <Button type="submit" loading={pending}>
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
