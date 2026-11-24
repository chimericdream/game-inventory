import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog, copies, households, users } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy } from './copies';
import {
  addCopyFile,
  cleanFileName,
  deleteCopyFile,
  getCopyFileForDownload,
  prepareCopyFileUpload,
} from './copy-files';
import { createGame, deleteGame, getGameDetail } from './games';
import { createShareLink, guestCatalog, guestGame, resolveShareLink } from './guest';
import { listTrash, purgeExpiredTrash, purgeTrashed, restoreTrashed } from './trash';

let db: Db;
let admin: DataContext;
let member: DataContext;
let kid: DataContext;
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
  const make = (name: string, role: 'member' | 'restricted') =>
    createUser(db, a.householdId, {
      name,
      email: `${name.toLowerCase()}@example.com`,
      password: 'password123',
      role,
    });
  const m = await make('Max', 'member');
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const k = await make('Kid', 'restricted');
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
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

async function seed(
  extra: { shareable?: boolean; visibility?: 'normal' | 'hide_images' | 'hidden_restricted' } = {},
) {
  const game = await createGame(admin, { title: 'Hostage Negotiator', type: 'card', ...extra });
  const copy = await addCopy(admin, game.id, { format: 'print_and_play' });
  return { game, copy };
}

const attach = (ctx: DataContext, copyId: string, name = 'rules SECRET.pdf') => {
  const id = randomUUID();
  return addCopyFile(ctx, copyId, {
    id,
    name,
    mime: 'application/pdf',
    sizeBytes: 1234,
    storagePath: `files/${ctx.householdId}/${id}.pdf`,
  });
};

const auditFor = (id: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, 'copy_file'), eq(auditLog.entityId, id)));

describe('copy files', () => {
  it('attach to a print & play copy and show on the game', async () => {
    const { game, copy } = await seed();
    const file = await attach(member, copy.id);
    const detail = await getGameDetail(member, game.id);
    const files = detail!.copies.find((c) => c.id === copy.id)!.files;
    expect(files).toEqual([
      expect.objectContaining({ id: file.id, name: 'rules SECRET.pdf', sizeBytes: 1234 }),
    ]);
    // The path on disk is never part of what the page receives.
    expect(JSON.stringify(files)).not.toContain('storagePath');
    expect(JSON.stringify(files)).not.toContain('files/');
  });

  it('are only accepted on a live print & play copy', async () => {
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const boxed = await addCopy(admin, game.id, { format: 'physical' });
    expect(await prepareCopyFileUpload(member, boxed.id)).toBeNull();
    await expect(attach(member, boxed.id)).rejects.toThrow(/Copy not found/);

    const { copy } = await seed();
    expect(await prepareCopyFileUpload(member, copy.id)).not.toBeNull();
    expect(await prepareCopyFileUpload(member, 'not-a-uuid')).toBeNull();
    await deleteCopy(admin, copy.id);
    expect(await prepareCopyFileUpload(member, copy.id)).toBeNull();
  });

  it('refuses restricted profiles and other households', async () => {
    const { copy } = await seed();
    const file = await attach(admin, copy.id);
    await expect(prepareCopyFileUpload(kid, copy.id)).rejects.toThrow(/Restricted/);
    await expect(attach(kid, copy.id)).rejects.toThrow(/Restricted/);
    await expect(deleteCopyFile(kid, file.id)).rejects.toThrow(/Restricted/);

    expect(await prepareCopyFileUpload(other, copy.id)).toBeNull();
    await expect(attach(other, copy.id)).rejects.toThrow(/Copy not found/);
    expect(await deleteCopyFile(other, file.id)).toBe(false);
    expect(await getCopyFileForDownload(other, file.id)).toBeNull();
  });

  it('writes an audit row for adding and trashing', async () => {
    const { copy, game } = await seed();
    const file = await attach(member, copy.id);
    const [created] = await auditFor(file.id);
    expect(created).toMatchObject({ action: 'create', actorUserId: member.viewer.userId });
    expect(created!.changes).toMatchObject({
      copyId: [null, copy.id],
      gameId: [null, game.id],
      name: [null, 'rules SECRET.pdf'],
    });
    expect(JSON.stringify(created!.changes)).not.toContain('files/');

    expect(await deleteCopyFile(member, file.id)).toBe(true);
    expect((await auditFor(file.id)).filter((r) => r.changes.deletedAt)).toHaveLength(1);
  });

  it('strips paths and control characters from names', () => {
    expect(cleanFileName('..\\..\\evil/rules.pdf')).toBe('rules.pdf');
    expect(cleanFileName('a\u0000b\nc.pdf')).toBe('abc.pdf');
    expect(cleanFileName('x'.repeat(500)).length).toBe(200);
  });
});

describe('copy files and visibility', () => {
  it('open for a kid profile on a normal game', async () => {
    const { game, copy } = await seed();
    const file = await attach(admin, copy.id);
    const detail = await getGameDetail(kid, game.id);
    expect(detail!.copies[0]!.files).toHaveLength(1);
    expect(await getCopyFileForDownload(kid, file.id)).toMatchObject({ name: 'rules SECRET.pdf' });
  });

  it('are withheld from a kid profile when the game hides its images', async () => {
    const { game, copy } = await seed({ visibility: 'hide_images' });
    const file = await attach(admin, copy.id);
    expect((await getGameDetail(kid, game.id))!.copies[0]!.files).toEqual([]);
    expect(await getCopyFileForDownload(kid, file.id)).toBeNull();
    // Adults still see them.
    expect((await getGameDetail(member, game.id))!.copies[0]!.files).toHaveLength(1);
    expect(await getCopyFileForDownload(member, file.id)).not.toBeNull();
  });

  it('are withheld from a kid profile when the game is hidden from it', async () => {
    const { game, copy } = await seed({ visibility: 'hidden_restricted' });
    const file = await attach(admin, copy.id);
    expect(await getGameDetail(kid, game.id)).toBeNull();
    expect(await getCopyFileForDownload(kid, file.id)).toBeNull();
  });

  it('cannot be downloaded once trashed, with the copy or the game', async () => {
    const { game, copy } = await seed();
    const file = await attach(admin, copy.id);
    await deleteCopyFile(admin, file.id);
    expect(await getCopyFileForDownload(admin, file.id)).toBeNull();
    expect((await getGameDetail(admin, game.id))!.copies[0]!.files).toEqual([]);

    const again = await attach(admin, copy.id, 'board.pdf');
    await deleteCopy(admin, copy.id);
    expect(await getCopyFileForDownload(admin, again.id)).toBeNull();
  });

  it('never appear in guest responses, even with locations and notes shown', async () => {
    const { game, copy } = await seed({ shareable: true });
    await attach(admin, copy.id);
    const { token } = await createShareLink(admin, {
      label: 'g',
      showNotes: true,
      showLocations: true,
    });
    const link = (await resolveShareLink(db, token))!;
    const json = JSON.stringify([await guestCatalog(db, link), await guestGame(db, link, game.id)]);
    expect(json).toContain('Hostage Negotiator');
    for (const secret of ['SECRET', 'rules', '.pdf', 'files/', 'storagePath']) {
      expect(json).not.toContain(secret);
    }
  });
});

describe('copy files and the trash', () => {
  it('can be restored, but only with their copy', async () => {
    const { copy } = await seed();
    const file = await attach(member, copy.id);
    await deleteCopyFile(member, file.id);
    expect(await listTrash(member)).toEqual([
      expect.objectContaining({ kind: 'copy_file', id: file.id, title: 'rules SECRET.pdf' }),
    ]);

    await deleteCopy(admin, copy.id);
    expect(await restoreTrashed(admin, 'copy_file', file.id)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/copy/i),
    });
    await restoreTrashed(admin, 'copy', copy.id);
    expect(await restoreTrashed(admin, 'copy_file', file.id)).toEqual({ ok: true });
    expect(await getCopyFileForDownload(admin, file.id)).not.toBeNull();
  });

  it('report their stored paths when deleted for good, alone or with a copy or game', async () => {
    const { copy } = await seed();
    const a = await attach(admin, copy.id, 'a.pdf');
    const b = await attach(admin, copy.id, 'b.pdf');
    const path = (f: { id: string }) => `files/${admin.householdId}/${f.id}.pdf`;

    await deleteCopyFile(admin, a.id);
    expect(await purgeTrashed(admin, 'copy_file', a.id)).toMatchObject({
      ok: true,
      files: [path(a)],
    });

    await deleteCopy(admin, copy.id);
    expect(await purgeTrashed(admin, 'copy', copy.id)).toMatchObject({
      ok: true,
      files: [path(b)],
    });

    // A game takes the files of all its copies.
    const g2 = await createGame(admin, { title: 'Second', type: 'card' });
    const c2 = await addCopy(admin, g2.id, { format: 'print_and_play' });
    const f2 = await attach(admin, c2.id, 'c.pdf');
    await deleteCopy(admin, c2.id);
    expect(await deleteGame(admin, g2.id)).toMatchObject({ ok: true });
    expect(await purgeTrashed(admin, 'game', g2.id)).toMatchObject({ ok: true, files: [path(f2)] });
  });

  it('are reported by the automatic purge too', async () => {
    const { copy } = await seed();
    const lone = await attach(admin, copy.id, 'lone.pdf');
    const withCopy = await attach(admin, copy.id, 'withcopy.pdf');
    await deleteCopyFile(admin, lone.id);
    await deleteCopy(admin, copy.id);
    const later = new Date(Date.now() + 40 * 86_400_000);
    const result = await purgeExpiredTrash(db, later, 30);
    expect(result.files.toSorted()).toEqual(
      [lone, withCopy].map((f) => `files/${admin.householdId}/${f.id}.pdf`).toSorted(),
    );
  });

  it('are only reported for copies that have actually expired', async () => {
    const { game, copy: old } = await seed();
    const recent = await addCopy(admin, game.id, { format: 'print_and_play' });
    const oldFile = await attach(admin, old.id, 'old.pdf');
    const recentFile = await attach(admin, recent.id, 'recent.pdf');
    await deleteCopy(admin, old.id);
    await deleteCopy(admin, recent.id);
    await db
      .update(copies)
      .set({ deletedAt: new Date(Date.now() - 40 * 86_400_000) })
      .where(eq(copies.id, old.id));

    const result = await purgeExpiredTrash(db, new Date(), 30);
    expect(result.files).toEqual([`files/${admin.householdId}/${oldFile.id}.pdf`]);

    // The recent copy and its file are untouched and can still be restored.
    expect(await restoreTrashed(admin, 'copy', recent.id)).toEqual({ ok: true });
    expect(await getCopyFileForDownload(admin, recentFile.id)).not.toBeNull();
  });

  it('are only reported when something has expired at all', async () => {
    const { copy } = await seed();
    await attach(admin, copy.id);
    await deleteCopy(admin, copy.id);
    expect(await purgeExpiredTrash(db, new Date(), 30)).toMatchObject({ purged: 0, files: [] });
  });
});
