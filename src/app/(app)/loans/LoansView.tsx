'use client';

import { useActionState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

import { lendAction, returnLoanAction } from '../tracking-actions';

export interface LoanRow {
  id: string;
  title: string;
  platform: string | null;
  borrower: string;
  lentOn: string;
  dueOn: string | null;
  overdue: boolean;
}

interface Props {
  loans: LoanRow[];
  copies: { value: string; label: string }[];
}

export function LoansView({ loans, copies }: Props) {
  const [state, action, pending] = useActionState(lendAction, {});
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        {loans.length === 0 && <Text c="dimmed">Nothing is out on loan.</Text>}
        {loans.map((l) => (
          <Paper key={l.id} withBorder p="sm" radius="md">
            <Group justify="space-between">
              <div>
                <Group gap="xs">
                  <Text fw={600}>{l.title}</Text>
                  {l.platform && <Badge variant="outline">{l.platform}</Badge>}
                  {l.overdue && <Badge color="red">Overdue</Badge>}
                </Group>
                <Text size="sm" c="dimmed">
                  With {l.borrower} since {l.lentOn}
                  {l.dueOn ? ` · due ${l.dueOn}` : ''}
                </Text>
              </div>
              <form action={returnLoanAction.bind(null, l.id)}>
                <Button type="submit" variant="light" size="compact-sm">
                  Mark returned
                </Button>
              </form>
            </Group>
          </Paper>
        ))}
      </Stack>

      <form action={action}>
        <Paper withBorder p="md" radius="md" maw={640}>
          <Stack gap="xs">
            <Title order={2} size="h5">
              Lend a game
            </Title>
            {state.error && (
              <Alert color="red" variant="light">
                {state.error}
              </Alert>
            )}
            <Select name="copyId" label="Game" data={copies} searchable required />
            <Group grow align="flex-start">
              <TextInput name="borrower" label="Borrower" required />
              <TextInput name="dueOn" type="date" label="Due (optional)" />
            </Group>
            <Group>
              <Button type="submit" loading={pending}>
                Lend
              </Button>
            </Group>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
