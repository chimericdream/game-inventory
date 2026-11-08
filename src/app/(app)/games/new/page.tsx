import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';

import { saveGameAction } from '../actions';
import { GameForm } from '../GameForm';

export const dynamic = 'force-dynamic';

export default async function NewGamePage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  return (
    <>
      <Title order={2} mb="md">
        Add game
      </Title>
      <GameForm action={saveGameAction.bind(null, null)} cancelHref="/games" />
    </>
  );
}
