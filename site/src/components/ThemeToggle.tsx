'use client';

import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

import classes from './ThemeToggle.module.css';

/** Both icons are in the markup; CSS shows the right one, so there is no hydration flash. */
export function ThemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      radius="xl"
      aria-label="Toggle light and dark theme"
      onClick={toggleColorScheme}
    >
      <IconSun className={classes.sun} size={20} />
      <IconMoon className={classes.moon} size={20} />
    </ActionIcon>
  );
}
