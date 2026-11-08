import 'server-only';

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MIME_BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]));

export const dataDir = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR ?? './data');

/** Stores an uploaded image under DATA_DIR/covers and returns its relative path. */
export async function saveCover(householdId: string, gameId: string, file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error('Cover must be a JPEG, PNG, or WebP image');
  if (file.size > MAX_BYTES) throw new Error('Cover must be 8 MB or smaller');
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const rel = path.posix.join('covers', householdId, `${gameId}-${hash}.${ext}`);
  const abs = path.join(/* turbopackIgnore: true */ dataDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return rel;
}

export async function readStored(rel: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const abs = path.resolve(/* turbopackIgnore: true */ dataDir(), rel);
  // Never serve anything outside the data directory.
  if (!abs.startsWith(dataDir() + path.sep)) return null;
  try {
    const bytes = await readFile(abs);
    const mime = MIME_BY_EXT[path.extname(abs).slice(1)] ?? 'application/octet-stream';
    return { bytes, mime };
  } catch {
    return null;
  }
}

export async function removeStored(rel: string | null | undefined) {
  if (!rel) return;
  const abs = path.resolve(/* turbopackIgnore: true */ dataDir(), rel);
  if (abs.startsWith(dataDir() + path.sep)) await rm(abs, { force: true });
}
