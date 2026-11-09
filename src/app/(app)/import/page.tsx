import { Code, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';

import { ImportForm } from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  return (
    <>
      <Title order={1} mb="xs">
        Import games
      </Title>
      <Text c="dimmed" mb="md" maw={560}>
        Upload a CSV with a header row. Only <Code>title</Code> is required. Other recognized
        columns: <Code>type</Code>, <Code>min_players</Code>, <Code>max_players</Code>,{' '}
        <Code>minutes</Code>, <Code>complexity</Code>, <Code>tags</Code> (separate with ;),{' '}
        <Code>platform</Code>, <Code>location</Code>, <Code>notes</Code>. Games already in the
        library (same title and type) are skipped, so re-importing is safe.
      </Text>
      <ImportForm />
    </>
  );
}
