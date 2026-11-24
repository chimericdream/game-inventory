import 'server-only';

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MIME_BY_EXT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m])),
  pdf: 'application/pdf',
  zip: 'application/zip',
};

/** Attachable file types (print-and-play files): extension → MIME type and the bytes it starts with. */
const FILE_TYPES: Record<string, { mime: string; magic: number[][] }> = {
  pdf: { mime: 'application/pdf', magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  zip: {
    mime: 'application/zip',
    magic: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  },
  png: { mime: 'image/png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
};

export const ATTACHABLE_EXTENSIONS = ['pdf', 'zip', 'png', 'jpg', 'jpeg'] as const;

/** The type of an attachable file from its name, or null if it is not one we accept. */
export function attachableType(fileName: string): { ext: string; mime: string } | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  const type = FILE_TYPES[ext];
  return type ? { ext, mime: type.mime } : null;
}

const DEFAULT_MAX_FILE_MB = 250;

/** Largest attachment accepted, in bytes (MAX_FILE_MB, default 250). */
export function maxFileBytes(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.MAX_FILE_MB?.trim());
  return (Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_FILE_MB) * 1024 * 1024;
}

/** A rejected upload; `status` is the HTTP status to answer with. */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
  }
}

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

/**
 * Streams an uploaded file to DATA_DIR/files without holding it in memory. Rejects (and removes
 * the partial file) if it is larger than `maxBytes` or does not start like a real `ext` file.
 * Returns the relative path and the byte count.
 */
export async function saveAttachment(
  householdId: string,
  fileId: string,
  ext: string,
  body: ReadableStream<Uint8Array>,
  maxBytes = maxFileBytes(),
): Promise<{ rel: string; size: number }> {
  const type = FILE_TYPES[ext];
  if (!type) throw new UploadError('That file type is not supported.', 400);
  const rel = path.posix.join('files', householdId, `${fileId}.${ext}`);
  const abs = path.join(/* turbopackIgnore: true */ dataDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });

  let size = 0;
  let head = Buffer.alloc(0);
  let sniffed = false;
  const sniff = () => {
    sniffed = true;
    const ok = type.magic.some((m) => m.every((byte, i) => head[i] === byte));
    if (!ok) throw new UploadError(`That does not look like a real .${ext} file.`, 400);
  };
  const guard = new Transform({
    transform(chunk: Buffer, _enc, done) {
      try {
        size += chunk.length;
        if (size > maxBytes) {
          throw new UploadError(
            `Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`,
            413,
          );
        }
        if (!sniffed) {
          head = Buffer.concat([head, chunk.subarray(0, 8)]).subarray(0, 8);
          if (head.length >= 8) sniff();
        }
        done(null, chunk);
      } catch (e) {
        done(e as Error);
      }
    },
    flush(done) {
      try {
        if (!sniffed) sniff();
        if (size === 0) throw new UploadError('That file is empty.', 400);
        done();
      } catch (e) {
        done(e as Error);
      }
    },
  });

  try {
    await pipeline(Readable.fromWeb(body as never), guard, createWriteStream(abs));
  } catch (e) {
    await rm(abs, { force: true });
    throw e;
  }
  return { rel, size };
}

/** Size in bytes of a stored file, or null if it is missing or outside the data directory. */
export async function storedSize(rel: string): Promise<number | null> {
  const abs = path.resolve(/* turbopackIgnore: true */ dataDir(), rel);
  if (!abs.startsWith(dataDir() + path.sep)) return null;
  try {
    return (await stat(abs)).size;
  } catch {
    return null;
  }
}

/** A stored file (or an inclusive byte range of it) as a web stream, for large downloads. */
export function streamStored(
  rel: string,
  range?: { start: number; end: number },
): ReadableStream<Uint8Array> {
  const abs = path.resolve(/* turbopackIgnore: true */ dataDir(), rel);
  if (!abs.startsWith(dataDir() + path.sep)) throw new Error('Outside the data directory');
  return Readable.toWeb(createReadStream(abs, range)) as ReadableStream<Uint8Array>;
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

/**
 * Size of the disk that holds DATA_DIR, and how much of it a normal user can still use. In a
 * container this is the volume's host disk. Null if the directory cannot be read.
 */
export async function diskSpace(): Promise<{ totalBytes: number; freeBytes: number } | null> {
  try {
    const s = await statfs(dataDir());
    return { totalBytes: s.blocks * s.bsize, freeBytes: s.bavail * s.bsize };
  } catch {
    return null;
  }
}

/** Bytes and file count under a folder of DATA_DIR (0 if it does not exist). */
export async function directoryUsage(rel: string): Promise<{ bytes: number; files: number }> {
  const root = path.resolve(/* turbopackIgnore: true */ dataDir(), rel);
  const total = { bytes: 0, files: 0 };
  if (!root.startsWith(dataDir() + path.sep)) return total;
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries.map(async (e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        if (!e.isFile()) return;
        const s = await stat(full).catch(() => null);
        if (s) {
          total.bytes += s.size;
          total.files += 1;
        }
      }),
    );
  };
  await walk(root);
  return total;
}
