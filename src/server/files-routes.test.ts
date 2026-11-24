import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUser, setupHousehold } from './auth/accounts';
import type { DataContext } from './data/context';
import { createContext } from './data/context';
import { addCopy } from './data/copies';
import { createGame } from './data/games';
import type { Db } from './db/client';
import { createTestDb } from './db/test-db';

vi.mock('server-only', () => ({}));

/** Who the routes think is signed in; each test sets it. */
let signedIn: DataContext | null = null;
vi.mock('@/server/auth/current', () => ({ getApiContext: async () => signedIn }));

import { GET } from '../app/api/files/[id]/route';
import { POST } from '../app/api/copies/[id]/files/route';

let db: Db;
let dir: string;
let admin: DataContext;
let kid: DataContext;
const original = { dir: process.env.DATA_DIR, max: process.env.MAX_FILE_MB };

const PDF = Buffer.from('%PDF-1.7\n' + 'x'.repeat(200));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'shelf-routes-'));
  process.env.DATA_DIR = dir;
  delete process.env.MAX_FILE_MB;
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
  signedIn = admin;
});

afterEach(async () => {
  for (const [key, value] of [
    ['DATA_DIR', original.dir],
    ['MAX_FILE_MB', original.max],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

async function seed(
  format: 'print_and_play' | 'physical' = 'print_and_play',
  visibility?: 'hide_images',
) {
  const game = await createGame(admin, { title: 'Gloom', type: 'card', visibility });
  const copy = await addCopy(admin, game.id, { format });
  return { game, copy };
}

const upload = (
  copyId: string,
  body: BodyInit | null,
  { name = 'rules.pdf', type = 'application/octet-stream' } = {},
) =>
  POST(
    new Request(`http://app.test/api/copies/${copyId}/files?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': type },
      body,
    }),
    { params: Promise.resolve({ id: copyId }) },
  );

const download = (fileId: string, init: RequestInit & { query?: string } = {}) =>
  GET(new Request(`http://app.test/api/files/${fileId}${init.query ?? ''}`, init), {
    params: Promise.resolve({ id: fileId }),
  });

const stored = async () => readdir(path.join(dir, 'files', admin.householdId)).catch(() => []);

describe('POST /api/copies/[id]/files', () => {
  it('stores the file and serves the same bytes back', async () => {
    const { copy } = await seed();
    const res = await upload(copy.id, PDF);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(await stored()).toEqual([`${id}.pdf`]);

    const got = await download(id);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toBe('application/pdf');
    expect(got.headers.get('content-disposition')).toMatch(/^inline; filename="rules\.pdf"/);
    expect(got.headers.get('accept-ranges')).toBe('bytes');
    expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await got.arrayBuffer())).toEqual(PDF);
  });

  it('needs a signed-in member', async () => {
    const { copy } = await seed();
    signedIn = null;
    expect((await upload(copy.id, PDF)).status).toBe(401);
    signedIn = kid;
    expect((await upload(copy.id, PDF)).status).toBe(403);
    expect(await stored()).toEqual([]);
  });

  it('refuses a request that is not a raw file body', async () => {
    const { copy } = await seed();
    const form = new FormData();
    form.set('file', new Blob([PDF]), 'rules.pdf');
    expect((await upload(copy.id, form, { type: 'multipart/form-data' })).status).toBe(415);
    expect((await upload(copy.id, PDF, { type: 'text/plain' })).status).toBe(415);
    expect(await stored()).toEqual([]);
  });

  it('refuses types it does not accept and files that are not what they claim', async () => {
    const { copy } = await seed();
    expect((await upload(copy.id, PDF, { name: 'run.exe' })).status).toBe(415);
    expect((await upload(copy.id, PDF, { name: '' })).status).toBe(415);
    expect((await upload(copy.id, '<html></html>!!!!', { name: 'page.pdf' })).status).toBe(400);
    expect((await upload(copy.id, new Uint8Array(0))).status).toBe(400);
    expect(await stored()).toEqual([]);
  });

  it('refuses a copy that is not print & play', async () => {
    const { copy } = await seed('physical');
    expect((await upload(copy.id, PDF)).status).toBe(404);
    expect((await upload('not-a-uuid', PDF)).status).toBe(404);
    expect(await stored()).toEqual([]);
  });

  it('refuses a file over MAX_FILE_MB, before and while it streams', async () => {
    process.env.MAX_FILE_MB = '1';
    const { copy } = await seed();
    const big = Buffer.concat([PDF, Buffer.alloc(1024 * 1024)]);
    const res = await upload(copy.id, big);
    expect(res.status).toBe(413);
    expect(await res.text()).toMatch(/1\.0 MB/);
    expect(await stored()).toEqual([]);
  });
});

/** Uploads a PDF to a fresh print & play copy and returns the new file's id. */
async function uploaded(visibility?: 'hide_images') {
  const { copy } = await seed('print_and_play', visibility);
  const res = await upload(copy.id, PDF);
  return ((await res.json()) as { id: string }).id;
}

describe('GET /api/files/[id]', () => {
  it('answers byte ranges so a phone viewer can jump around', async () => {
    const id = await uploaded();
    const part = await download(id, { headers: { Range: 'bytes=0-8' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-8/${PDF.length}`);
    expect(part.headers.get('content-length')).toBe('9');
    expect(Buffer.from(await part.arrayBuffer()).toString()).toBe('%PDF-1.7\n');

    const tail = await download(id, { headers: { Range: 'bytes=-5' } });
    expect(Buffer.from(await tail.arrayBuffer())).toEqual(PDF.subarray(PDF.length - 5));

    const open = await download(id, { headers: { Range: `bytes=${PDF.length - 3}-` } });
    expect(Buffer.from(await open.arrayBuffer())).toEqual(PDF.subarray(PDF.length - 3));

    const beyond = await download(id, { headers: { Range: `bytes=${PDF.length + 10}-` } });
    expect(beyond.status).toBe(416);
    expect(beyond.headers.get('content-range')).toBe(`bytes */${PDF.length}`);
    expect((await download(id, { headers: { Range: 'nonsense' } })).status).toBe(416);
  });

  it('forces a download on request, and for ZIPs', async () => {
    const id = await uploaded();
    const dl = await download(id, { query: '?download' });
    expect(dl.headers.get('content-disposition')).toMatch(/^attachment;/);

    const { copy } = await seed();
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1]);
    const res = await upload(copy.id, zip, { name: 'cards.zip' });
    const zipId = ((await res.json()) as { id: string }).id;
    const got = await download(zipId);
    expect(got.headers.get('content-type')).toBe('application/zip');
    expect(got.headers.get('content-disposition')).toMatch(/^attachment;/);
  });

  it('keeps non-ASCII names intact', async () => {
    const { copy } = await seed();
    const res = await upload(copy.id, PDF, { name: 'Règles du jeu.pdf' });
    const id = ((await res.json()) as { id: string }).id;
    const got = await download(id);
    expect(got.headers.get('content-disposition')).toContain(
      `filename*=UTF-8''${encodeURIComponent('Règles du jeu.pdf')}`,
    );
  });

  it('percent-encodes the characters RFC 8187 does not allow in filename*', async () => {
    const { copy } = await seed();
    const res = await upload(copy.id, PDF, { name: "L'île (1)*.pdf" });
    const id = ((await res.json()) as { id: string }).id;
    const header = (await download(id)).headers.get('content-disposition')!;
    const encoded = header.split("filename*=UTF-8''")[1]!;
    expect(encoded).toBe('L%27%C3%AEle%20%281%29%2A.pdf');
    expect(encoded).not.toMatch(/['()*]/);
  });

  it('needs a signed-in user, and answers 404 for anything it should not reveal', async () => {
    const id = await uploaded();
    signedIn = null;
    expect((await download(id)).status).toBe(401);

    signedIn = admin;
    expect((await download('not-a-uuid')).status).toBe(404);
    expect((await download('00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('hides files of a hide_images game from a kid profile, but not from adults', async () => {
    const id = await uploaded('hide_images');
    signedIn = kid;
    expect((await download(id)).status).toBe(404);
    signedIn = admin;
    expect((await download(id)).status).toBe(200);
  });

  it('is a 404 once the bytes are gone from disk', async () => {
    const id = await uploaded();
    await rm(path.join(dir, 'files', admin.householdId, `${id}.pdf`));
    expect((await download(id)).status).toBe(404);
  });
});
