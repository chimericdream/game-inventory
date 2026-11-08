import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Every domain table carries `householdId`. See AGENTS.md: all reads and writes go through
 * the data-access layer in `src/server/data/`, which requires a household context.
 */

export const userRole = pgEnum('user_role', ['admin', 'member', 'restricted']);

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    /** `restricted` is the kid-friendly profile: hidden games/images are enforced for it. */
    role: userRole('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_household_idx').on(t.householdId)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 hash of the cookie token; the raw token is never stored. */
    id: text('id').primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const gameType = pgEnum('game_type', ['board', 'card', 'rpg', 'video', 'puzzle', 'other']);

/**
 * Per-game visibility for household members. `shareable` (separate column) controls guest links.
 * - normal: shown to everyone in the household.
 * - hide_images: listed, but cover/photos are withheld from `restricted` profiles.
 * - hidden_restricted: not shown at all to `restricted` profiles.
 */
export const gameVisibility = pgEnum('game_visibility', [
  'normal',
  'hide_images',
  'hidden_restricted',
]);

export const copyCondition = pgEnum('copy_condition', [
  'new',
  'good',
  'worn',
  'damaged',
  'incomplete',
]);

export const copyFormat = pgEnum('copy_format', ['physical', 'digital']);

/** A title. What we physically/digitally own lives in `copies`. */
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: gameType('type').notNull(),
    description: text('description'),
    coverImage: text('cover_image'),
    visibility: gameVisibility('visibility').notNull().default('normal'),
    /** Guest links only ever see games with `shareable = true` (allowlist by default). */
    shareable: boolean('shareable').notNull().default(false),
    notes: text('notes'),
    /** External IDs for metadata lookup (phase 4). */
    bggId: integer('bgg_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('games_household_title_idx').on(t.householdId, t.title)],
);

/** Details shared by board and card games. */
export const boardGameDetails = pgTable('board_game_details', {
  gameId: uuid('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  minPlayers: integer('min_players'),
  maxPlayers: integer('max_players'),
  playTimeMinutes: integer('play_time_minutes'),
  /** 1 (light) to 5 (heavy). */
  complexity: integer('complexity'),
  minAge: integer('min_age'),
});

export const rpgDetails = pgTable('rpg_details', {
  gameId: uuid('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  /** e.g. "D&D 5e", "Pathfinder 2e". */
  system: text('system'),
  /** e.g. "Core rulebook", "Adventure", "Supplement". */
  bookKind: text('book_kind'),
});

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => locations.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('locations_household_idx').on(t.householdId)],
);

/** What we actually own: a physical box or a digital license. */
export const copies = pgTable(
  'copies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    format: copyFormat('format').notNull().default('physical'),
    /** Console/platform for video games, e.g. "Switch". */
    platform: text('platform'),
    condition: copyCondition('condition').notNull().default('good'),
    acquiredOn: date('acquired_on'),
    priceCents: integer('price_cents'),
    notes: text('notes'),
  },
  (t) => [index('copies_game_idx').on(t.gameId), index('copies_household_idx').on(t.householdId)],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (t) => [index('tags_household_idx').on(t.householdId)],
);

export const gameTags = pgTable(
  'game_tags',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// Guest share links
// ---------------------------------------------------------------------------

/**
 * A read-only link for people outside the household. Guests only ever see games with
 * `shareable = true`, minus whatever the rules below exclude. Private fields (ratings, price,
 * owners, condition) are never exposed; `showNotes` and `showLocations` opt in to the rest.
 */
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    label: text('label').notNull(),
    /** SHA-256 of the URL token; the raw token is shown once at creation. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    hideTypes: text('hide_types')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    hideTags: text('hide_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    showNotes: boolean('show_notes').notNull().default(false),
    showLocations: boolean('show_locations').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('share_links_household_idx').on(t.householdId)],
);
