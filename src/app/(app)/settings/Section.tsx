'use client';

import { Grid, Paper, Stack, Text, Title } from '@mantine/core';

/**
 * One settings area: its name and what it is for beside the controls. A client component because
 * `Grid.Col` is a dotted member of a client module, which server components cannot reach.
 */
export function Section({
  title,
  description,
  panel = true,
  children,
}: {
  title: string;
  description: string;
  panel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Title order={2} size="h4">
          {title}
        </Title>
        <Text size="sm" c="dimmed" mt={4} maw={340}>
          {description}
        </Text>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        {panel ? (
          <Paper withBorder p="md">
            <Stack gap="md">{children}</Stack>
          </Paper>
        ) : (
          children
        )}
      </Grid.Col>
    </Grid>
  );
}
