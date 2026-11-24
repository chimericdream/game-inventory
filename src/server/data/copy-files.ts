import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { copies, copyFiles, games } from '../db/schema';
import {
  createdFields,
  recordAudit,
  stampCreate,
  stampTrash,
  stampUpdate,
  trashedFields,
} from './audit';
import type { DataContext } from './context';
import { isUuid } from './ids';
import { gameVisibilityCondition } from './visibility';

/**
 * Files attached to a copy: the PDFs, ZIPs and images of a print-and-play game. Only the household
 * can open them. Guest links never reach this module, and a kid profile cannot open the files of a
 * game whose images are hidden from it. Reads for the game page go through `getGameDetail`.
 */

function assertCanEdit(ctx: DataContext) {
  if (ctx.viewer.role === 'restricted') throw new Error('Restricted profiles cannot edit files');
}

/** Whether this viewer may see the files of a game with this visibility. */
export const canSeeFiles = (ctx: DataContext, gameVisibility: string) =>
  !(ctx.viewer.role === 'restricted' && gameVisibility === 'hide_images');

/** A file name safe to show and to put in a download header: no path, no control characters. */
export function cleanFileName(raw: string): string {
  const base = raw.replace(/\\/g, '/').split('/').pop() ?? '';
  const printable = [...base].filter((ch) => {
    const code = ch.charCodeAt(0);
    return code > 31 && code !== 127;
  });
  return printable.join('').trim().slice(0, 200);
}

/**
 * Checks, before any bytes are read, that this viewer may attach files to this copy: it must be a
 * live print-and-play copy of a live game in their household. Returns null if not.
 */
export async function prepareCopyFileUpload(ctx: DataContext, copyId: string) {
  assertCanEdit(ctx);
  if (!isUuid(copyId)) return null;
  const [row] = await ctx.db
    .select({ copyId: copies.id, gameId: copies.gameId })
    .from(copies)
    .innerJoin(games, eq(games.id, copies.gameId))
    .where(
      and(
        eq(copies.id, copyId),
        eq(copies.householdId, ctx.householdId),
        eq(copies.format, 'print_and_play'),
        isNull(copies.deletedAt),
        isNull(games.deletedAt),
      ),
    );
  return row ?? null;
}

export interface NewCopyFile {
  /** Chosen by the caller so it matches the stored file's name. */
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
}

export async function addCopyFile(ctx: DataContext, copyId: string, file: NewCopyFile) {
  const target = await prepareCopyFileUpload(ctx, copyId);
  if (!target) throw new Error('Copy not found');
  const name = cleanFileName(file.name);
  if (!name) throw new Error('Give the file a name.');
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(copyFiles)
      .values({
        id: file.id,
        householdId: ctx.householdId,
        copyId,
        name,
        mime: file.mime,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
        ...stampCreate(ctx),
      })
      .returning();
    await recordAudit(tx, ctx, {
      entityType: 'copy_file',
      entityId: row!.id,
      action: 'create',
      changes: {
        copyId: [null, copyId],
        gameId: [null, target.gameId],
        ...createdFields({ name, sizeBytes: row!.sizeBytes }),
      },
    });
    return row!;
  });
}

/** Moves a file to the trash. The stored bytes stay until it is deleted for good. */
export async function deleteCopyFile(ctx: DataContext, fileId: string): Promise<boolean> {
  assertCanEdit(ctx);
  if (!isUuid(fileId)) return false;
  return ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ file: copyFiles, gameId: copies.gameId })
      .from(copyFiles)
      .innerJoin(copies, eq(copies.id, copyFiles.copyId))
      .where(
        and(
          eq(copyFiles.id, fileId),
          eq(copyFiles.householdId, ctx.householdId),
          isNull(copyFiles.deletedAt),
          isNull(copies.deletedAt),
        ),
      );
    if (!found) return false;
    await tx
      .update(copyFiles)
      .set({ ...stampTrash(ctx), ...stampUpdate(ctx) })
      .where(eq(copyFiles.id, fileId));
    await recordAudit(tx, ctx, {
      entityType: 'copy_file',
      entityId: fileId,
      action: 'update',
      changes: trashedFields({
        copyId: found.file.copyId,
        gameId: found.gameId,
        name: found.file.name,
      }),
    });
    return true;
  });
}

export interface CopyFileRow {
  id: string;
  copyId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  createdAt: Date;
}

/**
 * Live files for these copies, oldest first. The caller has already checked that the viewer may
 * see the copies' game (including `canSeeFiles`). The storage path is never returned.
 */
export async function filesForCopies(ctx: DataContext, copyIds: string[]): Promise<CopyFileRow[]> {
  if (copyIds.length === 0) return [];
  return ctx.db
    .select({
      id: copyFiles.id,
      copyId: copyFiles.copyId,
      name: copyFiles.name,
      mime: copyFiles.mime,
      sizeBytes: copyFiles.sizeBytes,
      createdAt: copyFiles.createdAt,
    })
    .from(copyFiles)
    .where(
      and(
        eq(copyFiles.householdId, ctx.householdId),
        isNull(copyFiles.deletedAt),
        inArray(copyFiles.copyId, copyIds),
      ),
    )
    .orderBy(asc(copyFiles.createdAt), asc(copyFiles.id));
}

/**
 * A file this viewer may download, with where its bytes are stored. Null if it does not exist, is
 * in the trash, belongs to another household, or its game is hidden from this viewer.
 */
export async function getCopyFileForDownload(ctx: DataContext, fileId: string) {
  if (!isUuid(fileId)) return null;
  const [row] = await ctx.db
    .select({
      name: copyFiles.name,
      mime: copyFiles.mime,
      sizeBytes: copyFiles.sizeBytes,
      storagePath: copyFiles.storagePath,
      visibility: games.visibility,
    })
    .from(copyFiles)
    .innerJoin(copies, eq(copies.id, copyFiles.copyId))
    .innerJoin(games, eq(games.id, copies.gameId))
    .where(
      and(
        eq(copyFiles.id, fileId),
        eq(copyFiles.householdId, ctx.householdId),
        isNull(copyFiles.deletedAt),
        isNull(copies.deletedAt),
        gameVisibilityCondition(ctx),
      ),
    );
  if (!row || !canSeeFiles(ctx, row.visibility)) return null;
  return row;
}
