import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { addAccessory, deleteAccessory, updateAccessory } from './accessories';
import { catalogFacets, listCatalog } from './catalog';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy } from './copies';
import { createGame, getGameDetail } from './games';
import { createShareLink, guestCatalog, guestGame, resolveShareLink } from './guest';
import { listLendableCopies } from './loans';
import { createLocation, deleteLocation, listLocationsWithCounts } from './lookups';
import { listTrash, purgeExpiredTrash, purgeTrashed, restoreTrashed } from './trash';

let db: Db;
let admin: DataContext;
let member: DataContext;
let kid: DataContext;
let other: DataContext;

beforeEach(async () => {
  db = await createTestDb();
  const a = await setupHousehold(db, {
    householdName: 'Home',
    name: 'Ada',
    email: 'ada@example.com',
    password: 'password123',
  });
  admin = createContext(db, a.householdId, { kind: 'user', userId: a.id, role: 'admin' });
  const make = (name: string, role: 'member' | 'restricted') =>
    createUser(db, a.householdId, {
      name,
      email: `${name.toLowerCase()}@example.com`,
      password: 'password123',
      role,
    });
  const m = await make('Max', 'member');
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });
  const k = await make('Kid', 'restricted');
  kid = createContext(db, a.householdId, { kind: 'user', userId: k.id, role: 'restricted' });
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
  other = createContext(db, h2!.id, { kind: 'user', userId: u2!.id, role: 'admin' });
});

/** Wingspan in the office, with its playmat in the hall closet. */
async function seed(
  extra: { shareable?: boolean; visibility?: 'normal' | 'hide_images' | 'hidden_restricted' } = {},
) {
  const office = await createLocation(admin, 'Office');
  const closet = await createLocation(admin, 'Hall closet');
  const shelf = await createLocation(admin, 'Top shelf', closet.id);
  const game = await createGame(admin, { title: 'Wingspan', type: 'board', ...extra });
  const copy = await addCopy(admin, game.id, { locationId: office.id });
  const mat = await addAccessory(admin, copy.id, {
    name: 'Neoprene playmat',
    kind: 'playmat',
    locationId: shelf.id,
    priceCents: 3500,
    notes: 'SECRET accessory note',
  });
  const trays = await addAccessory(admin, copy.id, {
    name: 'Resource trays',
    kind: 'organizer',
    quantity: 4,
  });
  return { office, closet, shelf, game, copy, mat, trays };
}

const auditFor = (id: string) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, 'accessory'), eq(auditLog.entityId, id)));

describe('accessories', () => {
  it('belong to a copy and show on the game, with where they are kept', async () => {
    const { game, copy } = await seed();
    const detail = await getGameDetail(member, game.id);
    const found = detail!.copies.find((c) => c.id === copy.id)!.accessories;
    expect(found.map((a) => [a.name, a.kind, a.quantity, a.locationName])).toEqual([
      ['Neoprene playmat', 'playmat', 1, 'Hall closet › Top shelf'],
      ['Resource trays', 'organizer', 4, null],
    ]);
  });

  it('writes an audit row for every change, in the same transaction', async () => {
    const { copy, game, mat, office } = await seed();
    const [created] = await auditFor(mat.id);
    expect(created).toMatchObject({ action: 'create', actorUserId: admin.viewer.userId });
    expect(created!.changes).toMatchObject({
      copyId: [null, copy.id],
      gameId: [null, game.id],
      name: [null, 'Neoprene playmat'],
    });

    await updateAccessory(member, mat.id, { name: 'Neoprene playmat', locationId: office.id });
    const rows = await auditFor(mat.id);
    const update = rows.find((r) => r.action === 'update')!;
    expect(update.actorUserId).toBe(member.viewer.userId);
    expect(Object.keys(update.changes)).toEqual(
      expect.arrayContaining(['locationId', 'kind', 'priceCents', 'notes']),
    );

    expect(await deleteAccessory(member, mat.id)).toBe(true);
    const trashed = (await auditFor(mat.id)).filter((r) => r.changes.deletedAt);
    expect(trashed).toHaveLength(1);
  });

  it('validates input and refuses restricted profiles', async () => {
    const { copy, mat } = await seed();
    await expect(addAccessory(admin, copy.id, { name: '  ' })).rejects.toThrow();
    await expect(addAccessory(admin, copy.id, { name: 'x', quantity: 0 })).rejects.toThrow();
    await expect(addAccessory(kid, copy.id, { name: 'x' })).rejects.toThrow(/Restricted/);
    await expect(updateAccessory(kid, mat.id, { name: 'x' })).rejects.toThrow(/Restricted/);
    await expect(deleteAccessory(kid, mat.id)).rejects.toThrow(/Restricted/);
  });

  it('cannot touch another household’s copies or accessories', async () => {
    const { copy, mat } = await seed();
    await expect(addAccessory(other, copy.id, { name: 'x' })).rejects.toThrow(/Copy not found/);
    expect(await updateAccessory(other, mat.id, { name: 'Stolen' })).toBeNull();
    expect(await deleteAccessory(other, mat.id)).toBe(false);
    const otherPlace = await createLocation(other, 'Their attic');
    await expect(
      addAccessory(admin, copy.id, { name: 'x', locationId: otherPlace.id }),
    ).rejects.toThrow(/Unknown location/);
  });

  it('follows the game’s visibility for restricted profiles', async () => {
    const { game } = await seed({ visibility: 'hidden_restricted' });
    expect(await getGameDetail(kid, game.id)).toBeNull();
    const counts = await listLocationsWithCounts(kid);
    expect(counts.find((l) => l.name === 'Hall closet')?.accessories).toBe(0);
    expect(
      (await listLocationsWithCounts(admin)).find((l) => l.name === 'Hall closet'),
    ).toMatchObject({ total: 0, accessories: 1 });
  });
});

describe('accessories in the trash', () => {
  it('a deleted accessory goes to the trash and can be restored', async () => {
    const { game, mat } = await seed();
    await deleteAccessory(member, mat.id);
    const names = async () =>
      (await getGameDetail(admin, game.id))!.copies[0]!.accessories.map((a) => a.name);
    expect(await names()).toEqual(['Resource trays']);

    const trash = await listTrash(member);
    expect(trash).toEqual([
      expect.objectContaining({ kind: 'accessory', id: mat.id, title: 'Neoprene playmat' }),
    ]);
    expect(trash[0]!.detail).toBe('Accessory · Wingspan');

    expect(await restoreTrashed(member, 'accessory', mat.id)).toEqual({ ok: true });
    expect(await names()).toEqual(['Neoprene playmat', 'Resource trays']);
  });

  it('trashing the copy hides its accessories, and restoring it brings them back', async () => {
    const { game, copy, mat, closet } = await seed();
    await deleteCopy(admin, copy.id);
    expect((await getGameDetail(admin, game.id))!.copies).toEqual([]);
    expect(await listCatalog(admin, { locationId: closet.id })).toEqual([]);
    // Its accessories do not each become trash entries.
    expect((await listTrash(admin)).map((t) => t.kind)).toEqual(['copy']);

    await restoreTrashed(admin, 'copy', copy.id);
    const back = (await getGameDetail(admin, game.id))!.copies[0]!.accessories;
    expect(back.map((a) => a.id)).toContain(mat.id);
  });

  it('a copy waits for the places its accessories were kept in', async () => {
    const { copy, shelf } = await seed();
    await deleteCopy(admin, copy.id);
    // A trashed copy's accessories no longer hold their place.
    expect(await deleteLocation(admin, shelf.id)).toEqual({ ok: true });
    expect(await restoreTrashed(admin, 'copy', copy.id)).toEqual({
      ok: false,
      error: 'Restore the place its Neoprene playmat was kept in first.',
    });
    await restoreTrashed(admin, 'location', shelf.id);
    expect(await restoreTrashed(admin, 'copy', copy.id)).toEqual({ ok: true });
  });

  it('an accessory cannot come back while its copy is in the trash', async () => {
    const { copy, mat } = await seed();
    await deleteAccessory(admin, mat.id);
    await deleteCopy(admin, copy.id);
    expect((await listTrash(admin)).find((t) => t.id === mat.id)?.detail).toBe(
      'Accessory · Wingspan · copy is in the trash',
    );
    expect(await restoreTrashed(admin, 'accessory', mat.id)).toEqual({
      ok: false,
      error: 'Restore the copy it belongs to first.',
    });
    // Nor can it be edited while it is gone.
    expect(await updateAccessory(admin, mat.id, { name: 'x' })).toBeNull();
  });

  it('only admins delete permanently, and the purge takes old accessories', async () => {
    const { mat, trays } = await seed();
    await deleteAccessory(member, mat.id);
    await expect(purgeTrashed(member, 'accessory', mat.id)).rejects.toThrow(/admin/);
    expect(await purgeTrashed(admin, 'accessory', mat.id)).toMatchObject({ ok: true });
    expect(await listTrash(admin)).toEqual([]);

    await deleteAccessory(admin, trays.id);
    const later = new Date(Date.now() + 31 * 86_400_000);
    expect(await purgeExpiredTrash(db, later)).toMatchObject({ purged: 1 });
    const purged = (await auditFor(trays.id)).filter((r) => r.action === 'delete');
    expect(purged[0]!.changes).toMatchObject({ automatic: [null, true] });
  });
});

describe('accessories and places', () => {
  it('a place holding an accessory cannot be deleted', async () => {
    const { shelf, mat } = await seed();
    expect(await deleteLocation(admin, shelf.id)).toEqual({
      ok: false,
      reason: 'has_accessories',
      accessories: 1,
    });
    await updateAccessory(admin, mat.id, { name: 'Neoprene playmat', locationId: null });
    expect(await deleteLocation(admin, shelf.id)).toEqual({ ok: true });
  });

  it('the library location filter finds games by an accessory kept there', async () => {
    const { closet, office } = await seed();
    await createGame(admin, { title: 'Elsewhere', type: 'board' });

    const inCloset = await listCatalog(admin, { locationId: closet.id });
    expect(inCloset.map((g) => [g.title, g.storedHere])).toEqual([
      ['Wingspan', ['Neoprene playmat']],
    ]);
    // Where the box is, the tile has nothing extra to say.
    const inOffice = await listCatalog(admin, { locationId: office.id });
    expect(inOffice.map((g) => [g.title, g.storedHere])).toEqual([['Wingspan', []]]);

    const facets = await catalogFacets(admin, {});
    const count = (name: string) => facets.locations.find((l) => l.name === name)?.count;
    expect([count('Office'), count('Hall closet'), count('Top shelf')]).toEqual([1, 1, 1]);
  });

  it('the lend list reminds you about accessories kept apart from the box', async () => {
    await seed();
    expect(await listLendableCopies(admin)).toEqual([
      expect.objectContaining({
        title: 'Wingspan',
        keptElsewhere: ['Neoprene playmat (Hall closet › Top shelf)'],
      }),
    ]);
  });
});

describe('accessories and guest links', () => {
  it('never appear in guest responses, even with locations and notes shown', async () => {
    const { game } = await seed({ shareable: true });
    const { token } = await createShareLink(admin, {
      label: 'g',
      showNotes: true,
      showLocations: true,
    });
    const link = (await resolveShareLink(db, token))!;
    const json = JSON.stringify([await guestCatalog(db, link), await guestGame(db, link, game.id)]);
    expect(json).toContain('Wingspan');
    for (const secret of ['Neoprene', 'Resource trays', 'SECRET', '3500', 'Hall closet']) {
      expect(json).not.toContain(secret);
    }
  });
});
