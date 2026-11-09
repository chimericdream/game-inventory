import { Container, Paper, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { needsSetup } from '@/server/auth/accounts';
import { getDb } from '@/server/db/client';

import { loginAction } from '../actions';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await needsSetup(getDb())) redirect('/setup');
  return (
    <Container size={420} my={80}>
      <Title ta="center" mb="lg">
        Game Library
      </Title>
      <Paper withBorder p="xl">
        <AuthForm action={loginAction} mode="login" />
      </Paper>
    </Container>
  );
}
