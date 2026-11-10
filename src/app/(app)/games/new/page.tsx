import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { listLocationOptions, listMembers } from '@/server/data/lookups';

import { NewGameClient } from './NewGameClient';

export const dynamic = 'force-dynamic';

export default async function NewGamePage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [members, locations] = await Promise.all([listMembers(ctx), listLocationOptions(ctx)]);
  return (
    <>
      <Title order={1} mb="md">
        Add a game
      </Title>
      <NewGameClient
        members={members.map((m) => ({ value: m.id, label: m.name }))}
        locations={locations}
      />
    </>
  );
}
