'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Group, PasswordInput, Select, Stack, TextInput } from '@mantine/core';

import {
  addLocationAction,
  addMemberAction,
  deleteLocationAction,
  deletePlayerAction,
  linkPlayerAction,
  mergePlayersAction,
  renamePlayerAction,
  type SettingsState,
} from './actions';
import classes from './Settings.module.css';

interface Choice {
  value: string;
  label: string;
}

export function AddMemberForm({ earlierPlayers }: { earlierPlayers: Choice[] }) {
  const [state, action, pending] = useActionState(addMemberAction, {});
  return (
    <form action={action} className={classes.card}>
      <h3>Add a person</h3>
      <Stack gap="sm">
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        {state.ok && (
          <Alert color="green" variant="light">
            {state.message ?? 'Added.'}
          </Alert>
        )}
        <Group align="flex-end" gap="sm">
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
        </Group>
        {earlierPlayers.length > 0 && (
          <Select
            name="linkPlayerId"
            label="Is this someone who has played before?"
            description="Their earlier plays will count for the new account."
            placeholder="No, they are new"
            data={earlierPlayers}
            clearable
            searchable
          />
        )}
        <Button type="submit" loading={pending} w="fit-content">
          Add person
        </Button>
      </Stack>
    </form>
  );
}

export function AddLocationForm({ parents }: { parents: Choice[] }) {
  const [state, action, pending] = useActionState(addLocationAction, {});
  return (
    <form action={action} className={classes.card}>
      <h3>Add a place</h3>
      <Stack gap="sm">
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        <Group align="flex-end" gap="sm">
          <TextInput name="name" label="New location" placeholder="Hall closet, shelf 2" required />
          <Select name="parentId" label="Inside (optional)" data={parents} clearable />
        </Group>
        <Button type="submit" loading={pending} w="fit-content">
          Add location
        </Button>
      </Stack>
    </form>
  );
}

/** Remove a place. The server refuses while it holds copies, and says so here. */
export function DeleteLocationButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    deleteLocationAction.bind(null, id),
    {},
  );
  return (
    <form action={action} className={classes.inlineForm}>
      <Button type="submit" variant="subtle" color="red" size="compact-sm" loading={pending}>
        Remove
        <span className={classes.srOnly}> {name}</span>
      </Button>
      {state.error && (
        <span role="alert" className={classes.problem}>
          {name}: {state.error}
        </span>
      )}
    </form>
  );
}

/**
 * Admin tools for one person who plays but has no account: rename, link to an account (their
 * plays then count for it), merge a duplicate into someone else, or remove them.
 */
export function PlayerAdmin({
  playerId,
  name,
  plays,
  users,
  others,
}: {
  playerId: string;
  name: string;
  plays: number;
  users: Choice[];
  others: Choice[];
}) {
  // Whichever of the four forms ran last decides what the message area says.
  const [result, setResult] = useState<SettingsState>({});
  const track =
    (run: (prev: SettingsState, fd: FormData) => Promise<SettingsState>) =>
    async (prev: SettingsState, fd: FormData) => {
      const next = await run(prev, fd);
      setResult(next);
      return next;
    };
  const [, renameAction, renaming] = useActionState<SettingsState, FormData>(
    track(renamePlayerAction.bind(null, playerId)),
    {},
  );
  const [, linkAction, linking] = useActionState<SettingsState, FormData>(
    track(linkPlayerAction.bind(null, playerId)),
    {},
  );
  const [, mergeAction, merging] = useActionState<SettingsState, FormData>(
    track(mergePlayersAction.bind(null, playerId)),
    {},
  );
  const [, removeAction, removing] = useActionState<SettingsState, FormData>(
    track(deletePlayerAction.bind(null, playerId)),
    {},
  );
  return (
    <details className={classes.manage}>
      <summary>
        <span className={classes.manageName}>{name}</span>
        <span className={classes.manageMeta}>
          {plays} {plays === 1 ? 'play' : 'plays'}
        </span>
      </summary>
      <div className={classes.manageBody}>
        {result?.error && (
          <Alert color="red" variant="light" role="alert">
            {result.error}
          </Alert>
        )}
        {result?.message && !result.error && (
          <Alert color="green" variant="light">
            {result.message}
          </Alert>
        )}
        <form action={renameAction} className={classes.row}>
          <TextInput name="name" label="Rename" defaultValue={name} aria-label={`Rename ${name}`} />
          <Button type="submit" variant="default" loading={renaming}>
            Save name
          </Button>
        </form>
        <form action={linkAction} className={classes.row}>
          <Select
            name="userId"
            label="They now have an account"
            placeholder="Choose the account"
            data={users}
            aria-label={`Link ${name} to an account`}
          />
          <Button type="submit" variant="default" loading={linking}>
            Link to account
          </Button>
        </form>
        {others.length > 0 && (
          <form action={mergeAction} className={classes.row}>
            <Select
              name="intoId"
              label="Same person as"
              placeholder="Choose who"
              data={others}
              searchable
              aria-label={`Merge ${name} into someone`}
            />
            <Button type="submit" variant="default" loading={merging}>
              Merge
            </Button>
          </form>
        )}
        <form action={removeAction}>
          <Button type="submit" variant="subtle" color="red" loading={removing}>
            Remove {name}
          </Button>
        </form>
      </div>
    </details>
  );
}
