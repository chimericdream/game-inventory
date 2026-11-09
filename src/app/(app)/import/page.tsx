import { Code, Flex, Paper, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';

import { ImportForm } from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  return (
    <Stack gap="lg">
      <Title order={1}>Import games</Title>
      <Flex gap="lg" direction={{ base: 'column', md: 'row' }} align="flex-start">
        <Paper withBorder p="md" style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <ImportForm />
        </Paper>
        <Paper withBorder p="md" style={{ width: '100%', maxWidth: 420, flex: 'none' }}>
          <Stack gap="xs">
            <Title order={2} size="h5">
              CSV format
            </Title>
            <Text size="sm" c="dimmed">
              Upload a CSV with a header row. Only <Code>title</Code> is required. Other recognized
              columns: <Code>type</Code>, <Code>min_players</Code>, <Code>max_players</Code>,{' '}
              <Code>minutes</Code>, <Code>complexity</Code>, <Code>pieces</Code> (for puzzles),{' '}
              <Code>tags</Code> (separate with ;), <Code>platform</Code>, <Code>location</Code>,{' '}
              <Code>notes</Code>. Games already in the library (same title and type) are skipped, so
              re-importing is safe.
            </Text>
          </Stack>
        </Paper>
      </Flex>
    </Stack>
  );
}
