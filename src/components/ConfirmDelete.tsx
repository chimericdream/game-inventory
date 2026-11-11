'use client';

import { type ReactNode, useState, useTransition } from 'react';
import { ActionIcon, Alert, Button, Group, Modal, Stack } from '@mantine/core';

interface Props {
  /** Modal heading, e.g. "Delete Catan?". */
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  /** Accessible name (and text, for a button) of the control that opens the modal. */
  triggerLabel: string;
  /** Show an icon button instead of a text button. */
  triggerIcon?: ReactNode;
  /** Why this cannot be deleted right now. Shown instead of the explanation; confirming is off. */
  blocked?: ReactNode;
  /** A smaller text button, for use inside rows. */
  compact?: boolean;
  /** Confirm button text. */
  confirmLabel?: string;
  /** Runs on confirm. Return `{ error }` to keep the modal open and show why. */
  action: () => Promise<{ error?: string } | void>;
}

/**
 * Every deletion asks first. Deleting moves something to the trash, so the wording says where it
 * went and that it can be restored.
 */
export function ConfirmDelete({
  title,
  children,
  triggerLabel,
  triggerIcon,
  blocked,
  compact,
  confirmLabel = 'Move to trash',
  action,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setOpened(false);
    setError(null);
  };
  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await action();
        if (result && result.error) setError(result.error);
        else close();
      } catch (e) {
        // A redirect after deleting is not an error; the browser is already on its way.
        if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e;
        setError('Could not delete it. Try again.');
      }
    });
  return (
    <>
      {triggerIcon ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={triggerLabel}
          onClick={() => setOpened(true)}
        >
          {triggerIcon}
        </ActionIcon>
      ) : (
        <Button
          variant="subtle"
          color="red"
          size={compact ? 'compact-sm' : undefined}
          onClick={() => setOpened(true)}
        >
          {triggerLabel}
        </Button>
      )}
      <Modal opened={opened} onClose={close} title={title} centered>
        <Stack gap="sm">
          {blocked ? (
            <Alert color="red" variant="light" role="alert">
              {blocked}
            </Alert>
          ) : (
            <div>{children}</div>
          )}
          {error && (
            <Alert color="red" variant="light" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button color="red" onClick={confirm} loading={pending} disabled={Boolean(blocked)}>
              {confirmLabel}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
