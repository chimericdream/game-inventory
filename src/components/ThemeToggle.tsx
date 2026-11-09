'use client';

import { ActionIcon, Box, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

/**
 * Flips between light and dark. Both icons are rendered and Mantine's light/dark-hidden props pick
 * one in CSS, so the server and first client render match whatever scheme the visitor is on.
 */
export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      aria-label="Toggle light or dark theme"
      onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
    >
      <Box component="span" lightHidden display="inline-flex">
        <IconSun size={20} aria-hidden />
      </Box>
      <Box component="span" darkHidden display="inline-flex">
        <IconMoon size={20} aria-hidden />
      </Box>
    </ActionIcon>
  );
}
