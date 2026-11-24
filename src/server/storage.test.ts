import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  attachableType,
  directoryUsage,
  diskSpace,
  maxFileBytes,
  removeAllStored,
  saveAttachment,
  storedSize,
  streamStored,
  UploadError,
} from './storage';

let dir: string;
const original = process.env.DATA_DIR;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'shelf-storage-'));
  process.env.DATA_DIR = dir;
});

afterEach(async () => {
  if (original === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = original;
  await rm(dir, { recursive: true, force: true });
});

/** A web stream that delivers `parts` one chunk at a time. */
const body = (...parts: Buffer[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(new Uint8Array(p));
      controller.close();
    },
  });

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n');
const filesIn = async (sub: string) => readdir(path.join(dir, sub)).catch(() => []);
const read = async (s: ReadableStream<Uint8Array>) =>
  Buffer.from(await new Response(s).arrayBuffer());

describe('attachableType', () => {
  it('accepts PDF, ZIP and images by extension, in any case', () => {
    expect(attachableType('Rules.PDF')).toEqual({ ext: 'pdf', mime: 'application/pdf' });
    expect(attachableType('cards.zip')?.mime).toBe('application/zip');
    expect(attachableType('a.jpeg')?.mime).toBe('image/jpeg');
    expect(attachableType('a.png')?.mime).toBe('image/png');
  });

  it('rejects everything else', () => {
    for (const name of ['run.exe', 'page.html', 'noext', 'a.pdf.exe', 'x.svg']) {
      expect(attachableType(name)).toBeNull();
    }
  });

  it('rejects names whose extension is an inherited object key', () => {
    for (const name of [
      'rules.constructor',
      'rules.__proto__',
      'rules.toString',
      'rules.hasOwnProperty',
      'rules.valueOf',
    ]) {
      expect(attachableType(name)).toBeNull();
    }
  });
});

describe('maxFileBytes', () => {
  it('defaults to 250 MB and reads MAX_FILE_MB', () => {
    expect(maxFileBytes({})).toBe(250 * 1024 * 1024);
    expect(maxFileBytes({ MAX_FILE_MB: '20' })).toBe(20 * 1024 * 1024);
    expect(maxFileBytes({ MAX_FILE_MB: 'lots' })).toBe(250 * 1024 * 1024);
    expect(maxFileBytes({ MAX_FILE_MB: '-5' })).toBe(250 * 1024 * 1024);
  });
});

describe('saveAttachment', () => {
  it('streams the file to DATA_DIR/files/<household> and reports its size', async () => {
    const saved = await saveAttachment(
      'house',
      'file1',
      'pdf',
      body(PDF.subarray(0, 3), PDF.subarray(3)),
    );
    expect(saved).toEqual({ rel: 'files/house/file1.pdf', size: PDF.length });
    expect(await readFile(path.join(dir, saved.rel))).toEqual(PDF);
    expect(await storedSize(saved.rel)).toBe(PDF.length);
  });

  it('accepts a ZIP, a PNG and a JPEG by their first bytes', async () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1, 2]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 7]);
    await saveAttachment('h', 'z', 'zip', body(zip));
    await saveAttachment('h', 'p', 'png', body(png));
    await saveAttachment('h', 'j', 'jpg', body(jpg));
    expect((await filesIn('files/h')).toSorted()).toEqual(['j.jpg', 'p.png', 'z.zip']);
  });

  it('rejects a file that does not start like its extension, and leaves nothing behind', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(saveAttachment('h', 'bad', 'pdf', body(html))).rejects.toMatchObject({
      status: 400,
    });
    expect(await filesIn('files/h')).toEqual([]);
  });

  it('rejects a file that is too short to check or empty', async () => {
    await expect(saveAttachment('h', 's', 'pdf', body(Buffer.from('%PDF')))).rejects.toBeInstanceOf(
      UploadError,
    );
    await expect(saveAttachment('h', 'e', 'pdf', body())).rejects.toMatchObject({ status: 400 });
    expect(await filesIn('files/h')).toEqual([]);
  });

  it('stops at the size limit and removes the partial file', async () => {
    const chunk = Buffer.concat([PDF, Buffer.alloc(1000)]);
    await expect(
      saveAttachment('h', 'big', 'pdf', body(chunk, chunk, chunk), 2 * chunk.length),
    ).rejects.toMatchObject({ status: 413 });
    expect(await filesIn('files/h')).toEqual([]);
  });

  it('rejects an unsupported extension', async () => {
    await expect(saveAttachment('h', 'x', 'exe', body(PDF))).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an inherited object key as an extension instead of crashing', async () => {
    for (const ext of ['constructor', '__proto__', 'toString']) {
      await expect(saveAttachment('h', 'x', ext, body(PDF))).rejects.toBeInstanceOf(UploadError);
    }
    expect(await filesIn('files/h')).toEqual([]);
  });
});

describe('removeAllStored', () => {
  it('removes every file, and a missing one is not a failure', async () => {
    const a = await saveAttachment('h', 'a', 'pdf', body(PDF));
    const b = await saveAttachment('h', 'b', 'pdf', body(PDF));
    expect(await removeAllStored([a.rel, null, undefined, 'files/h/gone.pdf', b.rel])).toEqual([]);
    expect(await filesIn('files/h')).toEqual([]);
  });

  it('keeps going after one removal fails, and reports which failed', async () => {
    // A directory cannot be removed as a file, so removing it fails.
    await mkdir(path.join(dir, 'files/h/stuck'), { recursive: true });
    const a = await saveAttachment('h', 'a', 'pdf', body(PDF));
    const b = await saveAttachment('h', 'b', 'pdf', body(PDF));
    expect(await removeAllStored([a.rel, 'files/h/stuck', b.rel])).toEqual(['files/h/stuck']);
    expect(await filesIn('files/h')).toEqual(['stuck']);
  });
});

describe('stored files', () => {
  it('stream whole or by byte range', async () => {
    const { rel } = await saveAttachment('h', 'r', 'pdf', body(PDF));
    expect(await read(streamStored(rel))).toEqual(PDF);
    expect(await read(streamStored(rel, { start: 1, end: 3 }))).toEqual(PDF.subarray(1, 4));
  });

  it('never reach outside the data directory', async () => {
    expect(await storedSize('../outside.txt')).toBeNull();
    expect(() => streamStored('../outside.txt')).toThrow();
  });

  it('report a missing file as null', async () => {
    expect(await storedSize('files/h/nope.pdf')).toBeNull();
  });
});

describe('directoryUsage', () => {
  it('adds up every file under a folder, including subfolders', async () => {
    await saveAttachment('h', 'a', 'pdf', body(PDF));
    await saveAttachment('h', 'b', 'pdf', body(PDF, PDF));
    await saveAttachment('other', 'c', 'pdf', body(PDF));
    expect(await directoryUsage('files/h')).toEqual({ bytes: PDF.length * 3, files: 2 });
    expect(await directoryUsage('files')).toEqual({ bytes: PDF.length * 4, files: 3 });
  });

  it('reports a folder that does not exist as empty', async () => {
    expect(await directoryUsage('covers/nobody')).toEqual({ bytes: 0, files: 0 });
  });

  it('never looks outside the data directory', async () => {
    expect(await directoryUsage('..')).toEqual({ bytes: 0, files: 0 });
    expect(await directoryUsage('../')).toEqual({ bytes: 0, files: 0 });
  });
});

describe('diskSpace', () => {
  it('reports the size and free space of the disk holding the data directory', async () => {
    const disk = await diskSpace();
    expect(disk).not.toBeNull();
    expect(disk!.totalBytes).toBeGreaterThan(0);
    expect(disk!.freeBytes).toBeGreaterThanOrEqual(0);
    expect(disk!.freeBytes).toBeLessThanOrEqual(disk!.totalBytes);
  });

  it('is null when the data directory is missing', async () => {
    process.env.DATA_DIR = path.join(dir, 'does-not-exist');
    expect(await diskSpace()).toBeNull();
  });
});
