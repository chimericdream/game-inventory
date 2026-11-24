import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let databaseUp = true;
vi.mock('@/server/db/client', () => ({
  getDb: () => ({
    execute: async () => {
      if (!databaseUp) throw new Error('connection refused to db.internal:5432');
      return [];
    },
  }),
}));

let disk: { totalBytes: number; freeBytes: number } | null = null;
vi.mock('@/server/storage', async (original) => ({
  ...(await original<typeof import('@/server/storage')>()),
  diskSpace: async () => disk,
}));

import { GET } from './route';

const GB = 1024 ** 3;
let dir: string;
const saved = { dir: process.env.DATA_DIR, version: process.env.APP_VERSION };

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'shelf-healthz-'));
  process.env.DATA_DIR = dir;
  process.env.APP_VERSION = '9.9.9';
  databaseUp = true;
  disk = { totalBytes: 100 * GB, freeBytes: 50 * GB };
});

afterEach(async () => {
  for (const [key, value] of [
    ['DATA_DIR', saved.dir],
    ['APP_VERSION', saved.version],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

describe('GET /healthz', () => {
  it('is ok when the database answers and the disk has room', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: '9.9.9' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('stays ok at 89% used and degrades at 90%', async () => {
    disk = { totalBytes: 100 * GB, freeBytes: 11 * GB };
    expect((await (await GET()).json()).status).toBe('ok');

    disk = { totalBytes: 100 * GB, freeBytes: 10 * GB };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'degraded',
      message: 'disk almost full',
      version: '9.9.9',
    });
  });

  it('stays ok when the disk cannot be measured', async () => {
    disk = null;
    expect((await (await GET()).json()).status).toBe('ok');
  });

  it('leaks no sizes or paths when degraded', async () => {
    disk = { totalBytes: 100 * GB, freeBytes: 1 * GB };
    const text = JSON.stringify(await (await GET()).json());
    expect(text).not.toContain(dir);
    expect(text).not.toMatch(/\d+ ?GB|bytes/i);
  });

  it('answers 503 when the database is down, without the error text', async () => {
    databaseUp = false;
    const res = await GET();
    expect(res.status).toBe(503);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('"status":"error"');
    expect(text).not.toContain('db.internal');
  });

  it('reports a data directory problem before the disk', async () => {
    disk = { totalBytes: 100 * GB, freeBytes: 1 * GB };
    const file = path.join(dir, 'not-a-directory');
    await writeFile(file, 'x');
    process.env.DATA_DIR = file;
    expect((await (await GET()).json()).message).toBe('data directory not writable');
  });
});
