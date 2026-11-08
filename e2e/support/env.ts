import path from 'node:path';

export const APP_PORT = 3100;
export const MOCK_PORT = 4010;
export const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

/** Dedicated database; the start script drops and recreates it on every run. */
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://games:games@localhost:5432/games_e2e';

export const DATA_DIR = path.resolve(process.cwd(), 'e2e/.tmp/data');

export const BGG_TOKEN = 'test-token';
