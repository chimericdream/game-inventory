'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';

import { purgeTrashedAction, restoreTrashedAction, type SettingsState } from './actions';
import classes from './Settings.module.css';

/** The word an admin types to confirm a permanent delete. */
const CONFIRM_WORD = 'delete';

interface Props {
  kind: string;
  id: string;
  title: string;
  canRestore: boolean;
  /** Only admins can delete for good. */
  canPurge: boolean;
  plays: number;
  ratings: number;
  expansions: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function TrashActions({
  kind,
  id,
  title,
  canRestore,
  canPurge,
  plays,
  ratings,
  expansions,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [typed, setTyped] = useState('');
  const [restoreState, restore, restoring] = useActionState<SettingsState, FormData>(
    restoreTrashedAction.bind(null, kind, id),
    {},
  );
  const [purgeState, purge, purging] = useActionState<SettingsState, FormData>(
    purgeTrashedAction.bind(null, kind, id),
    {},
  );
  const close = () => {
    setOpened(false);
    setTyped('');
  };
  const goes = [
    plays > 0 ? plural(plays, 'logged play') : null,
    ratings > 0 ? plural(ratings, 'rating') : null,
  ].filter(Boolean);
  return (
    <div className={classes.trashActions}>
      {canRestore && (
        <form action={restore} className={classes.inlineForm}>
          <Button type="submit" variant="light" size="compact-sm" loading={restoring}>
            Restore<span className={classes.srOnly}> {title}</span>
          </Button>
        </form>
      )}
      {canPurge && (
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          onClick={() => setOpened(true)}
          data-purge
        >
          Delete forever<span className={classes.srOnly}> {title}</span>
        </Button>
      )}
      {restoreState.error && (
        <span role="alert" className={classes.problem}>
          {restoreState.error}
        </span>
      )}
      <Modal opened={opened} onClose={close} title={`Permanently delete ${title}?`} centered>
        <form action={purge}>
          <Stack gap="sm">
            <Alert color="red" variant="light">
              This cannot be undone.
              {goes.length > 0 && ` ${goes.join(' and ')} will be deleted with it.`}
              {expansions > 0 &&
                ` ${plural(expansions, 'expansion')} will stay in the library without a base game.`}
            </Alert>
            <Text size="sm">
              Type <b>{CONFIRM_WORD}</b> to confirm.
            </Text>
            <TextInput
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.currentTarget.value)}
              autoComplete="off"
              data-autofocus
            />
            {purgeState.error && (
              <Alert color="red" variant="light" role="alert">
                {purgeState.error}
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                color="red"
                loading={purging}
                disabled={typed.trim().toLowerCase() !== CONFIRM_WORD}
              >
                Delete forever
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </div>
  );
}
