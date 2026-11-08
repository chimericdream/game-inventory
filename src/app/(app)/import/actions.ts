'use server';

import { revalidatePath } from 'next/cache';

import { requireContext } from '@/server/auth/current';
import { importGames } from '@/server/data/import';
import { parseImport } from '@/server/import/csv';

export interface ImportState {
  error?: string;
  created?: number;
  skipped?: string[];
  rowErrors?: { line: number; message: string }[];
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function importAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') return { error: 'Restricted profiles cannot import.' };
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file.' };
  if (file.size > MAX_BYTES) return { error: 'That file is larger than 2 MB.' };

  const { rows, errors } = parseImport(await file.text());
  if (rows.length === 0)
    return { error: errors[0]?.message ?? 'No rows to import.', rowErrors: errors };
  if (rows.length > 2000) return { error: 'Import at most 2000 rows at a time.' };

  const summary = await importGames(ctx, rows);
  revalidatePath('/games');
  return { created: summary.created, skipped: summary.skipped, rowErrors: errors };
}
