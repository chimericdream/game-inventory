import { Button } from '@mantine/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CoverTile } from '@/components/shelf/CoverTile';
import { shortDate } from '@/lib/dates';
import { requireContext } from '@/server/auth/current';
import {
  listLendableCopies,
  listLoans,
  previousBorrowers,
  type LoanStatus,
} from '@/server/data/loans';

import { coverUrl } from '../games/tiles';
import { returnLoanAction } from '../tracking-actions';
import { LendAside, LendSheetButton } from './LendPanel';
import classes from './Loans.module.css';

export const dynamic = 'force-dynamic';

type Loan = Awaited<ReturnType<typeof listLoans>>[number];

const DAY = 86_400_000;
const daysFrom = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const SECTIONS: { status: LoanStatus; title: string }[] = [
  { status: 'late', title: 'Late' },
  { status: 'dueSoon', title: 'Due this week' },
  { status: 'later', title: 'Due later' },
  { status: 'noDueDate', title: 'Out now' },
];

function DueLine({ loan, today }: { loan: Loan; today: string }) {
  if (!loan.dueOn) return null;
  const left = daysFrom(today, loan.dueOn);
  const note =
    left < 0
      ? `${plural(-left, 'day')} late`
      : left === 0
        ? 'due today'
        : `in ${plural(left, 'day')}`;
  return (
    <div className={classes.due} data-late={left < 0 || undefined}>
      <b>{shortDate(loan.dueOn)}</b>
      {note}
    </div>
  );
}

function LoanRow({ loan, today }: { loan: Loan; today: string }) {
  return (
    <li className={classes.row} data-loan data-late={loan.status === 'late' || undefined}>
      <div className={classes.cover}>
        <CoverTile
          title={loan.title}
          type="board"
          src={loan.coverImage ? coverUrl(loan.gameId) : null}
        />
      </div>
      <div>
        <h3 className={classes.name}>
          <Link href={`/games/${loan.gameId}`}>{loan.title}</Link>
          {loan.platform && ` (${loan.platform})`}
        </h3>
        <div className={classes.meta}>
          <span className={classes.who}>
            <span className={classes.avatar} aria-hidden>
              {loan.borrower.slice(0, 1).toUpperCase()}
            </span>
            With {loan.borrower}
          </span>
          <span>
            since {shortDate(loan.lentOn)} · {plural(loan.daysOut, 'day')}
          </span>
        </div>
      </div>
      <DueLine loan={loan} today={today} />
      <form action={returnLoanAction.bind(null, loan.id)} className={classes.action}>
        <Button type="submit" variant="light">
          Mark returned
        </Button>
      </form>
    </li>
  );
}

export default async function LoansPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [loans, copies, borrowers] = await Promise.all([
    listLoans(ctx, { includeReturned: true }),
    listLendableCopies(ctx),
    previousBorrowers(ctx),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const open = loans.filter((l) => l.status !== 'returned');
  const returned = loans
    .filter((l) => l.status === 'returned')
    .toSorted((a, b) => (b.returnedOn ?? '').localeCompare(a.returnedOn ?? ''))
    .slice(0, 8);
  const byStatus = (status: LoanStatus) =>
    open
      .filter((l) => l.status === status)
      .toSorted((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '') || b.daysOut - a.daysOut);
  const lendCopies = copies.map((c) => ({
    value: c.id,
    label: c.platform ? `${c.title} (${c.platform})` : c.title,
  }));
  const lateCount = byStatus('late').length;
  const soonCount = byStatus('dueSoon').length;
  const people = new Set(open.map((l) => l.borrower.trim().toLowerCase())).size;

  return (
    <div className={classes.layout}>
      <div>
        <header className={classes.head}>
          <h1 className={classes.title}>Loans</h1>
          <p className={classes.summary}>
            {open.length === 0 ? (
              'Nothing is out on loan.'
            ) : (
              <>
                <b>
                  {plural(open.length, 'game')} {open.length === 1 ? 'is' : 'are'} out
                </b>{' '}
                with {plural(people, 'person', 'people')}.
                {lateCount > 0 && (
                  <>
                    {' '}
                    <span className={classes.late}>{plural(lateCount, 'is', 'are')} late</span>
                    {soonCount > 0 ? `, ${soonCount} due this week.` : '.'}
                  </>
                )}
                {lateCount === 0 && soonCount > 0 && ` ${soonCount} due this week.`}
              </>
            )}
          </p>
          <LendSheetButton copies={lendCopies} borrowers={borrowers} />
        </header>

        {SECTIONS.map(({ status, title }) => {
          const rows = byStatus(status);
          if (rows.length === 0) return null;
          return (
            <section
              key={status}
              className={`${classes.section} ${status === 'late' ? classes.sectionLate : ''}`}
              aria-labelledby={`loans-${status}`}
            >
              <h2 id={`loans-${status}`}>
                {title}
                <span className={classes.count}>{rows.length}</span>
              </h2>
              <ul className={classes.list}>
                {rows.map((l) => (
                  <LoanRow key={l.id} loan={l} today={today} />
                ))}
              </ul>
            </section>
          );
        })}

        {returned.length > 0 && (
          <section className={classes.section} aria-labelledby="loans-back">
            <h2 id="loans-back">
              Back on the shelf
              <span className={classes.count}>{returned.length}</span>
            </h2>
            <ul className={classes.back}>
              {returned.map((l) => (
                <li key={l.id} className={classes.backRow} data-returned>
                  <div className={classes.cover}>
                    <CoverTile
                      title={l.title}
                      type="board"
                      src={l.coverImage ? coverUrl(l.gameId) : null}
                    />
                  </div>
                  <span className={classes.backText}>
                    {l.title}
                    <small>
                      {l.borrower} · back {l.returnedOn ? shortDate(l.returnedOn) : ''} · kept{' '}
                      {plural(l.daysOut, 'day')}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <LendAside copies={lendCopies} borrowers={borrowers} />
    </div>
  );
}
