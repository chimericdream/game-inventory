import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';

import { NewGameClient } from './NewGameClient';

export const dynamic = 'force-dynamic';

export default async function NewGamePage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  return (
    <>
      <Title order={1} mb="md">
        Add a game
      </Title>
      <NewGameClient />
    </>
  );
}
