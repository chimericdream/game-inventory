import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { auditLog, copies, locations } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy, deleteCopy } from './copies';
import { createGame } from './games';
import { createLocation, deleteLocation, listLocationOptions } from './lookups';

let db: Db;
let admin: DataContext;
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
  const k = await createUser(db, a.householdId, {
    name: 'Kid',
    email: 'kid@example.com',
    password: 'password123',
    role: 'restricted',
  });
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

describe('deleting a location', () => {
  it('deletes an empty location and records it', async () => {
    const hall = await createLocation(admin, 'Hall');
    expect(await deleteLocation(admin, hall.id)).toEqual({ ok: true });
    expect(await db.select().from(locations).where(eq(locations.id, hall.id))).toHaveLength(0);
    const entry = (await db.select().from(auditLog)).find(
      (e) => e.entityType === 'location' && e.action === 'delete',
    );
    expect(entry?.changes.name).toEqual(['Hall', null]);
  });

  it('refuses a location that holds copies, and leaves the copies where they are', async () => {
    const hall = await createLocation(admin, 'Hall');
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, { locationId: hall.id });
    expect(await deleteLocation(admin, hall.id)).toEqual({
      ok: false,
      reason: 'has_copies',
      copies: 1,
    });
    const [still] = await db.select().from(copies).where(eq(copies.id, copy.id));
    expect(still?.locationId).toBe(hall.id);
    expect(await db.select().from(locations).where(eq(locations.id, hall.id))).toHaveLength(1);
  });

  it('counts copies anywhere underneath, so a parent cannot be deleted either', async () => {
    const basement = await createLocation(admin, 'Basement');
    const shelf = await createLocation(admin, 'Shelf 3', basement.id);
    const bin = await createLocation(admin, 'Bin', shelf.id);
    const game = await createGame(admin, { title: 'Catan', type: 'board' });
    const copy = await addCopy(admin, game.id, { locationId: bin.id });
    await addCopy(admin, game.id, { locationId: shelf.id });
    expect(await deleteLocation(admin, basement.id)).toEqual({
      ok: false,
      reason: 'has_copies',
      copies: 2,
    });
    // Once the copies are gone, the sub-locations still block until they are removed first.
    await deleteCopy(admin, copy.id);
    await db.delete(copies);
    expect(await deleteLocation(admin, basement.id)).toEqual({
      ok: false,
      reason: 'has_children',
      children: 1,
    });
    expect(await deleteLocation(admin, bin.id)).toEqual({ ok: true });
    expect(await deleteLocation(admin, shelf.id)).toEqual({ ok: true });
    expect(await deleteLocation(admin, basement.id)).toEqual({ ok: true });
  });

  it('handles unknown ids, other households and restricted profiles', async () => {
    const hall = await createLocation(admin, 'Hall');
    expect(await deleteLocation(admin, crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(await deleteLocation(admin, 'not-a-uuid')).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteLocation(other, hall.id)).toEqual({ ok: false, reason: 'not_found' });
    await expect(deleteLocation(kid, hall.id)).rejects.toThrow(/cannot/);
    expect(await db.select().from(locations).where(eq(locations.id, hall.id))).toHaveLength(1);
  });

  it('will not create a location under another household’s parent', async () => {
    const theirs = await createLocation(other, 'Their attic');
    await expect(createLocation(admin, 'Mine', theirs.id)).rejects.toThrow(/Unknown parent/);
  });

  it('orders picker options as a tree with children directly under their parent', async () => {
    const office = await createLocation(admin, 'Office');
    await createLocation(admin, 'Big Kallax', office.id);
    const small = await createLocation(admin, 'Small bookcase', office.id);
    await createLocation(admin, 'Attic');
    await createLocation(admin, 'Top shelf', small.id);
    expect((await listLocationOptions(admin)).map((o) => o.label)).toEqual([
      'Attic',
      'Office',
      'Office › Big Kallax',
      'Office › Small bookcase',
      'Office › Small bookcase › Top shelf',
    ]);
  });
});
