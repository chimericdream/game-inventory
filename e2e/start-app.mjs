// Starts the app for end-to-end tests: fresh database, fresh data dir, production build.
// Playwright's webServer launches this and waits for the app to answer.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import postgres from 'postgres';

const port = process.env.E2E_APP_PORT ?? '3100';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const url = new URL(databaseUrl);
const dbName = url.pathname.slice(1);
if (!/^[a-z0-9_]*e2e[a-z0-9_]*$/.test(dbName)) {
  throw new Error(`Refusing to drop "${dbName}": the e2e database name must contain "e2e".`);
}
url.pathname = '/postgres';

const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${dbName} and pid <> pg_backend_pid()`;
await admin.unsafe(`drop database if exists "${dbName}"`);
await admin.unsafe(`create database "${dbName}"`);
await admin.end();

const dataDir = process.env.DATA_DIR;
if (dataDir) {
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
}

const next = path.resolve('node_modules/next/dist/bin/next');
if (process.env.E2E_SKIP_BUILD !== '1') {
  const build = spawnSync(process.execPath, [next, 'build'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, [next, 'start', '-p', port], {
  stdio: 'inherit',
  env: process.env,
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
