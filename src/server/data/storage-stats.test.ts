import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { households, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy } from './copies';
import { addCopyFile, deleteCopyFile } from './copy-files';
import { createGame } from './games';
import { storageStats } from './storage-stats';

let db: Db;
let admin: DataContext;
let member: DataContext;
let other: DataContext;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const m = await createUser(db, a.householdId, {
    name: 'Max',
    email: 'max@example.com',
    password: 'password123',
    role: 'member',
  });
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const [h2] = await db.insert(households).values({ name: 'Other' }).returning();
  const [u2] = await db
    .insert(users)
    .values({
      householdId: h2!.id,
      name: 'Bo',
      email: 'bo@example.com',
      passwordHash: 'x',
      role: 'admin',
    })
    .returning();
  other = createContext(db, h2!.id, { kind: 'user', userId: u2!.id, role: 'admin' });
});

async function printAndPlay(ctx: DataContext, title: string) {
  const game = await createGame(ctx, { title, type: 'card' });
  return addCopy(ctx, game.id, { format: 'print_and_play' });
}

const attach = (ctx: DataContext, copyId: string, sizeBytes: number) => {
  const id = randomUUID();
  return addCopyFile(ctx, copyId, {
    id,
    name: `${id}.pdf`,
    mime: 'application/pdf',
    sizeBytes,
    storagePath: `files/${ctx.householdId}/${id}.pdf`,
  });
};

describe('storageStats', () => {
  it('is for admins only', async () => {
    await expect(storageStats(member)).rejects.toThrow(/admin/);
  });

  it('reports zero files on a fresh install, and the database size', async () => {
    const stats = await storageStats(admin);
    expect(stats.files).toEqual({ liveCount: 0, liveBytes: 0, trashedCount: 0, trashedBytes: 0 });
    expect(stats.databaseBytes).toBeGreaterThan(0);
  });

  it('counts live files and files in the trash separately', async () => {
    const copy = await printAndPlay(admin, 'Gloom');
    await attach(admin, copy.id, 1_000);
    const trashed = await attach(admin, copy.id, 5_000);
    await deleteCopyFile(admin, trashed.id);
    expect((await storageStats(admin)).files).toEqual({
      liveCount: 1,
      liveBytes: 1_000,
      trashedCount: 1,
      trashedBytes: 5_000,
    });
  });

  it('counts the files of a copy in the trash as trashed, even if each is not', async () => {
    const copy = await printAndPlay(admin, 'Gloom');
    await attach(admin, copy.id, 2_000);
    await attach(admin, copy.id, 3_000);
    await deleteCopy(admin, copy.id);
    expect((await storageStats(admin)).files).toEqual({
      liveCount: 0,
      liveBytes: 0,
      trashedCount: 2,
      trashedBytes: 5_000,
    });
  });

  it('only counts this household’s files', async () => {
    const mine = await printAndPlay(admin, 'Gloom');
    const theirs = await printAndPlay(other, 'Spirit Island');
    await attach(admin, mine.id, 1_000);
    await attach(other, theirs.id, 9_000);
    expect((await storageStats(admin)).files.liveBytes).toBe(1_000);
    expect((await storageStats(other)).files.liveBytes).toBe(9_000);
  });
});
