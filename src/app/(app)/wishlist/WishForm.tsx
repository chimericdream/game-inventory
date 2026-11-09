'use client';

import { useActionState } from 'react';
import { Alert, Button, Drawer, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHeartPlus } from '@tabler/icons-react';

import { TYPE_OPTIONS } from '../games/labels';
import { addWishlistAction } from '../tracking-actions';
import classes from './Wishlist.module.css';

function WishForm({ onDone }: { onDone?: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof addWishlistAction>>, fd: FormData) => {
      const result = await addWishlistAction(prev, fd);
      if (result.ok) onDone?.();
      return result;
    },
    {},
  );
  return (
    <form action={action} className={classes.panel}>
      <h2>Add to the wishlist</h2>
      <p className={classes.hint}>Anything you would like the family to know about.</p>
      <Stack gap="sm">
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        <TextInput name="title" label="Title" required />
        <Select
          name="type"
          label="Type"
          data={TYPE_OPTIONS}
          defaultValue="board"
          allowDeselect={false}
        />
        <NumberInput name="price" label="Price ($)" min={0} decimalScale={2} hideControls />
        <TextInput name="url" label="Link" placeholder="https://" />
        <TextInput
          name="notes"
          label="Note for gift-givers"
          description="Edition, where to buy it, why you want it."
        />
        <Button type="submit" loading={pending} mt="xs">
          Add
        </Button>
      </Stack>
    </form>
  );
}

/** The add form as a panel beside the lists. Hidden on a phone, where the sheet takes over. */
export function WishAside() {
  return (
    <div className={classes.desktopForm}>
      <WishForm />
    </div>
  );
}

/** On a phone a button opens the add form as a bottom sheet. */
export function WishSheetButton() {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <div className={classes.phoneForm}>
      <Button
        leftSection={<IconHeartPlus size={18} aria-hidden />}
        onClick={open}
        aria-haspopup="dialog"
      >
        Add to the wishlist
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        size="92%"
        title="Add to the wishlist"
        radius="lg"
      >
        <WishForm onDone={close} />
      </Drawer>
    </div>
  );
}
