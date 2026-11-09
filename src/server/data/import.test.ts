import { beforeEach, describe, expect, it } from 'vitest';

import { setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { parseImport } from '../import/csv';
import { createContext, type DataContext } from './context';
import { listCatalog } from './catalog';
import { getGameDetail } from './games';
import { importGames } from './import';
import { listLocations } from './lookups';

let ctx: DataContext;
beforeEach(async () => {
  const db: Db = await createTestDb();
  const u = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  ctx = createContext(db, u.householdId, { kind: 'user', userId: u.id, role: 'admin' });
});

describe('importGames', () => {
  const csv =
    'title,type,min_players,max_players,minutes,tags,location,platform\n' +
    'Catan,board,3,4,90,strategy,Hall closet,\n' +
    'Zelda,video,,,,adventure,Living room,Switch\n';

  it('creates games, copies, tags and shared locations', async () => {
    const summary = await importGames(ctx, parseImport(csv).rows);
    expect(summary).toEqual({ created: 2, skipped: [] });
    const catalog = await listCatalog(ctx);
    expect(catalog.map((g) => g.title)).toEqual(['Catan', 'Zelda']);
    expect(catalog[1]?.platforms).toEqual(['Switch']);
    expect((await listLocations(ctx)).map((l) => l.name).toSorted()).toEqual([
      'Hall closet',
      'Living room',
    ]);
  });

  it('imports a puzzle with its piece count', async () => {
    const puzzleCsv = 'title,type,pieces\nAlpine Lake,puzzle,1000\n';
    await importGames(ctx, parseImport(puzzleCsv).rows);
    const [game] = await listCatalog(ctx);
    expect((await getGameDetail(ctx, game!.id))?.puzzle?.pieceCount).toBe(1000);
  });

  it('skips games that already exist so re-importing is safe', async () => {
    await importGames(ctx, parseImport(csv).rows);
    const again = await importGames(ctx, parseImport(csv).rows);
    expect(again).toEqual({ created: 0, skipped: ['Catan', 'Zelda'] });
    expect(await listCatalog(ctx)).toHaveLength(2);
  });
});
