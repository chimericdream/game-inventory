import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { listLendableCopies, listLoans } from '@/server/data/loans';

import { dueStatus } from '@/components/dueStatus';

import { LoansView } from './LoansView';

export const dynamic = 'force-dynamic';

export default async function LoansPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [loans, copies] = await Promise.all([listLoans(ctx), listLendableCopies(ctx)]);
  return (
    <>
      <Title order={1} mb="md">
        Loans
      </Title>
      <LoansView
        loans={loans.map((l) => ({
          id: l.id,
          title: l.title,
          hasCover: l.coverImage !== null,
          gameId: l.gameId,
          platform: l.platform,
          borrower: l.borrower,
          lentOn: l.lentOn,
          dueOn: l.dueOn,
          dueStatus: dueStatus(l.dueOn, new Date().toISOString().slice(0, 10)),
        }))}
        copies={copies.map((c) => ({
          value: c.id,
          label: c.platform ? `${c.title} (${c.platform})` : c.title,
        }))}
      />
    </>
  );
}
