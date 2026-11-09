# Redesign build plan: "The Shelf"

Plan for rebuilding the app's UI and the data behind it to match the isolated redesign in
`screenshots-redesign/` (mockups, `README.md`, `CRITIQUE.md`; see Phase 0 for where they should live).

Status: built (Phases 0 to 8 and most of 9) on `main`. Differences from this plan as written:

- Visibility on the add-game form stayed a select rather than a radio group.
- The dated-loan rope timeline and the shelf-grouped catalog (Phase 9 optional items) were not built.
- Copies became cards with lend and return on the game page, and the wishlist gained a list per person.
- The sign-in shelf uses made-up artwork only; the mockup's generated covers live in
  `src/components/art/`.
- Pickers that list every game title (plays, lending) are still client-side selects; a server-driven
  search is the follow-up if the library grows past a few hundred.

## Ground rules

1. **Breaking changes are fine until the v1 lock.** The app is deployed nowhere and has no users. Do not
   write data migrations or backfills. When the schema changes, delete `drizzle/` and regenerate a single
   baseline (`pnpm db:generate`), then reset the dev and e2e databases. Stop doing this once v1 is locked.
2. **Work directly on `main`**, in small conventional commits (`feat:`, `fix:`, `chore:`), per `AGENTS.md`.
   Every commit leaves `pnpm lint`, `pnpm typecheck` and `pnpm test` green. Every phase ends with a green
   `pnpm e2e`.
3. **Read `node_modules/next/dist/docs/` before writing Next code** (AGENTS.md: this Next has breaking
   changes). Check the Mantine 9 docs before overriding components.
4. **All data access stays in `src/server/data/`** with a `DataContext`. New queries, ratings, audit and
   facets included. No direct table queries from routes or components.
5. **Visibility is enforced on the server**, and each phase that adds a read path adds tests asserting
   hidden data never appears in restricted-profile or guest responses (rows, counts, facets, tags, covers).
6. **No new CSS framework.** Mantine for behaviour and inputs (comboboxes, drawers, modals, focus
   handling), CSS modules plus `postcss-preset-mantine` for the bespoke look. Fonts are self-hosted.
7. **Mockups are a reference, not a spec.** Where this plan and a mockup disagree, this plan wins (see
   "Differences from the mockups").

## Decisions already made

| Topic            | Decision                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cover art        | Generated SVG covers are mockup-only, except the decorative shelf on the sign-in page. Real covers are uploaded or looked-up images.                                                                                                                                             |
| Sign-in page     | Keep the shelf look as a static, abstract shelf of generated covers with **no game names, no household name and no library data**.                                                                                                                                               |
| Notifications    | No email, SMS or "Remind" in v1 (possibly never).                                                                                                                                                                                                                                |
| Ratings          | New table, one rating per `(user, game)`, with a visibility rule.                                                                                                                                                                                                                |
| Winners          | Not tracked. Plays record only who played.                                                                                                                                                                                                                                       |
| Players vs users | Plays record **players**, and a player does not need an account. Any member can add a non-user player while logging a play. An admin can later link a player to a user, or merge duplicate players, and the history follows with no rewrite. A player holds only a display name. |
| User data        | No birthdays or other extra user fields.                                                                                                                                                                                                                                         |
| Puzzles          | New piece-count field.                                                                                                                                                                                                                                                           |
| Audit            | `created_by` on every entity where it makes sense, plus an audit trail so "who edited this last" is easy.                                                                                                                                                                        |
| Condition        | `unopened`, `like new`, `good`, `worn`, `damaged`, `incomplete`, plus an optional details field.                                                                                                                                                                                 |
| Loans            | No due date is the default and the main case. Guests never see loan or due-date information.                                                                                                                                                                                     |
| Catalog          | Server-side pagination, sorting and filtering. The full list never reaches the client.                                                                                                                                                                                           |
| Guest picker     | Players/time filter shares its logic with the catalog filter.                                                                                                                                                                                                                    |
| Locations        | Deleting a location that has copies is blocked, with tests.                                                                                                                                                                                                                      |
| Import           | Add "download failed rows" and "columns not used".                                                                                                                                                                                                                               |
| Fonts            | Self-host Fraunces and Figtree with `next/font`.                                                                                                                                                                                                                                 |
| Phone panels     | Drawers or bottom sheets with real focus handling, not CSS-only panels.                                                                                                                                                                                                          |
| Guest dead ends  | One generic page for expired, revoked and unknown links.                                                                                                                                                                                                                         |
| Kid profile      | Never reveal the total including hidden games.                                                                                                                                                                                                                                   |

## Phase overview

| #   | Phase                             | Output                                                                                      | Size |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| 0   | Prep                              | Mockups preserved, baseline green                                                           | S    |
| 1   | Schema and data layer             | New schema, audit, ratings, paged catalog, guards. Minimal UI edits so the app still builds | L    |
| 2   | Design foundation                 | Fonts, theme, shared components, new shell and navigation                                   | M    |
| 3   | Catalog and game detail           | Shelf catalog, facets, paging, detail page                                                  | L    |
| 4   | Write screens                     | Add/edit game, add copy, import                                                             | M    |
| 5   | Loans, plays, wishlist            | The three tracking screens                                                                  | M    |
| 6   | Settings                          | People, locations, guest links, activity                                                    | M    |
| 7   | Sign-in and first run             | Front door                                                                                  | S    |
| 8   | Restricted profile and guest view | The two privacy-sensitive audiences                                                         | M    |
| 9   | Polish and optional features      | Shelf grouping, dated-loan timeline, docs, screenshots                                      | M    |

Phases 3 to 8 depend on 1 and 2. Phase 7 is cheap and has no data dependencies, so it can move earlier if
you want a visible win. Phase 8 goes last on purpose: it is where a leak matters most, and by then every
read path exists to test.

---

## Phase 0: Prep

- Move the mockups into the repo so they survive and can be referenced: `docs/design/the-shelf/` with
  `source/`, `README.md`, `CRITIQUE.md`. Decide whether to keep the 65 PNGs (large) or leave them out and
  regenerate from `source/` with a short script. Keep `screenshots/` gitignored as it is.
- Port the generated cover motifs from `source/data.js` into reusable React components (needed for the
  sign-in shelf in Phase 7 and as a test fixture elsewhere). Strip game names.
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` and note the baseline. The two known
  `test.fixme` items (CAT-07c, X-05b contrast) stay as they are until Phase 2 closes X-05b.

Done when: baseline recorded, design reference committed.

---

## Phase 1: Schema and data layer

No visible redesign yet. Touch existing UI only as much as needed to keep it compiling and tests green
(for example, remove the winner field from the play form).

### 1.1 Reset migrations

Delete `drizzle/` and regenerate one baseline after the schema edits below. Update `e2e/start-app.mjs` and
`src/server/db/test-db.ts` only if they assume migration names.

### 1.2 Schema changes (`src/server/db/schema.ts`)

- **Authorship.** Add `createdByUserId` and `updatedByUserId` (nullable, `on delete set null`) plus
  `updatedAt` where missing to: `games`, `copies`, `loans`, `play_sessions`, `wishlist_items`,
  `locations`. `share_links` already has `createdByUserId`.
- **`audit_log`.** `id`, `household_id`, `actor_user_id` (nullable, set null), `entity_type`, `entity_id`,
  `action` (`create | update | delete`), `changes jsonb` (field to `[before, after]`; no secrets or password
  hashes ever), `at timestamptz`. Index on `(household_id, entity_type, entity_id, at)` and
  `(household_id, at)`.
- **`ratings`.** `household_id`, `user_id`, `game_id`, `score` (1 to 5, check constraint), `updated_at`.
  Primary key `(user_id, game_id)`; index on `game_id`.
- **Condition.** Replace `copy_condition` with `unopened | like_new | good | worn | damaged | incomplete`.
  Add `copies.condition_notes text`. Keep `copies.notes` for general notes (for example "gift from Dad").
- **Puzzles.** New `puzzle_details(game_id pk, household_id, piece_count)` following the existing details
  pattern (`board_game_details`, `rpg_details`). No new field for video games.
- **Players.** New `players` table: `id`, `household_id`, `display_name`, `user_id` (nullable, unique, `on
  delete set null`), `created_by_user_id`, `created_at`, `updated_at`. Every user gets exactly one linked
  player row, created in the same transaction as the account. Players with a null `user_id` are the
  non-users (John, Sarah, Mikey and Melissa in the example). `display_name` is not unique, since two
  people can share a first name; the UI disambiguates (see Phase 5). A player holds **only a name**: no
  email, birthday or contact details.
- **Plays.** Drop `winner` and `player_names`. Add `play_participants(play_id, player_id, household_id)`
  with primary key `(play_id, player_id)` and an index on `player_id`. `play_sessions` keeps date,
  duration and notes.
- **Loans.** No schema change. `due_on` stays nullable; no due date is the normal case.
- **Households.** `households.name` already exists; Phase 7 makes first-run collect it.

### 1.3 Audit helper (`src/server/data/audit.ts`)

- `withAudit(ctx, {entityType, entityId, action, changes}, tx)` writes inside the same transaction as the
  mutation. Convert every mutation in `games.ts`, `copies.ts`, `loans.ts`, `plays.ts`, `wishlist.ts`,
  `lookups.ts` (locations, tags), `guest.ts` (links) and `import.ts` (one `create` entry per game, grouped
  under an import id in `changes`).
- Mutations also set `createdByUserId`/`updatedByUserId` from `ctx.viewer`.
- Read helpers: `lastEdit(ctx, entityType, entityId)` and `recentActivity(ctx, {limit, cursor})`. Both
  require `admin` or `member`; `restricted` and guests get nothing.
- Tests: every mutation writes exactly one entry; entries are household-scoped; failed mutations write
  none (transaction rollback); restricted viewers cannot read; password hashes never appear in `changes`.

### 1.4 Ratings (`src/server/data/ratings.ts`)

- `setRating`, `clearRating`, `myRating(gameId)`, `ratingSummary(gameId)` (average and count across
  household users).
- Rules: `restricted` cannot rate and never receives other people's ratings; guests never receive any
  rating, ever (extends the existing guest invariant). Members see their own plus the family average.
- Tests in `visibility.test.ts` style: ratings absent from restricted and guest responses.

### 1.5 Catalog query: paging, sorting, facets

- Replace `listCatalog` with `listCatalogPage(ctx, filters, sort, page)` returning
  `{ rows, total, hasMore }`. Page size is a constant (suggest 48). Offset paging is fine at this scale.
- Filters (zod-validated, one shared parser for URL search params): `q`, `type`, `tag`, `location`
  (including descendants), `owner`, `players`, `maxMinutes`, `availability` (`here | out`).
- Sorts: `title` (default) and `newest` (by `createdAt`, tie-break on id for stable paging).
- `catalogFacets(ctx, filters)`: counts by type, by location (rolled up through the tree), and the tag
  list, all computed server-side **under the same visibility condition** as the rows. A restricted viewer's
  `total` and every facet count exclude hidden games; there is no code path that returns the unfiltered total
  to them.
- Rows include `onLoan` plus, for `admin`/`member` only, borrower and due date. Restricted profiles get
  `onLoan` only (no borrower name).
- Extract the shared filter logic (`players`, `maxMinutes`, `q`, `type`) into one module used by both
  `listCatalogPage` and `guestCatalog`, so the guest picker cannot drift from the catalog.
- Tests: paging is stable and has no duplicates or gaps across pages; totals and facets exclude hidden games
  for restricted and guest viewers; malformed filter values return an empty page, never a 500.

### 1.6 Location delete guard

`deleteLocation(ctx, id)` returns `{ ok: false, reason: 'has_copies' | 'has_children', count }` instead of
nulling out copies. Counts include descendants. Tests cover direct copies, copies in a child location, and
the success case. The UI wording lands in Phase 6.

### 1.7 Loans and plays helpers

- `listLoans` returns `daysOut` and groups: `late` (due date passed), `dueSoon` (due within 7 days),
  `noDueDate`, `returned`. `previousBorrowers(ctx)` returns distinct earlier borrower names for the lend
  picker. No reminder logic.
- Plays: remove `winner` from input, queries, stats and tests. `logPlay` takes `playerIds` (existing
  players) plus `newPlayers: string[]` (names to create on the spot), all inside one transaction with
  audit entries for each new player. Names are trimmed, must be non-empty, and a new name that
  case-insensitively matches an existing player is rejected with a "did you mean X?" result, so the UI can
  ask instead of silently creating a duplicate. `playStats` keeps most played and not played in a year,
  and adds plays per player for the filter and "Who plays this".

### 1.7b Players: link and merge (`src/server/data/players.ts`)

- `listPlayers(ctx)` returns players with play counts and linked-user info. `searchPlayers(ctx, q)` backs
  the type-ahead in the log panel (admin and member only).
- `createPlayer(ctx, name)` for the inline "add someone" flow. Any `admin` or `member` may call it.
- `renamePlayer`, `deletePlayer` (blocked while the player has plays or is linked to a user),
  `linkPlayerToUser(ctx, playerId, userId)`, `unlinkPlayer`, and `mergePlayers(ctx, fromId, intoId)`. All
  five are **admin-only**, validate that both ids belong to the household, and write audit entries.
- **Link:** sets `players.user_id`. A user can have only one player, so if the user already has an
  auto-created player (the normal case for a brand-new account), the link is performed as a merge into the
  user's existing player. Historical plays then count for that user with no rewrite of play rows, because
  they point at the player id.
- **Merge:** moves `play_participants` from `fromId` to `intoId`, collapsing the case where both played the
  same session (keep one row), then deletes the source player. Merging two linked players is refused.
- **Account creation:** the add-person flow can offer "This is the same as an existing player: John" and
  links that player instead of creating a new one. See Phase 6.
- **User deletion:** the user's player stays, with `user_id` set to null, so history is never lost.
- Tests: link keeps all plays attributed; merge handles overlapping sessions and is atomic; one player per
  user is enforced; a member cannot link, merge, rename or delete; restricted and guest viewers can read
  none of it; audit entries exist for every operation; plays and player names never appear in guest or
  restricted responses.

### 1.8 Import

`parseImport` also returns `unusedColumns`, a `pieces` alias for the new puzzle field, and the raw failed
rows so the UI can offer them as a CSV download. Keep the existing duplicate and error behaviour.

### 1.9 Guest resolution

`resolveShareLink` keeps returning `null` for unknown, revoked and expired links, and the route renders one
generic page (Phase 8). Make sure no code or response (status, headers, timing-obvious work) distinguishes the
three. Update `guest.spec.ts` expectations.

Done when: schema and data layer tests pass; existing e2e passes after the minimal UI edits (winner field
removed, condition labels updated, new enum values selectable); `pnpm typecheck` clean.

---

## Phase 2: Design foundation

### 2.1 Fonts

Self-host Fraunces (variable) and Figtree (variable) through `next/font/local`, using files from
`@fontsource-variable/*` packages or committed font files, so builds make no network calls. Replace Geist
(`geist` dependency, `layout.tsx`, `theme.ts`, `globals.css`). Keep tabular numerals on counts and dates.

### 2.2 Theme (`src/theme.ts`)

Replace the "achromatic ledger" system with the Shelf tokens from the mockups' `style.css`: warm stone
ground, forest-green primary, berry for loans and errors, plank brown. Define them as Mantine colour tuples
plus CSS variables through the existing variables resolver, for both light and dark (Mantine colour scheme
stays `auto`). Radii, spacing and heading sizes follow the mockups (large serif titles). Map the dark
palette's berry to the light-pink used in the dark mockups.
Close CAT-07c/X-05b: run axe on the new palette and fix contrast at the token level, then remove the
`test.fixme` on X-05b.

### 2.3 Shared components (`src/components/`)

Build once, reuse everywhere:

- `CoverTile`: real image (object-fit cover, fixed aspect ratio) or a generated no-cover tile (tinted by
  type, large initial). A third `hiddenImage` variant for restricted profiles. All three must be legible in
  light and dark (the mockup's near-invisible dark Gloomhaven thumbnail is a bug to avoid).
- `Shelf` / plank styling: a grid where each item draws its own plank segment (bottom pseudo-element
  extending half the gap each side) so adjacent items form a continuous plank at any column count without
  knowing row breaks. Clip horizontally so planks never overhang.
- `StatusTag` (loan: "Out with Priya", late, on the shelf), `Fact` (big numeral plus label), `Rating`
  (stars, 1 to 5), `PersonChip` (initials avatar), `SectionHeading`, `EmptyState`.
- `ResponsivePanel`: Mantine `Drawer` bottom sheet on phones and an inline panel or modal on desktop, with
  focus trap, escape to close, return focus to the trigger, and scroll lock.
- Form pattern: card, field, chip-group and switch wrappers over Mantine inputs, plus one error pattern
  (message names the fix). Fixed save bar on phones.

### 2.4 Shell and navigation (`src/app/(app)/Shell.tsx`)

- Desktop: pill nav (Library, Loans, Plays, Wishlist, Import, Settings), "Add game", user menu.
- Phone: bottom tab bar (Library, Loans, Plays, Wishlist, More) and a More page (Import, Settings, guest
  links, sign out).
- Count badges only for queues that need attention (Loans out, Wishlist). Add `navCounts(ctx)` in the data
  layer; it respects visibility.
- Per-role navigation stays as the current rules enforce today (see open question 3).

Done when: every existing page renders under the new theme and shell with no layout breakage (old layouts
are acceptable at this point), axe passes, X-05b passes.

---

## Phase 3: Catalog and game detail

### 3.1 Catalog (`(app)/games/`)

- Server component reading validated `searchParams`; the URL is the single source of filter, sort and page
  state. No client-side filtering or sorting.
- Header: the sentence summary built server-side ("287 games on 9 shelves. 4 are out on loan"), the large
  "Do we own...?" search, sort control (Title, Newest).
- Sidebar facets on desktop (availability, type, players tonight, time, location tree, whose, tags), all
  from `catalogFacets`. On phones, one "Filters" button opens the bottom sheet from `ResponsivePanel`, with
  category chips above the grid.
- Grid of `CoverTile` on planks, 5 columns on desktop, 4 on tablet, 3 on phone. Loan tag on covers shows the
  borrower only for `admin`/`member`.
- "Load more" fetches the next page through a server action or route handler that uses the same data
  function (so visibility cannot be bypassed), appending rows client-side. Keep `?page` out of the URL
  unless deep links to later pages turn out to matter.
- Empty states (empty library, no results) and a loading skeleton.

### 3.2 Game detail (`(app)/games/[id]/`)

- Cover on a plank, large serif title, facts as numerals (players, time, complexity bar, age; piece count
  for puzzles; system and book kind for RPG books; platform for video games).
- Description, tags, owner notes (hidden from restricted), rating card (your rating plus family average,
  members only), copies as cards (owner, location, condition and details, acquired, loan state with lend and
  "mark returned" actions), recent plays, and "Last edited by X on date" from the audit helper.
- Replace the mockup's win tally with "Who plays this": counts per player from `play_participants`.
- "Nearby on the shelf" (other games in the same location) is optional. Include only if the query stays
  cheap; otherwise defer to Phase 9.
- Actions (Log a play, Lend, Edit, Wishlist) open `ResponsivePanel`s. Delete game sits at the bottom with
  confirmation.

Tests: update `catalog.spec.ts`, `browse.spec.ts`, `copies.spec.ts`; add paging, sort and facet e2e checks;
extend `visibility.spec.ts` to assert totals and facets as the restricted profile.

Done when: catalog and detail match the mockups at 1440, 820 and 390 px in light and dark; no
client-side filtering remains.

---

## Phase 4: Write screens

- **Add/edit game** (`GameForm`, `Lookup`, `NewGameClient`): type first, then the lookup (suggestions, "what
  it filled" summary, retry on failure), per-type fields (board/card, RPG system and book kind, video
  platform, puzzle piece count), tags, cover upload with the JPEG/PNG/WebP error, three-way visibility
  control, "show on guest links" switch, blank-title validation. Created-by and last-edited shown on edit.
- **Add copy** (`CopiesPanel`): owner, location picker showing the tree with counts, condition (new enum)
  plus details field, price, acquired date, platform. Empty state for a game with no copies.
- **Import**: states before file, file chosen, success, partial success, refused file. Add the failed-rows
  CSV download and the unused-columns notice. Mention the `pieces` column in the sample.

Tests: update `catalog`, `copies`, `import` specs; add edit-as-member audit check ("last edited by").

---

## Phase 5: Loans, plays, wishlist

- **Loans.** Default view is "Out now": every open loan, sorted by how long it has been out ("kept 14
  days"), with `Returned`. Groups appear only when they have content: Late, Due soon, then No due date (the
  common case), then "Back on the shelf" history. Lend flow is a panel or sheet: title lookup limited to
  lendable copies and showing which copy is free, borrower chips from `previousBorrowers` plus "Someone
  new", due date optional with "No due date" selected by default and quick picks (1 week, 2 weeks, a
  month, pick a date). Keep the "has borrowed N games before" line. No Remind button.
- **Plays.** Recent plays, most played, "Not played in a year" with one-click log. Log panel: game, date,
  who played, notes, and a "same group as last time" shortcut. No winner. Filter by player.
  - **Who played** is a chip picker with three parts: the household's users first, then previously used
    non-user players (most recently used first, so the friends from last game night are one tap away),
    then an "Add someone" box. Typing there searches existing players and offers them; if nothing
    matches, it creates a new non-user player on save. Adding John, Sarah, Mikey and Melissa the next day
    is four typed names the first time and four taps afterwards.
  - Non-user chips look different from user chips (outlined, with a small "guest" hint) so it is clear who
    has an account. Where two players share a display name, the chips are numbered ("John", "John (2)")
    until an admin renames or merges them.
  - If a typed name case-insensitively matches an existing player, show "Is this John from game night?"
    with a one-tap use-existing option before creating a duplicate.
  - Plays list and detail show participants as chips, never email addresses.
- **Wishlist.** Lists grouped by person (`requestedByUserId`), add form (title, type, link restricted to
  http/https, price, notes shown as a "note for gift-givers"), empty and link-error states, "mark acquired".
  No birthday banner.

Tests: update `loans`, `plays`, `wishlist` specs (no winner, default no due date, grouping, previous
borrowers).

---

## Phase 6: Settings

- Tabs: People, Locations, Guest links, and a small **Activity** list for admins (recent changes from
  `recentActivity`: who, what, when). This is the visible half of the audit trail and is cheap.
- **People**: list and add (name, email, password, profile). Short-password and duplicate-email errors.
  When adding a person, show "Is this someone who has played before?" with a search over non-user players.
  Choosing one links that player to the new account; choosing nothing creates a fresh linked player. A
  similarly named existing non-user player is suggested automatically (for example adding
  `john@example.com` named John suggests the existing John).
- **Players who aren't users** (admin only, beside People): a list of non-user players with play counts and
  last-played date, and per player: rename, **Link to a user** (pick from users without a linked history, or
  confirm the merge-into-account result), **Merge into another player** (for duplicates such as "John" and
  "Jon"), and delete (only when the player has no plays). Every action asks for confirmation and states the
  consequence ("14 plays will count for John Smith"). Members and restricted do not see this section.
- **Locations**: nested tree with copy counts, add with parent, and the delete guard UI ("Basement has 142
  copies; move them first").
- **Guest links**: create (name, expiry, hidden types and tags, show notes, show locations), the full URL
  shown once with Copy, list with Active/Expired/Revoked and a "Hides: ..." summary, revoke.
- Members and restricted see the same layout read-only with a banner.

Tests: update `settings.spec.ts`; add location-delete-blocked and activity-visibility checks.

---

## Phase 7: Sign-in and first run

- Sign-in and first-run setup in the two-panel layout: a static `DecorativeShelf` built from the generated
  covers with **no text and no data**, beside one short form. The shelf is trimmed or hidden on phones.
- First-run collects the household name as well as the admin account. The household name is not shown on
  any unauthenticated page.
- Errors never reveal which of email or password was wrong. Redirected-to-login keeps its message.

Tests: update `auth.spec.ts` and `00-first-run.setup.ts`; assert the unauthenticated pages contain no game
titles or household name.

---

## Phase 8: Restricted profile and guest view

### 8.1 Restricted profile

- Library with hidden games absent, counts that exclude them, trimmed navigation (unchanged from today's
  rules unless you decide otherwise, see open question 3), the `hiddenImage` tile for "hide images" games,
  read-only detail (no edit, no delete, no notes, no copies form, no ratings).
- A hidden game and an unknown id render the same 404.

### 8.2 Guest view (`/g/[token]`)

- No app chrome. "Game night" picker (players, time) using the shared filter module, a headline that answers
  it, and a list of the shareable games. No availability, borrower or due-date information of any kind. No
  ratings, prices or owners; notes and locations only if the link opts in.
- One generic unavailable page for expired, revoked and unknown links, returning the same status for all.

Tests (the important ones): extend `visibility.spec.ts` and `guest.spec.ts` and the data-layer tests to
assert that no restricted or guest response (rows, `total`, facets, tags, covers, server-action replays,
search params) leaks hidden games, ratings, loan details, audit data or the household name.

---

## Phase 9: Polish and optional features

- Docs: update `README.md` and `AGENTS.md` (fonts, design system, the "no migrations until v1" note and its
  expiry), `docs/E2E_TEST_PLAN.md` (new specs), and regenerate `pnpm shots` plus `screenshots/INDEX.md`.
- Optional, in rough value order: group the catalog by shelf location (a "by shelf" view with a visible gap
  for loaned games); the dated-loan timeline, shown only when at least one loan has a due date; "Nearby on
  the shelf" on detail; a phone "Find it" mode.
- Final pass: dark mode, reduced motion, keyboard and focus order in every sheet, axe on all screens,
  lighthouse on phone widths, 10 MB cover limit sanity check.

---

## Differences from the mockups

| Mockup                                            | Build                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hand-drawn SVG covers per game                    | Real images or the generated no-cover tile; SVG art only on the sign-in shelf |
| Real game names and household name on sign-in     | Abstract shelf, no names                                                      |
| "Remind" on late loans                            | Removed                                                                       |
| Rope timeline as the main Loans view              | "Out now" list by days out; timeline only for dated loans (Phase 9)           |
| "Late / Due this week / Later"                    | Late, Due soon, **No due date** (default), History                            |
| Win tally on Catan and "Sam won" on plays         | "Who plays this"; plays show only who played                                  |
| Birthday banner on wishlist                       | Removed                                                                       |
| Guest "Back Nov 16"                               | No availability on guest pages                                                |
| Distinct expired, revoked and unknown pages       | One generic page                                                              |
| Condition "Very good"                             | `unopened / like new / good / worn / damaged / incomplete` plus details       |
| Restricted profile with Plays and Wishlist in nav | Keep today's restrictions unless you change them                              |
| Restricted view showing the borrower on loan tags | Restricted sees "Out" only                                                    |

## Risks

| Risk                                                                      | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bespoke look fights Mantine defaults                                      | Build the shared components in Phase 2 before any screen; override through theme tokens and CSS modules, not per-page hacks                                             |
| Planks per grid row at any column count                                   | Per-item plank segment technique (Phase 2.3), tested at all breakpoints                                                                                                 |
| Real BGG covers have mixed aspect ratios                                  | Fixed-ratio frame with object-fit cover; check against real lookups early                                                                                               |
| Server-side paging changes how sidebar counts work                        | Facets come from one server function sharing the row query's conditions                                                                                                 |
| Visibility regressions in new read paths (facets, totals, audit, ratings) | Tests written with each read path; Phase 8 is a dedicated audit                                                                                                         |
| Audit writes slow or lose consistency                                     | Written in the same transaction as the mutation; one table, indexed                                                                                                     |
| Duplicate non-user players ("John", "Jon", "John S.") fragment history    | Type-ahead with "is this John?" before creating; admin merge; case-insensitive match check in the data layer                                                            |
| Link or merge goes wrong and cannot be undone                             | Both are single transactions with audit entries recording the ids moved, confirmation text states the consequence, and merges refuse to combine two user-linked players |
| Non-user players are personal data about people who never signed up       | Store a display name only, never expose it to guests or restricted profiles, and let an admin rename or delete a player with no plays                                   |
| Large e2e rewrite                                                         | Update specs in the same phase as the screen they cover; never leave e2e red across a phase boundary                                                                    |
| Next.js 16 behaviour differs from memory                                  | Read `node_modules/next/dist/docs/` before each new routing, caching or server-action pattern                                                                           |

## Open questions

1. **Audit depth.** Plan assumes one `audit_log` with per-entity field diffs. Say so if you need full
   per-field history with restore.
2. **Rating scale.** Plan assumes whole stars, 1 to 5. Half stars would be a small change now and a larger one
   later.
3. **Restricted navigation.** The mockup gives the kid profile Plays and Wishlist, but today's app redirects
   restricted profiles away from them. The plan keeps today's rules. Change it if you want kids to log plays.
4. **Page size.** 48 per page assumed (about 10 rows of 5).
5. **Player identity (resolved).** Plays point at `players`, which may or may not be linked to a user. This
   supports non-user players, admin linking and merging, and keeps history after a user is deleted. Open
   detail: whether to show a "(guest)" hint on non-user chips, or keep them visually identical to users.
6. **Mockup PNGs in git.** Keep them (large) or regenerate on demand.
