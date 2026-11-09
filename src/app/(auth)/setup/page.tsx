import { redirect } from 'next/navigation';

import { needsSetup } from '@/server/auth/accounts';
import { getDb } from '@/server/db/client';

import { setupAction } from '../actions';
import { AuthForm } from '../AuthForm';
import { AuthShell } from '../AuthShell';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (!(await needsSetup(getDb()))) redirect('/login');
  return (
    <AuthShell
      title="Let’s set up your shelf."
      lead="You’re the first one here, so this account becomes the admin. You can add the rest of the family afterwards."
      footnote="This page only appears once, while the library is empty."
    >
      <AuthForm action={setupAction} mode="setup" />
    </AuthShell>
  );
}
