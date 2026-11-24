import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { setupHousehold } from './auth/accounts';
import { createContext, type DataContext } from './data/context';
import { addCopy } from './data/copies';
import { addCopyFile, deleteCopyFile } from './data/copy-files';
import { createGame } from './data/games';
import type { Db } from './db/client';
import { createTestDb } from './db/test-db';
import { ORPHAN_GRACE_MS, sweepOrphanFiles } from './file-sweep';
import { listStoredFiles, saveAttachment } from './storage';

const DAY = 86_400_000;
const PDF = Buffer.from('%PDF-1.7\n' + 'x'.repeat(100));

let db: Db;
let dir: string;
let admin: DataContext;
let copyId: string;
const original = process.env.DATA_DIR;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'shelf-sweep-'));
  process.env.DATA_DIR = dir;
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const game = await createGame(admin, { title: 'Gloom', type: 'card' });
  copyId = (await addCopy(admin, game.id, { format: 'print_and_play' })).id;
});

afterEach(async () => {
  if (original === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = original;
  await rm(dir, { recursive: true, force: true });
});

const body = () =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(PDF));
      c.close();
    },
  });

/** Sets how long ago a stored file was last written. */
const age = async (rel: string, days: number) => {
  const when = new Date(Date.now() - days * DAY);
  await utimes(path.join(dir, rel), when, when);
};

/** A stored file with a row, like a real upload. */
async function tracked(id: string, ageDays: number) {
  const saved = await saveAttachment(admin.householdId, id, 'pdf', body());
  await age(saved.rel, ageDays);
  const row = await addCopyFile(admin, copyId, {
    id,
    name: `${id}.pdf`,
    mime: 'application/pdf',
    sizeBytes: saved.size,
    storagePath: saved.rel,
  });
  return { rel: saved.rel, id: row.id };
}

/** A stored file nothing points to, like bytes left behind by a failed removal. */
async function orphan(household: string, id: string, ageDays: number) {
  const saved = await saveAttachment(household, id, 'pdf', body());
  await age(saved.rel, ageDays);
  return saved.rel;
}

const onDisk = async () => (await listStoredFiles('files')).map((f) => f.rel).toSorted();
// Valid v4-shaped ids, so they look like the real thing.
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('sweepOrphanFiles', () => {
  it('deletes old files that no row points to, and keeps everything else', async () => {
    const live = await tracked(ID(1), 30);
    const trashed = await tracked(ID(2), 30);
    await deleteCopyFile(admin, trashed.id);
    const stale = await orphan(admin.householdId, ID(3), 10);
    const fresh = await orphan(admin.householdId, ID(4), 1);

    const result = await sweepOrphanFiles(db);
    expect(result).toEqual({ removed: [stale], failed: [], refused: [] });
    expect(await onDisk()).toEqual([live.rel, trashed.rel, fresh].toSorted());
  });

  it('finds orphans in any household folder, and leaves covers alone', async () => {
    await tracked(ID(1), 30);
    const elsewhere = await orphan('some-other-household', ID(5), 10);
    await mkdir(path.join(dir, 'covers', 'h'), { recursive: true });
    await writeFile(path.join(dir, 'covers/h/old.png'), 'x');
    await age('covers/h/old.png', 100);

    const result = await sweepOrphanFiles(db);
    expect(result.removed).toEqual([elsewhere]);
    expect(await readdir(path.join(dir, 'covers/h'))).toEqual(['old.png']);
  });

  it('waits out the grace period, measured from the time it is given', async () => {
    const rel = await orphan(admin.householdId, ID(6), 0);
    expect((await sweepOrphanFiles(db)).removed).toEqual([]);
    expect((await sweepOrphanFiles(db, Date.now() + ORPHAN_GRACE_MS - DAY)).removed).toEqual([]);
    expect((await sweepOrphanFiles(db, Date.now() + ORPHAN_GRACE_MS + DAY)).removed).toEqual([rel]);
  });

  it('does nothing when there is nothing there', async () => {
    expect(await sweepOrphanFiles(db)).toEqual({ removed: [], failed: [], refused: [] });
  });

  it('refuses to delete when most of the folder is unaccounted for', async () => {
    // What a wrong or empty database looks like: lots of files, almost none of them known.
    await tracked(ID(1), 30);
    const strays = await Promise.all(
      [10, 11, 12, 13, 14, 15].map((n) => orphan(admin.householdId, ID(n), 20)),
    );

    const result = await sweepOrphanFiles(db);
    expect(result.removed).toEqual([]);
    expect(result.refused).toEqual(strays.toSorted());
    expect(await onDisk()).toHaveLength(7);
  });

  it('still cleans up the same number of strays in a folder that is mostly known', async () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) await tracked(ID(n), 30);
    const strays = await Promise.all(
      [10, 11, 12, 13, 14, 15].map((n) => orphan(admin.householdId, ID(n), 20)),
    );

    const result = await sweepOrphanFiles(db);
    expect(result.refused).toEqual([]);
    expect(result.removed).toEqual(strays.toSorted());
    expect(await onDisk()).toHaveLength(7);
  });
});

describe('listStoredFiles', () => {
  it('lists nested files with /-separated paths, and nothing for a missing folder', async () => {
    const rel = await orphan('h', ID(1), 0);
    expect(rel).toBe(`files/h/${ID(1)}.pdf`);
    const [file] = await listStoredFiles('files');
    expect(file).toMatchObject({ rel, size: PDF.length });
    expect(file!.modifiedMs).toBeGreaterThan(0);
    expect(await listStoredFiles('nope')).toEqual([]);
    expect(await listStoredFiles('..')).toEqual([]);
  });
});
