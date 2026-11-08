import { requireContext } from '@/server/auth/current';

import { Shell } from './Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireContext();
  return <Shell user={{ name: user.name, role: user.role }}>{children}</Shell>;
}
