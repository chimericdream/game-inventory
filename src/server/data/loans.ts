import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { copies, games, loans } from '../db/schema';
import { createdFields, recordAudit, stampCreate, stampUpdate } from './audit';
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

  return ctx.db.transaction(async (tx) => {
    const [loan] = await tx
      .insert(loans)
      .values({
        householdId: ctx.householdId,
        copyId: input.copyId,
        borrower: input.borrower,
        lentOn: input.lentOn ?? today(),
        dueOn: input.dueOn ?? null,
        notes: input.notes ?? null,
        ...stampCreate(ctx),
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'loan',
      entityId: loan!.id,
      action: 'create',
      changes: createdFields({
        copyId: loan!.copyId,
        borrower: loan!.borrower,
        lentOn: loan!.lentOn,
        dueOn: loan!.dueOn,
      }),
    });
    return loan!;
  });
}

export async function returnLoan(ctx: DataContext, loanId: string, on: string = today()) {
  assertCanEdit(ctx);
  return ctx.db.transaction(async (tx) => {
    const [loan] = await tx
      .update(loans)
      .set({ returnedOn: on, ...stampUpdate(ctx) })
      .where(
        and(eq(loans.id, loanId), eq(loans.householdId, ctx.householdId), isNull(loans.returnedOn)),
      )
      .returning();
    if (!loan) return null;
    await recordAudit(tx, ctx, {
      entityType: 'loan',
      entityId: loanId,
      action: 'update',
      changes: { returnedOn: [null, on] },
    });
    return loan;
  });
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
    status: loanStatus(r.loan, now),
    daysOut: daysBetween(r.loan.lentOn, r.loan.returnedOn ?? now),
  }));
}

export type LoanStatus = 'returned' | 'late' | 'dueSoon' | 'later' | 'noDueDate';

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / DAY));

/**
 * Where a loan belongs in the list. Most loans have no due date, so `noDueDate` is the normal case
 * and `late` and `dueSoon` only ever appear for loans someone chose to date.
 */
export function loanStatus(
  loan: { returnedOn: string | null; dueOn: string | null },
  now: string = today(),
  soonDays = 7,
): LoanStatus {
  if (loan.returnedOn) return 'returned';
  if (loan.dueOn === null) return 'noDueDate';
  if (loan.dueOn < now) return 'late';
  return daysBetween(now, loan.dueOn) <= soonDays ? 'dueSoon' : 'later';
}

/** Names that have borrowed before, most recent first, for the lend picker. */
export async function previousBorrowers(ctx: DataContext, limit = 30) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({ borrower: loans.borrower, lentOn: loans.lentOn })
    .from(loans)
    .where(eq(loans.householdId, ctx.householdId))
    .orderBy(desc(loans.lentOn), desc(loans.id));
  const seen = new Map<string, { name: string; loans: number; lastLentOn: string }>();
  for (const r of rows) {
    const key = r.borrower.trim().toLowerCase();
    const found = seen.get(key);
    if (found) found.loans++;
    else seen.set(key, { name: r.borrower, loans: 1, lastLentOn: r.lentOn });
  }
  return [...seen.values()].slice(0, limit);
}

/** "Jonas has borrowed 3 games before and returned 2 late." */
export async function borrowerHistory(ctx: DataContext, borrower: string) {
  assertCanEdit(ctx);
  const rows = await ctx.db
    .select({ dueOn: loans.dueOn, returnedOn: loans.returnedOn })
    .from(loans)
    .where(
      and(
        eq(loans.householdId, ctx.householdId),
        sql`lower(${loans.borrower}) = ${borrower.trim().toLowerCase()}`,
      ),
    );
  const returned = rows.filter((r) => r.returnedOn !== null);
  return {
    borrowed: rows.length,
    returned: returned.length,
    returnedLate: returned.filter((r) => r.dueOn !== null && r.returnedOn! > r.dueOn).length,
    stillOut: rows.length - returned.length,
  };
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
