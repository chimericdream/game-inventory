import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
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

/** Who created or last changed a row. Nullable so deleting a user never deletes history. */
const authorship = () => ({
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
});

const stamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
  'unopened',
  'like_new',
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
    publisher: text('publisher'),
    coverImage: text('cover_image'),
    visibility: gameVisibility('visibility').notNull().default('normal'),
    /** Guest links only ever see games with `shareable = true` (allowlist by default). */
    shareable: boolean('shareable').notNull().default(false),
    notes: text('notes'),
    /** External IDs for metadata lookup (phase 4). */
    bggId: integer('bgg_id'),
    /** An expansion is a full game row that also points at the game it expands. */
    isExpansion: boolean('is_expansion').notNull().default(false),
    /** The game this expands. Cleared (the expansion stays) if the base game is deleted. */
    baseGameId: uuid('base_game_id').references((): AnyPgColumn => games.id, {
      onDelete: 'set null',
    }),
    /** Expansions only: playable on its own, without the base game. */
    standalone: boolean('standalone').notNull().default(false),
    ...authorship(),
    ...stamps(),
  },
  (t) => [
    index('games_household_title_idx').on(t.householdId, t.title),
    index('games_base_game_idx').on(t.baseGameId),
  ],
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

export const puzzleDetails = pgTable('puzzle_details', {
  gameId: uuid('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  pieceCount: integer('piece_count'),
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
    ...authorship(),
    ...stamps(),
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
    /** Optional detail about the condition, e.g. "worn box corner". */
    conditionNotes: text('condition_notes'),
    acquiredOn: date('acquired_on'),
    priceCents: integer('price_cents'),
    notes: text('notes'),
    ...authorship(),
    ...stamps(),
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

// ---------------------------------------------------------------------------
// Loans, wishlist, play log
// ---------------------------------------------------------------------------

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    copyId: uuid('copy_id')
      .notNull()
      .references(() => copies.id, { onDelete: 'cascade' }),
    borrower: text('borrower').notNull(),
    lentOn: date('lent_on').notNull(),
    dueOn: date('due_on'),
    returnedOn: date('returned_on'),
    notes: text('notes'),
    ...authorship(),
    ...stamps(),
  },
  (t) => [index('loans_household_idx').on(t.householdId), index('loans_copy_idx').on(t.copyId)],
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: gameType('type').notNull().default('board'),
    url: text('url'),
    priceCents: integer('price_cents'),
    notes: text('notes'),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...authorship(),
    ...stamps(),
  },
  (t) => [index('wishlist_household_idx').on(t.householdId)],
);

/**
 * Someone who can appear in a play. A player may or may not have an account: friends and relatives
 * who visit are players with `userId = null`. Every user has exactly one linked player. An admin can
 * link a player to a user later (or merge duplicates); play history follows because plays point at
 * the player, not at a name. A player holds only a display name.
 */
export const players = pgTable(
  'players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    userId: uuid('user_id')
      .unique()
      .references(() => users.id, { onDelete: 'set null' }),
    ...authorship(),
    ...stamps(),
  },
  (t) => [index('players_household_idx').on(t.householdId)],
);

export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playedOn: date('played_on').notNull(),
    durationMinutes: integer('duration_minutes'),
    notes: text('notes'),
    ...authorship(),
    ...stamps(),
  },
  (t) => [
    index('plays_household_played_idx').on(t.householdId, t.playedOn),
    index('plays_game_idx').on(t.gameId),
  ],
);

export const playParticipants = pgTable(
  'play_participants',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    playId: uuid('play_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.playId, t.playerId] }),
    index('participants_player_idx').on(t.playerId),
  ],
);

// ---------------------------------------------------------------------------
// Ratings and audit trail
// ---------------------------------------------------------------------------

/** One rating per (user, game). Never exposed to guests or restricted profiles. */
export const ratings = pgTable(
  'ratings',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** 1 (disliked) to 5 (loved). */
    score: integer('score').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] }), index('ratings_game_idx').on(t.gameId)],
);

export const auditAction = pgEnum('audit_action', ['create', 'update', 'delete']);

/**
 * Who changed what, and when. Written in the same transaction as the change. `changes` maps a field
 * name to `[before, after]`; it never contains secrets such as password hashes.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: auditAction('action').notNull(),
    changes: jsonb('changes').$type<Record<string, [unknown, unknown]>>().notNull().default({}),
    // clock_timestamp(), not now(): entries in one transaction still get distinct, ordered times.
    at: timestamp('at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index('audit_entity_idx').on(t.householdId, t.entityType, t.entityId, t.at),
    index('audit_household_at_idx').on(t.householdId, t.at),
  ],
);
