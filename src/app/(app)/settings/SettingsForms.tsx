'use client';

import { useActionState } from 'react';
import { Alert, Button, Group, PasswordInput, Select, TextInput } from '@mantine/core';

import { addLocationAction, addMemberAction } from './actions';

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMemberAction, {});
  return (
    <form action={action}>
      {state.error && (
        <Alert color="red" variant="light" mb="xs">
          {state.error}
        </Alert>
      )}
      {state.ok && (
        <Alert color="green" variant="light" mb="xs">
          Added.
        </Alert>
      )}
      <Group align="flex-end" gap="xs">
        <TextInput name="name" label="Name" required />
        <TextInput name="email" type="email" label="Email" required />
        <PasswordInput name="password" label="Password" required />
        <Select
          name="role"
          label="Profile"
          defaultValue="member"
          allowDeselect={false}
          data={[
            { value: 'member', label: 'Member' },
            { value: 'restricted', label: 'Restricted (kids)' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <Button type="submit" loading={pending}>
          Add person
        </Button>
      </Group>
    </form>
  );
}

export function AddLocationForm({ parents }: { parents: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addLocationAction, {});
  return (
    <form action={action}>
      {state.error && (
        <Alert color="red" variant="light" mb="xs">
          {state.error}
        </Alert>
      )}
      <Group align="flex-end" gap="xs">
        <TextInput name="name" label="New location" placeholder="Hall closet, shelf 2" required />
        <Select name="parentId" label="Inside (optional)" data={parents} clearable />
        <Button type="submit" loading={pending}>
          Add location
        </Button>
      </Group>
    </form>
  );
}
