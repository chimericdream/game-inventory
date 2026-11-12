'use client';

import { MantineProvider } from '@mantine/core';

import { cssVariablesResolver, theme } from '@app/theme';

/** Client boundary for the Mantine theme, the same one the app uses. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      {children}
    </MantineProvider>
  );
}
