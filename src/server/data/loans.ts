import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { copies, games, loans } from '../db/schema';
import type { DataContext } from './context';
import { gameVisibilityCondition } from './visibility';

const today = () => new Date().toISOString().slice(0, 10);

export const loanInput = z.object({
  copyId: z.string().uuid(),
  borrower: z.string().trim().min(1, 'Who is borrowing it?').max(100),
  lentOn: z.string().date().optional(),
  dueOn: z.string().date().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type LoanInput = z.input<typeof loanInput>;

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot manage loans');
}

export async function lendCopy(ctx: DataContext, raw: LoanInput) {
  assertCanEdit(ctx);
  const input = loanInput.parse(raw);
  const [copy] = await ctx.db
    .select({ id: copies.id })
    .from(copies)
    .where(and(eq(copies.id, input.copyId), eq(copies.householdId, ctx.householdId)));
  if (!copy) throw new Error('Copy not found');

  const [open] = await ctx.db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.copyId, input.copyId), isNull(loans.returnedOn)));
  if (open) throw new Error('That copy is already out on loan');

  const [loan] = await ctx.db
    .insert(loans)
    .values({
      householdId: ctx.householdId,
      copyId: input.copyId,
      borrower: input.borrower,
      lentOn: input.lentOn ?? today(),
      dueOn: input.dueOn ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return loan!;
}

export async function returnLoan(ctx: DataContext, loanId: string, on: string = today()) {
  assertCanEdit(ctx);
  const [loan] = await ctx.db
    .update(loans)
    .set({ returnedOn: on })
    .where(
      and(eq(loans.id, loanId), eq(loans.householdId, ctx.householdId), isNull(loans.returnedOn)),
    )
    .returning();
  return loan ?? null;
}

export async function listLoans(ctx: DataContext, opts: { includeReturned?: boolean } = {}) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({
      loan: loans,
      gameId: games.id,
      title: games.title,
      coverImage: games.coverImage,
      platform: copies.platform,
    })
    .from(loans)
    .innerJoin(copies, eq(copies.id, loans.copyId))
    .innerJoin(games, eq(games.id, copies.gameId))
    .where(
      and(
        eq(loans.householdId, ctx.householdId),
        gameVisibilityCondition(ctx),
        opts.includeReturned ? undefined : isNull(loans.returnedOn),
      ),
    )
    .orderBy(asc(loans.dueOn), asc(loans.lentOn));
  const now = today();
  return rows.map((r) => ({
    ...r.loan,
    gameId: r.gameId,
    title: r.title,
    coverImage: r.coverImage,
    platform: r.platform,
    overdue: !r.loan.returnedOn && r.loan.dueOn !== null && r.loan.dueOn < now,
  }));
}

/** Copies not currently on loan, for the "lend" picker. */
export async function listLendableCopies(ctx: DataContext) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({
      id: copies.id,
      title: games.title,
      platform: copies.platform,
      onLoan: loans.id,
    })
    .from(copies)
    .innerJoin(games, eq(games.id, copies.gameId))
    .leftJoin(loans, and(eq(loans.copyId, copies.id), isNull(loans.returnedOn)))
    .where(and(eq(copies.householdId, ctx.householdId), gameVisibilityCondition(ctx)))
    .orderBy(asc(games.title));
  return rows.filter((r) => !r.onLoan).map(({ id, title, platform }) => ({ id, title, platform }));
}
