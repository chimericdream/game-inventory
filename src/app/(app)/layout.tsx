import { requireContext } from '@/server/auth/current';
import { navCounts } from '@/server/data/nav';

import { Shell } from './Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { ctx, user } = await requireContext();
  const counts = await navCounts(ctx);
  return (
    <Shell user={{ name: user.name, role: user.role }} counts={counts}>
      {children}
    </Shell>
  );
}
