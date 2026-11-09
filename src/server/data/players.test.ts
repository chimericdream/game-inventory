import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { createGame } from './games';
import { logPlay, playsForGame } from './plays';
import { createPlayer, DuplicatePlayerError, listPlayers, resolvePlayerNames } from './players';

let db: Db;
let admin: DataContext;
let kid: DataContext;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Joe',
    email: 'joe@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const k = await createUser(db, a.householdId, {
    name: 'Timmy',
    email: 'timmy@example.com',
    password: 'password123',
    role: 'restricted',
  });
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
});

describe('players', () => {
  it('gives every user exactly one linked player', async () => {
    const all = await listPlayers(admin);
    expect(all.map((p) => [p.displayName, p.userId !== null])).toEqual([
      ['Joe', true],
      ['Timmy', true],
    ]);
  });

  it('logs a play for people who have no account, then reuses them by name', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    const joe = (await listPlayers(admin)).find((p) => p.displayName === 'Joe')!;
    await logPlay(admin, {
      gameId: catan.id,
      playerIds: [joe.id],
      newPlayers: ['John', 'Sarah', 'Mikey', 'Melissa'],
    });
    const guests = (await listPlayers(admin)).filter((p) => p.userId === null);
    expect(guests.map((p) => p.displayName)).toEqual(['John', 'Melissa', 'Mikey', 'Sarah']);

    const again = await resolvePlayerNames(admin, ['john', ' Sarah ']);
    expect(again).toHaveLength(2);
    expect((await listPlayers(admin)).filter((p) => p.userId === null)).toHaveLength(4);

    const plays = await playsForGame(admin, catan.id);
    expect(plays[0]?.participants.map((p) => p.displayName).toSorted()).toEqual([
      'Joe',
      'John',
      'Melissa',
      'Mikey',
      'Sarah',
    ]);
  });

  it('refuses to create a duplicate player name and names the existing one', async () => {
    const john = await createPlayer(admin, 'John');
    await expect(createPlayer(admin, 'john')).rejects.toBeInstanceOf(DuplicatePlayerError);
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    await expect(logPlay(admin, { gameId: catan.id, newPlayers: ['JOHN'] })).rejects.toMatchObject({
      existingId: john.id,
    });
  });

  it('rolls the whole play back when a participant is invalid', async () => {
    const catan = await createGame(admin, { title: 'Catan', type: 'board' });
    await expect(
      logPlay(admin, {
        gameId: catan.id,
        playerIds: ['00000000-0000-4000-8000-000000000000'],
        newPlayers: ['Zed'],
      }),
    ).rejects.toThrow(/Unknown player/);
    expect(await playsForGame(admin, catan.id)).toHaveLength(0);
    expect((await listPlayers(admin)).some((p) => p.displayName === 'Zed')).toBe(false);
  });

  it('is closed to restricted profiles', async () => {
    await expect(listPlayers(kid)).rejects.toThrow(/cannot/);
    await expect(createPlayer(kid, 'Sneaky')).rejects.toThrow(/cannot/);
  });
});
