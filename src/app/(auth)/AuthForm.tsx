'use client';

import { useActionState } from 'react';
import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';

import type { FormState } from './actions';

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  mode: 'login' | 'setup';
}

export function AuthForm({ action, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction}>
      <Stack>
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        {mode === 'setup' && (
          <>
            <TextInput
              name="householdName"
              label="Household name"
              placeholder="The Parrotts"
              required
            />
            <TextInput name="name" label="Your name" required />
          </>
        )}
        <TextInput name="email" type="email" label="Email" autoComplete="email" required />
        <PasswordInput
          name="password"
          label="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
        <Button type="submit" loading={pending}>
          {mode === 'login' ? 'Sign in' : 'Create household'}
        </Button>
      </Stack>
    </form>
  );
}
