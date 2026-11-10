import { beforeEach, describe, expect, it } from 'vitest';

import { setupHousehold, createUser } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { addCopy, updateCopy } from './copies';
import { createContext, type DataContext } from './context';
import { listCatalog } from './catalog';
import { createGame, deleteGame, getGameDetail, updateGame } from './games';
import { createLocation } from './lookups';

let db: Db;
let admin: DataContext;
let kid: DataContext;
let otherHousehold: DataContext;

beforeEach(async () => {
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
  // A second household, inserted directly (setup only allows the first).
  const { households, users } = await import('../db/schema');
  const [h2] = await db.insert(households).values({ name: 'Other' }).returning();
  const [u2] = await db
    .insert(users)
    .values({
      householdId: h2!.id,
      name: 'Bo',
      email: 'bo@example.com',
      passwordHash: 'x',
      role: 'admin',
    })
    .returning();
  otherHousehold = createContext(db, h2!.id, { kind: 'user', userId: u2!.id, role: 'admin' });
});

describe('catalog', () => {
  it('creates a board game with details, tags and a copy, and reads it back', async () => {
    const game = await createGame(admin, {
      title: 'Catan',
      type: 'board',
      board: { minPlayers: 3, maxPlayers: 4, playTimeMinutes: 90, complexity: 2 },
      tags: ['Strategy', 'strategy', 'Classic'],
    });
    await addCopy(admin, game.id, { condition: 'good' });
    const detail = await getGameDetail(admin, game.id);
    expect(detail?.board?.maxPlayers).toBe(4);
    expect(detail?.tags.toSorted()).toEqual(['Classic', 'Strategy']);
    expect(detail?.copies).toHaveLength(1);
  });

  it('shows a copy’s full location path and lets it be edited', async () => {
    const office = await createLocation(admin, 'Office');
    const kallax = await createLocation(admin, 'Small Kallax', office.id);
    const game = await createGame(admin, { title: 'Catan', type: 'board', tags: [] });
    const copy = await addCopy(admin, game.id, { locationId: kallax.id, notes: 'Gift' });
    expect((await getGameDetail(admin, game.id))?.copies[0]?.locationName).toBe(
      'Office › Small Kallax',
    );

    await updateCopy(admin, copy.id, {
      locationId: office.id,
      condition: 'worn',
      priceCents: 1999,
      notes: 'Gift',
    });
    const [edited] = (await getGameDetail(admin, game.id))!.copies;
    expect(edited).toMatchObject({
      locationName: 'Office',
      condition: 'worn',
      priceCents: 1999,
      notes: 'Gift',
    });
    await expect(updateCopy(kid, copy.id, { condition: 'good' })).rejects.toThrow(/cannot/);
    expect(await updateCopy(otherHousehold, copy.id, { condition: 'good' })).toBeNull();
  });

  it('filters by players, time, type, tag and search', async () => {
    await createGame(admin, {
      title: 'Catan',
      type: 'board',
      board: { minPlayers: 3, maxPlayers: 4, playTimeMinutes: 90 },
      tags: ['strategy'],
    });
    await createGame(admin, {
      title: 'Uno',
      type: 'card',
      board: { minPlayers: 2, maxPlayers: 10, playTimeMinutes: 20 },
    });
    await createGame(admin, { title: 'Zelda', type: 'video' });

    expect((await listCatalog(admin, { players: 2 })).map((g) => g.title)).toEqual(['Uno']);
    expect((await listCatalog(admin, { maxMinutes: 30 })).map((g) => g.title)).toEqual(['Uno']);
    expect((await listCatalog(admin, { type: 'video' })).map((g) => g.title)).toEqual(['Zelda']);
    expect((await listCatalog(admin, { tag: 'Strategy' })).map((g) => g.title)).toEqual(['Catan']);
    expect((await listCatalog(admin, { search: 'cat' })).map((g) => g.title)).toEqual(['Catan']);
    expect(await listCatalog(admin, { search: '%' })).toHaveLength(0);
  });

  it('stores a puzzle piece count and clears it when the type changes', async () => {
    const game = await createGame(admin, {
      title: 'Alpine Lake',
      type: 'puzzle',
      puzzle: { pieceCount: 1000 },
    });
    expect((await getGameDetail(admin, game.id))?.puzzle?.pieceCount).toBe(1000);
    await updateGame(admin, game.id, { title: 'Alpine Lake', type: 'other' });
    expect((await getGameDetail(admin, game.id))?.puzzle).toBeNull();
  });

  it('stores a publisher, trims it, and clears it when blank', async () => {
    const game = await createGame(admin, {
      title: 'Catan',
      type: 'board',
      publisher: '  Kosmos  ',
    });
    expect((await getGameDetail(admin, game.id))?.game.publisher).toBe('Kosmos');
    await updateGame(admin, game.id, { title: 'Catan', type: 'board', publisher: 'Catan Studio' });
    expect((await getGameDetail(admin, game.id))?.game.publisher).toBe('Catan Studio');
    await updateGame(admin, game.id, { title: 'Catan', type: 'board', publisher: '   ' });
    expect((await getGameDetail(admin, game.id))?.game.publisher).toBeNull();
  });

  it('updates and deletes games', async () => {
    const game = await createGame(admin, { title: 'Old', type: 'board', board: { minPlayers: 2 } });
    await updateGame(admin, game.id, { title: 'New', type: 'rpg', rpg: { system: 'D&D 5e' } });
    const detail = await getGameDetail(admin, game.id);
    expect(detail?.game.title).toBe('New');
    expect(detail?.board).toBeNull();
    expect(detail?.rpg?.system).toBe('D&D 5e');
    expect(await deleteGame(admin, game.id)).toBe(true);
    expect(await getGameDetail(admin, game.id)).toBeNull();
  });
});

describe('visibility for restricted profiles', () => {
  it('hides hidden_restricted games everywhere and strips images for hide_images', async () => {
    const hidden = await createGame(admin, {
      title: 'Secret',
      type: 'board',
      visibility: 'hidden_restricted',
    });
    const noImg = await createGame(admin, {
      title: 'Spooky',
      type: 'board',
      visibility: 'hide_images',
    });
    const { setCoverImage } = await import('./games');
    await setCoverImage(admin, noImg.id, 'covers/x.jpg');

    expect((await listCatalog(kid)).map((g) => g.title)).toEqual(['Spooky']);
    expect((await listCatalog(kid))[0]?.coverImage).toBeNull();
    expect(await getGameDetail(kid, hidden.id)).toBeNull();
    expect((await getGameDetail(kid, noImg.id))?.game.coverImage).toBeNull();
    expect((await listCatalog(admin)).map((g) => g.title)).toEqual(['Secret', 'Spooky']);
  });

  it('refuses edits from restricted profiles', async () => {
    await expect(createGame(kid, { title: 'Nope', type: 'board' })).rejects.toThrow(/cannot edit/);
  });
});

describe('household isolation', () => {
  it('never shows or mutates another household’s games', async () => {
    const game = await createGame(admin, { title: 'Mine', type: 'board' });
    expect(await listCatalog(otherHousehold)).toHaveLength(0);
    expect(await getGameDetail(otherHousehold, game.id)).toBeNull();
    expect(
      await updateGame(otherHousehold, game.id, { title: 'Stolen', type: 'board' }),
    ).toBeNull();
    expect(await deleteGame(otherHousehold, game.id)).toBe(false);
    await expect(addCopy(otherHousehold, game.id, {})).rejects.toThrow(/not found/);
    expect((await getGameDetail(admin, game.id))?.game.title).toBe('Mine');
  });
});

const make = (title: string, extra = {}) => createGame(admin, { title, type: 'board', ...extra });

describe('expansions', () => {
  it('links an expansion to its base, lists it on the base, and keeps it out of the library', async () => {
    const base = await make('Catan');
    const exp = await make('Seafarers', {
      isExpansion: true,
      baseGameId: base.id,
      board: { minPlayers: 3, maxPlayers: 4 },
    });
    expect(exp.standalone).toBe(false);

    const detail = await getGameDetail(admin, base.id);
    expect(detail?.expansions.map((e) => [e.title, e.maxPlayers])).toEqual([['Seafarers', 4]]);
    expect((await getGameDetail(admin, exp.id))?.baseGame?.title).toBe('Catan');

    expect((await listCatalog(admin)).map((g) => g.title)).toEqual(['Catan']);
    expect((await listCatalog(admin, { search: 'seafar' })).map((g) => g.title)).toEqual([
      'Seafarers',
    ]);
  });

  it('ignores base and standalone on a game that is not an expansion', async () => {
    const base = await make('Catan');
    const game = await make('Other', { baseGameId: base.id, standalone: true });
    expect(game).toMatchObject({ isExpansion: false, baseGameId: null, standalone: false });
  });

  it('rejects a base that is missing, in another household, or an expansion itself', async () => {
    const base = await make('Catan');
    const exp = await make('Seafarers', { isExpansion: true, baseGameId: base.id });
    const foreign = await createGame(otherHousehold, { title: 'Theirs', type: 'board' });
    await expect(make('A', { isExpansion: true, baseGameId: foreign.id })).rejects.toThrow(
      'Base game not found',
    );
    await expect(make('B', { isExpansion: true, baseGameId: exp.id })).rejects.toThrow(
      'cannot be the base',
    );
    await expect(
      updateGame(admin, base.id, { title: 'Catan', type: 'board', isExpansion: true }),
    ).rejects.toThrow('expansions of its own');
  });

  it('keeps the expansion when its base game is deleted', async () => {
    const base = await make('Catan');
    const exp = await make('Seafarers', { isExpansion: true, baseGameId: base.id });
    await deleteGame(admin, base.id);
    const detail = await getGameDetail(admin, exp.id);
    expect(detail?.game).toMatchObject({ isExpansion: true, baseGameId: null });
  });

  it('never shows restricted profiles a hidden expansion', async () => {
    const base = await make('Catan');
    await make('Secret', {
      isExpansion: true,
      baseGameId: base.id,
      visibility: 'hidden_restricted',
    });
    expect((await getGameDetail(kid, base.id))?.expansions).toEqual([]);
    expect((await getGameDetail(admin, base.id))?.expansions).toHaveLength(1);
  });
});
