'use client';

import { Button, Drawer } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';

interface Props {
  /** How many filters are active, shown on the button. */
  active: number;
  /** The server-rendered filter panel. */
  children: React.ReactNode;
}

/**
 * On a phone the filters live in a bottom sheet. Mantine's drawer traps focus, closes on Escape
 * and a tap outside, returns focus to this button, and locks the page behind it.
 */
export function FilterSheet({ active, children }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Button
        variant="default"
        leftSection={<IconAdjustmentsHorizontal size={18} aria-hidden />}
        onClick={open}
        aria-haspopup="dialog"
      >
        Filters{active > 0 ? ` (${active})` : ''}
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        size="85%"
        title="Filters"
        radius="lg"
        // Choosing a filter navigates; close the sheet so the results are in view.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) close();
        }}
      >
        {children}
      </Drawer>
    </>
  );
}
