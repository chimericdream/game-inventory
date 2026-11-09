import { Container, Paper, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { needsSetup } from '@/server/auth/accounts';
import { getDb } from '@/server/db/client';

import { setupAction } from '../actions';
import { AuthForm } from '../AuthForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (!(await needsSetup(getDb()))) redirect('/login');
  return (
    <Container size={420} my={80}>
      <Title ta="center">Welcome</Title>
      <Text c="dimmed" ta="center" mb="lg">
        Create your household and the first admin account.
      </Text>
      <Paper withBorder p="xl">
        <AuthForm action={setupAction} mode="setup" />
      </Paper>
    </Container>
  );
}
