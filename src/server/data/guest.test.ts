import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, setupHousehold } from '../auth/accounts';
import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { createContext, type DataContext } from './context';
import { addCopy } from './copies';
import { createGame, setCoverImage } from './games';
import {
  createShareLink,
  guestCatalog,
  guestGame,
  listShareLinks,
  resolveShareLink,
  revokeShareLink,
} from './guest';
import { createLocation } from './lookups';

let db: Db;
let admin: DataContext;
let member: DataContext;
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
  const m = await createUser(db, a.householdId, {
    name: 'Mo',
    email: 'mo@example.com',
    password: 'password123',
    role: 'member',
  });
  member = createContext(db, a.householdId, { kind: 'user', userId: m.id, role: 'member' });

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

async function seed() {
  const loc = await createLocation(admin, 'Hall closet');
  const shared = await createGame(admin, {
    title: 'Catan',
    type: 'board',
    shareable: true,
    notes: 'PRIVATE NOTE: lent to Bob',
    tags: ['strategy'],
    board: { minPlayers: 3, maxPlayers: 4 },
  });
  await addCopy(admin, shared.id, {
    ownerUserId: member.viewer.userId,
    locationId: loc.id,
    priceCents: 4999,
    condition: 'worn',
    platform: null,
  });
  await createGame(admin, { title: 'Not Shared', type: 'board', shareable: false });
  await createGame(admin, {
    title: 'Hidden Kid Game',
    type: 'board',
    shareable: true,
    visibility: 'hidden_restricted',
  });
  const noImg = await createGame(admin, {
    title: 'No Pictures',
    type: 'board',
    shareable: true,
    visibility: 'hide_images',
  });
  await setCoverImage(admin, noImg.id, 'covers/x.jpg');
  await createGame(admin, { title: 'Adult Game', type: 'card', shareable: true, tags: ['Mature'] });
  await createGame(admin, { title: 'Zelda', type: 'video', shareable: true });
  return { shared };
}

describe('share links', () => {
  it('only admins can create, list, or revoke links', async () => {
    await expect(createShareLink(member, { label: 'x' })).rejects.toThrow(/admins/);
    await expect(listShareLinks(member)).rejects.toThrow(/admins/);
    const { link } = await createShareLink(admin, { label: 'x' });
    await expect(revokeShareLink(member, link.id)).rejects.toThrow(/admins/);
  });

  it('resolves a valid token and rejects unknown, revoked, and expired ones', async () => {
    const { link, token } = await createShareLink(admin, { label: 'trip' });
    expect((await resolveShareLink(db, token))?.id).toBe(link.id);
    expect(await resolveShareLink(db, 'nope')).toBeNull();

    await revokeShareLink(admin, link.id);
    expect(await resolveShareLink(db, token)).toBeNull();

    const expired = await createShareLink(admin, { label: 'old', expiresInDays: 1 });
    const { shareLinks } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db
      .update(shareLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(shareLinks.id, expired.link.id));
    expect(await resolveShareLink(db, expired.token)).toBeNull();
  });

  it('cannot revoke another household’s link', async () => {
    const { link } = await createShareLink(admin, { label: 'mine' });
    expect(await revokeShareLink(other, link.id)).toBe(false);
  });

  it('stores only a hash of the token', async () => {
    const { link, token } = await createShareLink(admin, { label: 'x' });
    expect(link.tokenHash).not.toContain(token);
  });
});

describe('guest catalog', () => {
  it('shows only shareable games that are not hidden from restricted viewers', async () => {
    await seed();
    const { link } = await createShareLink(admin, { label: 'g' });
    const titles = (
      await guestCatalog(
        db,
        (await resolveShareLink(db, (await createShareLink(admin, { label: 'g2' })).token))!,
      )
    ).map((g) => g.title);
    expect(titles).toEqual(['Adult Game', 'Catan', 'No Pictures', 'Zelda']);
    expect(link.id).toBeTruthy();
  });

  it('never leaks private fields by default', async () => {
    const { shared } = await seed();
    const { token } = await createShareLink(admin, { label: 'g' });
    const link = (await resolveShareLink(db, token))!;
    const game = await guestGame(db, link, shared.id);
    expect(game).not.toBeNull();
    const json = JSON.stringify(game);
    expect(json).not.toContain('PRIVATE NOTE');
    expect(json).not.toContain('4999');
    expect(json).not.toContain('Hall closet');
    expect(json).not.toContain('worn');
    expect(json).not.toContain(member.viewer.userId);
    expect(game?.notes).toBeNull();
    expect(game?.locations).toEqual([]);
  });

  it('reveals notes and locations only when the link opts in', async () => {
    const { shared } = await seed();
    const { token } = await createShareLink(admin, {
      label: 'g',
      showNotes: true,
      showLocations: true,
    });
    const game = await guestGame(db, (await resolveShareLink(db, token))!, shared.id);
    expect(game?.notes).toContain('PRIVATE NOTE');
    expect(game?.locations).toEqual(['Hall closet']);
    expect(JSON.stringify(game)).not.toContain('4999');
  });

  it('applies per-link type and tag exclusions', async () => {
    await seed();
    const { token } = await createShareLink(admin, {
      label: 'g',
      hideTypes: ['video'],
      hideTags: ['mature'],
    });
    const titles = (await guestCatalog(db, (await resolveShareLink(db, token))!)).map(
      (g) => g.title,
    );
    expect(titles).toEqual(['Catan', 'No Pictures']);
  });

  it('strips cover images for hide_images games', async () => {
    await seed();
    const { token } = await createShareLink(admin, { label: 'g' });
    const games = await guestCatalog(db, (await resolveShareLink(db, token))!, {
      search: 'pictures',
    });
    expect(games[0]?.coverImage).toBeNull();
  });

  it('never returns games from another household', async () => {
    await seed();
    await createGame(other, { title: 'Other House Game', type: 'board', shareable: true });
    const { token } = await createShareLink(admin, { label: 'g' });
    const titles = (await guestCatalog(db, (await resolveShareLink(db, token))!)).map(
      (g) => g.title,
    );
    expect(titles).not.toContain('Other House Game');
  });
});
