import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy } from './copies';
import { createGame } from './games';
import {
  borrowerHistory,
  lendCopy,
  listLoans,
  loanStatus,
  previousBorrowers,
  returnLoan,
} from './loans';
import { logPlay, playerStats } from './plays';
import { listPlayers } from './players';

let db: Db;
let admin: DataContext;
let kid: DataContext;

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const k = await createUser(db, a.householdId, {
    name: 'Kid',
    email: 'kid@example.com',
    password: 'password123',
    role: 'restricted',
  });
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
});

describe('loan status', () => {
  it('treats no due date as the normal case', () => {
    const open = { returnedOn: null };
    expect(loanStatus({ ...open, dueOn: null }, '2026-06-10')).toBe('noDueDate');
    expect(loanStatus({ ...open, dueOn: '2026-06-09' }, '2026-06-10')).toBe('late');
    expect(loanStatus({ ...open, dueOn: '2026-06-10' }, '2026-06-10')).toBe('dueSoon');
    expect(loanStatus({ ...open, dueOn: '2026-06-17' }, '2026-06-10')).toBe('dueSoon');
    expect(loanStatus({ ...open, dueOn: '2026-06-18' }, '2026-06-10')).toBe('later');
    expect(loanStatus({ returnedOn: '2026-06-01', dueOn: '2026-05-01' }, '2026-06-10')).toBe(
      'returned',
    );
  });

  it('lists loans with their status and days out', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, {});
    await lendCopy(admin, { copyId: copy.id, borrower: 'Dana', lentOn: day(14) });
    const [loan] = await listLoans(admin);
    expect(loan).toMatchObject({ status: 'noDueDate', daysOut: 14, overdue: false });
  });
});

describe('borrowers', () => {
  it('lists earlier borrowers once each, most recent first', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, {});
    for (const [who, on] of [
      ['Dana', '2026-01-01'],
      ['ray', '2026-02-01'],
      ['Ray', '2026-03-01'],
      ['Priya', '2026-02-15'],
    ] as const) {
      const loan = await lendCopy(admin, { copyId: copy.id, borrower: who, lentOn: on });
      await returnLoan(admin, loan.id, on);
    }
    const list = await previousBorrowers(admin);
    expect(list.map((b) => [b.name, b.loans])).toEqual([
      ['Ray', 2],
      ['Priya', 1],
      ['Dana', 1],
    ]);
  });

  it('summarises how a borrower has returned things', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, {});
    const a = await lendCopy(admin, {
      copyId: copy.id,
      borrower: 'Jonas',
      lentOn: '2026-01-01',
      dueOn: '2026-01-10',
    });
    await returnLoan(admin, a.id, '2026-01-20'); // late
    const b = await lendCopy(admin, { copyId: copy.id, borrower: 'jonas', lentOn: '2026-02-01' });
    await returnLoan(admin, b.id, '2026-02-03'); // no due date, never late
    await lendCopy(admin, { copyId: copy.id, borrower: 'Jonas', lentOn: '2026-03-01' });
    expect(await borrowerHistory(admin, ' JONAS ')).toEqual({
      borrowed: 3,
      returned: 2,
      returnedLate: 1,
      stillOut: 1,
    });
  });

  it('is closed to restricted profiles', async () => {
    await expect(previousBorrowers(kid)).rejects.toThrow(/cannot/);
    await expect(borrowerHistory(kid, 'x')).rejects.toThrow(/cannot/);
  });
});

describe('player stats', () => {
  it('counts plays per player, overall and for one game', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    const uno = await createGame(admin, { title: 'Uno', type: 'card' });
    const ada = (await listPlayers(admin)).find((p) => p.displayName === 'Ada')!;
    await logPlay(admin, { gameId: catan.id, playerIds: [ada.id], newPlayers: ['John'] });
    await logPlay(admin, { gameId: catan.id, playerIds: [ada.id] });
    const john = (await listPlayers(admin)).find((p) => p.displayName === 'John')!;
    await logPlay(admin, { gameId: uno.id, playerIds: [john.id], newPlayers: ['Sarah'] });

    expect((await playerStats(admin)).map((p) => [p.displayName, p.plays])).toEqual([
      ['Ada', 2],
      ['John', 2],
      ['Sarah', 1],
    ]);
    expect(
      (await playerStats(admin, { gameId: catan.id })).map((p) => [p.displayName, p.plays]),
    ).toEqual([
      ['Ada', 2],
      ['John', 1],
    ]);
    await expect(playerStats(kid)).rejects.toThrow(/cannot/);
  });
});
