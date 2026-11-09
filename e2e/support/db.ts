// Direct SQL access to the e2e database. Used to seed data quickly and to do things the UI
// cannot (backdate a link, create a second household, inspect stored rows).
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import postgres from 'postgres';

import { DATABASE_URL, DATA_DIR } from './env';
import { TINY_PNG } from './images';
import { ACCOUNTS, ADMIN } from './roles';

export const sql = postgres(DATABASE_URL, { max: 3, onnotice: () => {} });

export type GameType = 'board' | 'card' | 'rpg' | 'video' | 'puzzle' | 'other';

export interface SeedCopy {
  platform?: string | null;
  format?: 'physical' | 'digital';
  condition?: 'unopened' | 'like_new' | 'good' | 'worn' | 'damaged' | 'incomplete';
  priceCents?: number | null;
  ownerEmail?: string | null;
  locationId?: string | null;
}

export interface SeedGame {
  title: string;
  type?: GameType;
  description?: string | null;
  notes?: string | null;
  visibility?: 'normal' | 'hide_images' | 'hidden_restricted';
  shareable?: boolean;
  tags?: string[];
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMinutes?: number | null;
  complexity?: number | null;
  minAge?: number | null;
  system?: string | null;
  bookKind?: string | null;
  cover?: boolean | Buffer;
  /** Seed copies in the same call. */
  copies?: SeedCopy[];
  householdId?: string;
}

const roleEmails = ACCOUNTS.map((a) => a.email);

export async function householdId(): Promise<string> {
  const [row] = await sql`select household_id as id from users where email = ${ADMIN.email}`;
  if (!row) throw new Error('Admin account not created yet (the setup project has not run)');
  return row.id as string;
}

export async function userId(email: string): Promise<string> {
  const [row] = await sql`select id from users where email = ${email}`;
  if (!row) throw new Error(`No user ${email}`);
  return row.id as string;
}

/** Clears everything tests create, keeping the three role accounts and their sessions. */
export async function resetCatalog(): Promise<void> {
  const hh = await householdId().catch(() => null);
  if (!hh) return;
  await sql`delete from households where id <> ${hh}`;
  await sql`delete from users where household_id = ${hh} and email <> all(${roleEmails})`;
  await sql`truncate games, tags, locations, share_links, wishlist_items restart identity cascade`;
  // Players who are not users belong to the test that created them, and so does the audit trail.
  await sql`delete from players where household_id = ${hh} and user_id is null`;
  await sql`truncate audit_log`;
}

export async function seedLocation(name: string, parentId: string | null = null): Promise<string> {
  const hh = await householdId();
  const [row] = await sql`
    insert into locations (household_id, name, parent_id) values (${hh}, ${name}, ${parentId}) returning id`;
  return row!.id as string;
}

export async function seedCopy(gameId: string, c: SeedCopy = {}, hhId?: string): Promise<string> {
  const hh = hhId ?? (await householdId());
  const owner = c.ownerEmail ? await userId(c.ownerEmail) : null;
  const [row] = await sql`
    insert into copies (household_id, game_id, owner_user_id, location_id, format, platform, condition, price_cents)
    values (${hh}, ${gameId}, ${owner}, ${c.locationId ?? null}, ${c.format ?? 'physical'},
            ${c.platform ?? null}, ${c.condition ?? 'good'}, ${c.priceCents ?? null})
    returning id`;
  return row!.id as string;
}

export async function seedGame(g: SeedGame): Promise<string> {
  const hh = g.householdId ?? (await householdId());
  const type = g.type ?? 'board';
  const [row] = await sql`
    insert into games (household_id, title, type, description, notes, visibility, shareable)
    values (${hh}, ${g.title}, ${type}, ${g.description ?? null}, ${g.notes ?? null},
            ${g.visibility ?? 'normal'}, ${g.shareable ?? false})
    returning id`;
  const id = row!.id as string;

  if (type === 'board' || type === 'card') {
    await sql`
      insert into board_game_details (game_id, household_id, min_players, max_players, play_time_minutes, complexity, min_age)
      values (${id}, ${hh}, ${g.minPlayers ?? null}, ${g.maxPlayers ?? null}, ${g.playTimeMinutes ?? null},
              ${g.complexity ?? null}, ${g.minAge ?? null})`;
  }
  if (type === 'rpg') {
    await sql`insert into rpg_details (game_id, household_id, system, book_kind)
              values (${id}, ${hh}, ${g.system ?? null}, ${g.bookKind ?? null})`;
  }
  for (const name of g.tags ?? []) {
    const [existing] =
      await sql`select id from tags where household_id = ${hh} and lower(name) = ${name.toLowerCase()}`;
    const tagId =
      (existing?.id as string | undefined) ??
      ((await sql`insert into tags (household_id, name) values (${hh}, ${name}) returning id`)[0]!
        .id as string);
    await sql`insert into game_tags (household_id, game_id, tag_id) values (${hh}, ${id}, ${tagId})`;
  }
  for (const c of g.copies ?? []) await seedCopy(id, c, hh);
  if (g.cover) await seedCover(id, hh, Buffer.isBuffer(g.cover) ? g.cover : undefined);
  return id;
}

/** Writes a real PNG into DATA_DIR and points the game at it. Returns the relative path. */
export async function seedCover(
  gameId: string,
  hhId?: string,
  image: Buffer = TINY_PNG,
): Promise<string> {
  const hh = hhId ?? (await householdId());
  const rel = path.posix.join('covers', hh, `${gameId}-seed.png`);
  const abs = path.join(DATA_DIR, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, image);
  await sql`update games set cover_image = ${rel} where id = ${gameId}`;
  return rel;
}

export async function seedMany(total: number, prefix = 'Bulk Game'): Promise<void> {
  const hh = await householdId();
  await sql`
    with g as (
      insert into games (household_id, title, type)
      select ${hh}::uuid, ${prefix}::text || ' ' || lpad(n::text, 4, '0'), 'board' from generate_series(1, ${total}::int) n
      returning id)
    insert into board_game_details (game_id, household_id, min_players, max_players, play_time_minutes)
    select id, ${hh}::uuid, 2, 4, 30 from g`;
}

export interface SeedLink {
  label?: string;
  hideTypes?: GameType[];
  hideTags?: string[];
  showNotes?: boolean;
  showLocations?: boolean;
  expiresAt?: Date | null;
  revoked?: boolean;
}

/** Inserts a guest link directly and returns its raw token (the DB only stores the hash). */
export async function seedShareLink(l: SeedLink = {}): Promise<string> {
  const hh = await householdId();
  const token = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await sql`
    insert into share_links (household_id, label, token_hash, hide_types, hide_tags, show_notes, show_locations, expires_at, revoked_at)
    values (${hh}, ${l.label ?? 'e2e link'}, ${hash}, ${l.hideTypes ?? []}, ${l.hideTags ?? []},
            ${l.showNotes ?? false}, ${l.showLocations ?? false}, ${l.expiresAt ?? null},
            ${l.revoked ? new Date() : null})`;
  return token;
}

export const today = () => new Date().toISOString().slice(0, 10);

export async function seedLoan(
  copyId: string,
  l: { borrower?: string; lentOn?: string; dueOn?: string | null; returnedOn?: string | null } = {},
): Promise<void> {
  const hh = await householdId();
  await sql`
    insert into loans (household_id, copy_id, borrower, lent_on, due_on, returned_on)
    values (${hh}, ${copyId}, ${l.borrower ?? 'Neighbor'}, ${l.lentOn ?? today()},
            ${l.dueOn ?? null}, ${l.returnedOn ?? null})`;
}

export async function seedPlay(
  gameId: string,
  p: {
    playedOn?: string;
    /** Player names; players that do not exist yet are created as non-user players. */
    players?: string[];
    minutes?: number | null;
  } = {},
): Promise<void> {
  const hh = await householdId();
  const [play] = await sql`
    insert into play_sessions (household_id, game_id, played_on, duration_minutes)
    values (${hh}, ${gameId}, ${p.playedOn ?? today()}, ${p.minutes ?? null})
    returning id`;
  for (const name of p.players ?? []) {
    const [found] = await sql`
      select id from players where household_id = ${hh} and lower(display_name) = ${name.toLowerCase()}
      order by created_at limit 1`;
    const playerId =
      found?.id ??
      (
        await sql`insert into players (household_id, display_name) values (${hh}, ${name}) returning id`
      )[0]!.id;
    await sql`
      insert into play_participants (household_id, play_id, player_id)
      values (${hh}, ${play!.id}, ${playerId}) on conflict do nothing`;
  }
}

export async function seedWish(
  title: string,
  type: GameType = 'board',
  requestedByEmail?: string,
): Promise<string> {
  const hh = await householdId();
  const by = requestedByEmail ? await userId(requestedByEmail) : null;
  const [row] =
    await sql`insert into wishlist_items (household_id, title, type, requested_by_user_id) values (${hh}, ${title}, ${type}, ${by}) returning id`;
  return row!.id as string;
}

/** A completely separate household with one game, to prove tenant isolation. */
export async function seedOtherHousehold(): Promise<{
  householdId: string;
  gameId: string;
  title: string;
}> {
  const [hh] = await sql`insert into households (name) values ('Other family') returning id`;
  const title = 'Other Family Secret Game';
  const gameId = await seedGame({
    title,
    householdId: hh!.id as string,
    shareable: true,
    cover: true,
    tags: ['otherfam'],
    copies: [{ priceCents: 999 }],
  });
  return { householdId: hh!.id as string, gameId, title };
}

export async function count(table: string, where = 'true'): Promise<number> {
  const [row] = await sql.unsafe(`select count(*)::int as n from ${table} where ${where}`);
  return row!.n as number;
}

export async function gameIdByTitle(title: string): Promise<string> {
  const [row] = await sql`select id from games where title = ${title}`;
  if (!row) throw new Error(`No game titled ${title}`);
  return row.id as string;
}
