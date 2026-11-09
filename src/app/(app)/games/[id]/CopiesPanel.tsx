'use client';

import { useActionState, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowsExchange, IconPencil, IconTrash } from '@tabler/icons-react';

import { longDate, shortDate } from '@/lib/dates';

import { lendAction, returnLoanAction, type TrackState } from '../../tracking-actions';
import { addCopyAction, deleteCopyAction, updateCopyAction, type ActionState } from '../actions';
import { CONDITION_LABELS, CONDITION_OPTIONS } from '../labels';
import classes from './CopiesPanel.module.css';

interface CopyRow {
  id: string;
  format: string;
  platform: string | null;
  condition: string;
  conditionNotes: string | null;
  ownerName: string | null;
  locationName: string | null;
  ownerUserId: string | null;
  locationId: string | null;
  notes: string | null;
  priceCents: number | null;
  acquiredOn: string | null;
  loan: { id: string; borrower: string; lentOn: string; dueOn: string | null } | null;
}

interface Props {
  gameId: string;
  copies: CopyRow[];
  members: { value: string; label: string }[];
  locations: { value: string; label: string }[];
  canEdit: boolean;
}

interface Option {
  value: string;
  label: string;
}

function EditCopyForm({
  gameId,
  copy,
  members,
  locations,
  onDone,
}: {
  gameId: string;
  copy: CopyRow;
  members: Option[];
  locations: Option[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const next = await updateCopyAction(gameId, copy.id, prev, fd);
    if (next.saved) onDone();
    return next;
  }, {});
  return (
    <form action={action} className={classes.lendForm} aria-label="Edit copy">
      {state.error && (
        <Alert color="red" variant="light">
          {state.error}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Select
          name="format"
          label="Format"
          data={['physical', 'digital']}
          defaultValue={copy.format}
          allowDeselect={false}
        />
        <TextInput name="platform" label="Platform" defaultValue={copy.platform ?? ''} />
        <Select
          name="condition"
          label="Condition"
          data={CONDITION_OPTIONS}
          defaultValue={copy.condition}
          allowDeselect={false}
        />
        <TextInput
          name="conditionNotes"
          label="Condition details"
          defaultValue={copy.conditionNotes ?? ''}
        />
        <Select
          name="ownerUserId"
          label="Owner"
          data={members}
          defaultValue={copy.ownerUserId}
          clearable
        />
        <Select
          name="locationId"
          label="Location"
          data={locations}
          defaultValue={copy.locationId}
          clearable
        />
        <NumberInput
          name="price"
          label="Price ($)"
          min={0}
          decimalScale={2}
          hideControls
          defaultValue={copy.priceCents === null ? undefined : copy.priceCents / 100}
        />
        <TextInput
          name="acquiredOn"
          type="date"
          label="Acquired"
          defaultValue={copy.acquiredOn ?? ''}
        />
      </SimpleGrid>
      <TextInput name="notes" label="Notes" defaultValue={copy.notes ?? ''} />
      <Group gap="sm">
        <Button type="submit" loading={pending}>
          Save
        </Button>
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
      </Group>
    </form>
  );
}

function CopyCard({
  gameId,
  c,
  members,
  locations,
  canEdit,
}: {
  gameId: string;
  c: CopyRow;
  members: Option[];
  locations: Option[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const title = c.ownerName ? `${c.ownerName}’s copy` : 'Our copy';
  return (
    <article className={classes.card} data-copy data-lent={c.loan ? '' : undefined}>
      <header className={classes.cardHead}>
        <h3>{title}</h3>
        <span className={c.loan ? classes.lent : classes.shelf}>
          {c.loan ? 'Lent out' : 'On the shelf'}
        </span>
      </header>
      {editing ? (
        <EditCopyForm
          gameId={gameId}
          copy={c}
          members={members}
          locations={locations}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <dl className={classes.facts}>
            {c.platform && (
              <>
                <dt>Platform</dt>
                <dd>{c.platform}</dd>
              </>
            )}
            <dt>Format</dt>
            <dd>{c.format === 'digital' ? 'Digital' : 'Physical'}</dd>
            <dt>Location</dt>
            <dd>{c.locationName ?? <span className={classes.none}>Not set</span>}</dd>
            <dt>Condition</dt>
            <dd>
              {CONDITION_LABELS[c.condition] ?? c.condition}
              {c.conditionNotes && <span className={classes.none}>, {c.conditionNotes}</span>}
            </dd>
            {c.acquiredOn && (
              <>
                <dt>Acquired</dt>
                <dd>{longDate(c.acquiredOn)}</dd>
              </>
            )}
            {c.priceCents !== null && (
              <>
                <dt>Price</dt>
                <dd>${(c.priceCents / 100).toFixed(2)}</dd>
              </>
            )}
          </dl>

          {c.loan && (
            <div className={classes.loan}>
              <span className={classes.who} aria-hidden>
                {c.loan.borrower.slice(0, 1).toUpperCase()}
              </span>
              <span className={classes.loanText}>
                <b>{c.loan.borrower}</b>
                <small>
                  since {shortDate(c.loan.lentOn)}
                  {c.loan.dueOn ? ` · due ${shortDate(c.loan.dueOn)}` : ''}
                </small>
              </span>
            </div>
          )}

          {canEdit && (
            <footer className={classes.cardActions}>
              {c.loan ? (
                <form action={returnLoanAction.bind(null, c.loan.id)}>
                  <Button type="submit" variant="light" color="red">
                    Mark returned
                  </Button>
                </form>
              ) : (
                <LendForm copyId={c.id} />
              )}
              <Group gap={4} className={classes.remove}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Edit copy"
                  onClick={() => setEditing(true)}
                >
                  <IconPencil size={18} />
                </ActionIcon>
                <form action={deleteCopyAction.bind(null, gameId, c.id)}>
                  <ActionIcon type="submit" variant="subtle" color="gray" aria-label="Delete copy">
                    <IconTrash size={18} />
                  </ActionIcon>
                </form>
              </Group>
            </footer>
          )}
        </>
      )}
    </article>
  );
}

function LendForm({ copyId }: { copyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TrackState, FormData>(lendAction, {});
  if (!open) {
    return (
      <Button
        variant="light"
        leftSection={<IconArrowsExchange size={16} aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Lend out
      </Button>
    );
  }
  return (
    <form action={action} className={classes.lendForm}>
      <input type="hidden" name="copyId" value={copyId} />
      {state.error && (
        <Alert color="red" variant="light">
          {state.error}
        </Alert>
      )}
      <Group align="flex-end" gap="sm">
        <TextInput
          name="borrower"
          label="Who has it?"
          required
          data-autofocus
          style={{ flex: 1 }}
        />
        <TextInput name="dueOn" type="date" label="Due (optional)" />
      </Group>
      <Group gap="sm">
        <Button type="submit" loading={pending}>
          Lend it
        </Button>
        <Button variant="default" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </Group>
    </form>
  );
}

export function CopiesPanel({ gameId, copies, members, locations, canEdit }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addCopyAction.bind(null, gameId),
    {},
  );
  return (
    <Stack gap="md">
      {copies.length === 0 ? (
        <Text c="dimmed">No copies yet. {canEdit ? 'Add the first one below.' : ''}</Text>
      ) : (
        <div className={classes.cards}>
          {copies.map((c) => (
            <CopyCard
              key={c.id}
              gameId={gameId}
              c={c}
              members={members}
              locations={locations}
              canEdit={canEdit}
            />
          ))}
        </div>
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
                <TextInput
                  name="conditionNotes"
                  label="Condition details"
                  placeholder="Worn box corner…"
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
