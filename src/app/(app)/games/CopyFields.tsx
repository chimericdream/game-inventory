'use client';

import { NumberInput, Select, Stack, TextInput } from '@mantine/core';

import { CONDITION_OPTIONS } from './labels';

export interface Option {
  value: string;
  label: string;
}

/** Form-field name prefix, so copy fields do not collide with the game's own (e.g. `notes`). */
export const COPY_PREFIX = 'copy.';

const n = (field: string) => `${COPY_PREFIX}${field}`;

/** The details of a copy, for forms that create one alongside something else (a new game). */
export function CopyFields({ members, locations }: { members: Option[]; locations: Option[] }) {
  return (
    <Stack gap="sm">
      <Select
        name={n('format')}
        label="Format"
        data={['physical', 'digital']}
        defaultValue="physical"
        allowDeselect={false}
      />
      <TextInput name={n('platform')} label="Platform" placeholder="Switch, PS5…" />
      <Select
        name={n('condition')}
        label="Condition"
        data={CONDITION_OPTIONS}
        defaultValue="good"
        allowDeselect={false}
      />
      <TextInput
        name={n('conditionNotes')}
        label="Condition details"
        placeholder="Worn box corner…"
      />
      <Select name={n('ownerUserId')} label="Owner" data={members} clearable />
      <Select name={n('locationId')} label="Location" data={locations} clearable />
      <NumberInput name={n('price')} label="Price ($)" min={0} decimalScale={2} hideControls />
      <TextInput name={n('acquiredOn')} type="date" label="Acquired" />
      <TextInput name={n('notes')} label="Copy notes" />
    </Stack>
  );
}
