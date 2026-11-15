'use client';

import { useActionState, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import { ConfirmDelete } from '@/components/ConfirmDelete';
import { longDate } from '@/lib/dates';

import {
  addAccessoryAction,
  deleteAccessoryAction,
  updateAccessoryAction,
  type ActionState,
} from '../actions';
import { ACCESSORY_KIND_LABELS, ACCESSORY_KIND_OPTIONS } from '../labels';
import classes from './Accessories.module.css';

export interface AccessoryRow {
  id: string;
  name: string;
  kind: string;
  quantity: number;
  locationId: string | null;
  /** Null when it is kept with the copy. */
  locationName: string | null;
  acquiredOn: string | null;
  priceCents: number | null;
  notes: string | null;
}

interface Option {
  value: string;
  label: string;
}

/** "Playmat (Hall closet)" lines for the things that would not leave with the box. */
export function keptElsewhere(accessories: AccessoryRow[]) {
  return accessories
    .filter((a) => a.locationName)
    .map((a) => `${a.name} (${a.locationName})`)
    .join(', ');
}

function AccessoryForm({
  gameId,
  copyId,
  accessory,
  locations,
  onDone,
}: {
  gameId: string;
  copyId: string;
  accessory?: AccessoryRow;
  locations: Option[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const next = accessory
      ? await updateAccessoryAction(gameId, accessory.id, prev, fd)
      : await addAccessoryAction(gameId, copyId, prev, fd);
    if (next.saved) onDone();
    return next;
  }, {});
  return (
    <form
      action={action}
      className={classes.form}
      aria-label={accessory ? `Edit ${accessory.name}` : 'Add an accessory'}
    >
      {state.error && (
        <Alert color="red" variant="light">
          {state.error}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput
          name="name"
          label="Name"
          placeholder="Neoprene playmat"
          required
          data-autofocus
          defaultValue={accessory?.name ?? ''}
        />
        <Select
          name="kind"
          label="Kind"
          data={ACCESSORY_KIND_OPTIONS}
          defaultValue={accessory?.kind ?? 'other'}
          allowDeselect={false}
        />
        <NumberInput
          name="quantity"
          label="How many"
          min={1}
          max={9999}
          allowDecimal={false}
          defaultValue={accessory?.quantity ?? 1}
        />
        <Select
          name="locationId"
          label="Stored"
          placeholder="With the box"
          description="Leave empty when it lives in the box."
          data={locations}
          defaultValue={accessory?.locationId ?? null}
          clearable
          searchable
        />
        <NumberInput
          name="price"
          label="Price ($)"
          min={0}
          decimalScale={2}
          hideControls
          defaultValue={
            accessory?.priceCents === null || accessory?.priceCents === undefined
              ? undefined
              : accessory.priceCents / 100
          }
        />
        <TextInput
          name="acquiredOn"
          type="date"
          label="Acquired"
          defaultValue={accessory?.acquiredOn ?? ''}
        />
      </SimpleGrid>
      <TextInput name="notes" label="Notes" defaultValue={accessory?.notes ?? ''} />
      <Group gap="sm">
        <Button type="submit" loading={pending}>
          {accessory ? 'Save' : 'Add accessory'}
        </Button>
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
      </Group>
    </form>
  );
}

function AccessoryItem({
  gameId,
  copyId,
  a,
  locations,
  canEdit,
}: {
  gameId: string;
  copyId: string;
  a: AccessoryRow;
  locations: Option[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className={classes.item}>
        <AccessoryForm
          gameId={gameId}
          copyId={copyId}
          accessory={a}
          locations={locations}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }
  const details = [
    ACCESSORY_KIND_LABELS[a.kind] ?? a.kind,
    a.acquiredOn ? `acquired ${longDate(a.acquiredOn)}` : null,
    a.priceCents !== null ? `$${(a.priceCents / 100).toFixed(2)}` : null,
  ].filter(Boolean);
  return (
    <li className={classes.item} data-accessory>
      <div className={classes.row}>
        <div className={classes.body}>
          <span className={classes.name}>
            {a.name}
            {a.quantity > 1 && <span className={classes.qty}> ×{a.quantity}</span>}
          </span>
          <span className={classes.meta}>{details.join(' · ')}</span>
          <span className={a.locationName ? classes.apart : classes.withBox}>
            {a.locationName ? `Stored in ${a.locationName}` : 'With the box'}
          </span>
          {a.notes && <span className={classes.meta}>{a.notes}</span>}
        </div>
        {canEdit && (
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Edit ${a.name}`}
              onClick={() => setEditing(true)}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ConfirmDelete
              title={`Delete ${a.name}?`}
              triggerLabel={`Delete ${a.name}`}
              triggerIcon={<IconTrash size={16} />}
              action={deleteAccessoryAction.bind(null, gameId, a.id)}
            >
              <Text size="sm">
                It moves to the trash. You can restore it from Settings → Trash.
              </Text>
            </ConfirmDelete>
          </Group>
        )}
      </div>
    </li>
  );
}

/** The accessories that belong to one copy, inside its card. */
export function Accessories({
  gameId,
  copyId,
  accessories,
  locations,
  canEdit,
}: {
  gameId: string;
  copyId: string;
  accessories: AccessoryRow[];
  locations: Option[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  if (accessories.length === 0 && !canEdit) return null;
  return (
    <section className={classes.section} aria-label="Accessories">
      <h4 className={classes.heading}>Accessories</h4>
      {accessories.length > 0 && (
        <ul className={classes.list}>
          {accessories.map((a) => (
            <AccessoryItem
              key={a.id}
              gameId={gameId}
              copyId={copyId}
              a={a}
              locations={locations}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
      {canEdit &&
        (adding ? (
          <AccessoryForm
            gameId={gameId}
            copyId={copyId}
            locations={locations}
            onDone={() => setAdding(false)}
          />
        ) : (
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconPlus size={14} aria-hidden />}
            onClick={() => setAdding(true)}
            className={classes.add}
          >
            Add accessory
          </Button>
        ))}
    </section>
  );
}
