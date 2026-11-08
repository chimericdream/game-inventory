# End-to-end test plan (Playwright)

## Implementation status

Implemented in `e2e/` and run with `pnpm e2e` (needs the local Postgres from
`docker compose up -d db`). Phases P0 to P4 are done and run in CI as the `e2e` job. What is left is
listed at the end of this section.

| Area                                | Specs                                     | Notes                                                                        |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Setup and auth                      | `00-first-run.setup.ts`, `auth.spec.ts`   | AUTH-01 to 12; AUTH-13 became "a deleted session stops working"              |
| Catalog, copies, browsing, settings | `catalog`, `copies`, `browse`, `settings` |                                                                              |
| Household visibility                | `visibility.spec.ts`                      | Includes replaying captured server-action requests as the restricted profile |
| Guest links                         | `guest.spec.ts`                           | Includes replay by member and restricted profiles                            |
| Import, loans, wishlist, play log   | `import`, `loans`, `wishlist`, `plays`    |                                                                              |
| UPC and mock wiring                 | `external.spec.ts`                        | UPC-01 to 06; MOCK-01 to 04 check the harness, not the BGG screens           |
| Cross-cutting                       | `cross-cutting.spec.ts`, `health.spec.ts` | X-01 to X-11 (X-12 is now the cover path-traversal check)                    |

Deviations from the plan below:

- Canned BGG responses are inline in `e2e/mocks/external-server.ts` instead of separate XML files.
- The mock is reached through `BGG_BASE_URL` and `UPC_BASE_URL` (both implemented).
- The app is started by `e2e/start-app.mjs`, which drops and recreates the `games_e2e` database, so
  the database exists before Playwright's global setup. Set `E2E_SKIP_BUILD=1` to reuse the last build.
- Confirmed behavior replaced the "(confirm)" items: duplicate imports are skipped (same title and
  type, any case); a copy on loan is not offered for lending again; restricted profiles are
  redirected away from plays, loans, wishlist, import and add game.

Known gaps, kept as `test.fixme`: CAT-07c (cover bytes are not verified, only the declared type) and
X-05b (color contrast below WCAG AA in the default Mantine theme).

Not done yet: the Firefox and WebKit `@smoke` pass (`E2E_BROWSERS=all` is configured, but those
browsers are not installed locally), the Docker smoke run, the BGG screens (P6), per-worker databases
for parallel runs, and ratings checks (ratings do not exist yet).

### Bugs the tests found and that were fixed

- Cover uploads over 1 MB failed silently (the server action body limit); now 10 MB.
- Malformed ids in URLs (`/games/not-a-uuid`, `?location=bad`, guest cover ids) caused a 500; now a 404 or empty list.
- Tags used only on games hidden from restricted profiles still appeared in their tag filter.
- The restricted profile's navigation linked to pages that only bounced it back.
- The Play log rendered a paragraph directly inside a list (invalid markup).

## 1. Goals and non-goals

Vitest already covers the data layer against real migrations (PGlite): household isolation,
restricted-profile hiding, guest-leak checks, CSV parsing, auth. Playwright covers what those
cannot:

- Server actions, forms and redirects working through a real browser and a real Postgres.
- Rendering of every page for every role. Three bugs found during first run (script tag warning,
  function props passed from server components, `List.Item` in a server component) were all
  render-time failures that only a browser or full HTTP render catches.
- The visibility rules **as a user experiences them**: URLs, cover endpoints, forms, nav.
- Guest links from a cookie-less browser.
- The production build (`next build` + `next start`), not `next dev`.

Non-goals: re-testing pure logic already in vitest, visual regression screenshots, load testing,
and BGG UI flows (harness is planned in section 5, tests are deferred to the last phase).

## 2. Architecture

### Layout

```
e2e/
  playwright.config.ts
  global-setup.ts            # create e2e DB, run migrations, create storageState files
  fixtures/
    index.ts                 # extended `test`: console-error guard, role pages, db helper
    csv/                     # import fixtures (valid.csv, aliases.csv, bad-rows.csv, ...)
    images/                  # tiny valid png/jpg, fake-png.txt, oversize.png
    bgg/                     # canned BGG XML (see section 5)
  support/
    db.ts                    # direct SQL helper (postgres package): reset, seed, backdate
    mantine.ts               # locators for Select / MultiSelect / TagsInput / FileInput
    roles.ts                 # admin / member / restricted credentials + storageState paths
  mocks/
    external-server.ts       # mock BGG + UPC HTTP server
  specs/
    *.spec.ts
```

### Runtime

- Run against `pnpm build && pnpm start` with env: `DATABASE_URL` pointing at a dedicated
  `games_e2e` database, `DATA_DIR` set to a temp directory, `COOKIE_SECURE=false`, `BGG_API_TOKEN`
  set to a dummy value, and the external base URLs pointing at the mock server (section 5).
- Postgres comes from `docker compose up -d db` locally and a service container in CI.
- Chromium for the full suite. Firefox and WebKit run only the `@smoke` subset (nightly or on
  demand) to catch engine-specific form and cookie behavior.
- `workers: 1` initially: all specs share one database and one app instance. Later option:
  one database plus one server per worker (port = base + workerIndex) to parallelize.
- CI: `retries: 1`, `trace: 'on-first-retry'`, video on failure, HTML report uploaded as an
  artifact. Locally: no retries.

### Test data strategy

- **Bootstrap through the UI once**: `global-setup` runs the real first-run `/setup` flow (this is
  also test AUTH-02), then creates a member and a restricted profile through Settings, and saves a
  `storageState` file per role. Specs reuse those states, so most tests start already logged in.
- **Per-spec data through `support/db.ts`** (direct SQL, bypassing the UI) for speed and for
  things the UI cannot do: backdating a due date or a share-link expiry, creating a second
  household, inserting 500 games for scale tests. The UI path for each feature is still tested in
  that feature's own spec.
- Each spec file starts with `db.resetCatalog()` (truncate games, copies, tags, loans, wishlist,
  plays, share links; keep households, users, sessions) so specs are order-independent.
- Tests that mutate users or sessions (logout, role changes) create their own throwaway user
  rather than touching the shared role accounts.

### Conventions

- Locators: `getByRole`, `getByLabel`, `getByText`. Add `data-testid` only where Mantine markup
  makes roles ambiguous (e.g. game cards, copy rows). No `waitForTimeout`; web-first assertions only.
- **Console guard fixture** (auto-applied): fail any test on `pageerror`, on console `error`
  (this would have caught the `ColorSchemeScript` warning), and on hydration mismatch messages.
  Allow-list entries need a comment explaining why.
- Tags: `@smoke` (fast, run everywhere), `@security` (visibility and guest tests; never skipped),
  `@external` (needs the mock server).
- Names: `AREA-NN description`, matching the IDs below, so failures map back to this plan.

## 3. Prerequisite code changes (small)

1. `src/server/lookup/bgg.ts`: read the base URL from `BGG_BASE_URL`, defaulting to
   `https://boardgamegeek.com/xmlapi2`.
2. `src/server/lookup/upc.ts`: read `UPC_BASE_URL`, defaulting to
   `https://api.upcitemdb.com/prod/trial`.
3. Document both in `.env.example` and the README config table (marked "testing only").
4. Add `@playwright/test` and `@axe-core/playwright` as devDependencies; scripts
   `e2e`, `e2e:ui`, `e2e:smoke`.
5. Exclude `e2e/` from the vitest `include` and keep it covered by oxlint/oxfmt.
6. Note the commands in `AGENTS.md`.

## 4. Test cases

Roles: **A** admin, **M** member, **R** restricted, **G** guest, **Anon** no session.

### 4.1 Setup and authentication (AUTH)

| ID      | Scenario                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Empty database: `/`, `/games` and `/login` all end up at `/setup` `@smoke`                                                   |
| AUTH-02 | First-run setup creates household and admin, logs in, lands on games list `@smoke`                                           |
| AUTH-03 | Setup validation: bad email, password under 8 characters, missing name show errors and create nothing                        |
| AUTH-04 | After setup, `/setup` no longer lets anyone create a second household _(confirm: redirect or error)_                         |
| AUTH-05 | Login with correct credentials works; email is case-insensitive                                                              |
| AUTH-06 | Wrong password and unknown email show the same generic error                                                                 |
| AUTH-07 | Logout clears the session; back button and direct URL return to `/login`                                                     |
| AUTH-08 | Anonymous access to every `(app)` route redirects to `/login`                                                                |
| AUTH-09 | Anonymous `GET /api/games/:id/cover`, `/api/lookup/*` return 401                                                             |
| AUTH-10 | Session cookie is `gi_session`, httpOnly, SameSite=Lax, not Secure by default; Secure when `COOKIE_SECURE=true` (second run) |
| AUTH-11 | Expired session (backdate in DB) is rejected and redirects to login                                                          |
| AUTH-12 | Tampered or random cookie value is treated as logged out                                                                     |
| AUTH-13 | A logged-in user visiting `/login` is sent to the app _(confirm)_                                                            |

### 4.2 Catalog CRUD (CAT)

| ID     | Scenario                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 | Add a board game with every field (players, time, complexity, min age, tags, description, notes); detail page shows each `@smoke` |
| CAT-02 | Add a card game, RPG (system, book kind), video game, puzzle, other; type-specific fields appear only for the right type          |
| CAT-03 | Title required; invalid numbers (min > max players, complexity 0 or 6, negative time) are rejected with a message                 |
| CAT-04 | Edit a game; changes persist; tags added and removed; tag casing deduplicated (first spelling wins)                               |
| CAT-05 | Delete a game; confirm it disappears from list, direct URL gives 404, its copies are gone                                         |
| CAT-06 | Cover upload: valid png and jpg display on detail page and grid                                                                   |
| CAT-07 | Cover upload rejects a non-image renamed to `.png`, and an oversize file, with a clear message                                    |
| CAT-08 | Replace a cover; the old file is no longer served                                                                                 |
| CAT-09 | Game with no cover shows a placeholder, not a broken image                                                                        |
| CAT-10 | Titles with quotes, ampersands, emoji, RTL text and 300 characters render escaped and unclipped; `<script>` title is inert        |
| CAT-11 | Double-clicking Save creates exactly one game                                                                                     |
| CAT-12 | Unsaved-form navigation: Cancel returns without saving                                                                            |
| CAT-13 | Unknown game id and malformed id return 404, not a 500                                                                            |

### 4.3 Copies (COPY)

| ID      | Scenario                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------- |
| COPY-01 | Add a copy with format, platform, condition, owner, location, price; row shows all of them `@smoke` |
| COPY-02 | Two copies of one game with different owners/locations both list                                    |
| COPY-03 | Delete a copy; the other copy and the game remain                                                   |
| COPY-04 | Price accepts cents (12.99), rejects negatives; stored and displayed consistently                   |
| COPY-05 | Owner and location selects list current members and locations only                                  |
| COPY-06 | Video-game copy with platform shows up under the platform filter/badge                              |

### 4.4 Browsing, search and filters (BRW)

Seed 30+ varied games through `db.ts`.

| ID     | Scenario                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------ |
| BRW-01 | Empty library shows an empty state with an Add game call to action `@smoke`                      |
| BRW-02 | Text search matches title substring, case-insensitively; no-match shows empty state              |
| BRW-03 | Type filter; player-count filter (game that supports exactly N, ranges at the edges); max-time   |
| BRW-04 | Tag filter and location filter                                                                   |
| BRW-05 | Combined filters narrow results; Clear resets; filters live in the URL, so reload and back work  |
| BRW-06 | Result count is shown and correct                                                                |
| BRW-07 | Grid with 500 games renders in reasonable time and does not truncate silently _(confirm paging)_ |
| BRW-08 | Clicking a card opens the detail page; breadcrumbs/back return to the same filtered list         |

### 4.5 Settings: people and locations (SET)

| ID     | Scenario                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| SET-01 | Admin adds a member and a restricted profile; both can log in (new context) `@smoke`                             |
| SET-02 | Duplicate email shows an error and creates nothing                                                               |
| SET-03 | Weak password rejected                                                                                           |
| SET-04 | Admin adds top-level and nested locations; owner/location selects on copies reflect them                         |
| SET-05 | Member (M) does not see People or Guest links sections; direct server action calls are refused _(confirm scope)_ |
| SET-06 | Restricted (R) cannot reach settings that modify data _(confirm what R sees)_                                    |
| SET-07 | Settings page renders for every role without console errors (regression for the `List.Item` crash)               |

### 4.6 Household visibility, restricted profile (VIS) `@security`

Seed: one `normal` game, one `hide_images` game with a cover, one `hidden_restricted` game with a
cover and notes, all with prices/notes.

| ID     | Scenario                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| VIS-01 | R's list shows the normal and hide_images games, not the hidden one                                                                    |
| VIS-02 | R's text search and filters never surface the hidden game (search its exact title; filter by its tag)                                  |
| VIS-03 | R opening the hidden game's URL gets 404                                                                                               |
| VIS-04 | R requesting the hidden game's cover endpoint gets 404/403, not the bytes                                                              |
| VIS-05 | hide_images game: title is visible, image is a placeholder in grid and detail, and its cover endpoint refuses R                        |
| VIS-06 | A and M see all three games and covers                                                                                                 |
| VIS-07 | R sees no Edit/Delete/Add game/copy controls; notes and prices are not in the page HTML (assert on `page.content()`, not just visible) |
| VIS-08 | R replaying a mutating request (POST server action for create, edit, delete, add copy) is rejected and changes nothing                 |
| VIS-09 | R cannot see the hidden game in Loans, Wishlist, Play log selects, or play history _(confirm per page)_                                |
| VIS-10 | Import page is inaccessible to R                                                                                                       |
| VIS-11 | Changing a game's visibility from A takes effect for R on the next request (no stale cache)                                            |
| VIS-12 | Nav for R omits links to areas R cannot use                                                                                            |

### 4.7 Guest links (GST) `@security`

All guest assertions run in a fresh browser context with no cookies.

| ID     | Scenario                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GST-01 | Admin creates a link; the URL is shown once with a copy button; label and status listed `@smoke`                                               |
| GST-02 | The guest URL lists only games with "Allow on guest links"; others absent from list, search and by direct URL (404)                            |
| GST-03 | hideTypes excludes whole types; hideTags excludes games with those tags                                                                        |
| GST-04 | showNotes and showLocations default off; each switch exposes only its own field                                                                |
| GST-05 | Page HTML and network responses never contain price, owner, condition, ratings, internal ids of hidden games, or purchase data (grep the body) |
| GST-06 | Guest search works and respects the same filters                                                                                               |
| GST-07 | Guest cover route serves shareable games' covers, 404 for hidden games and unknown ids                                                         |
| GST-08 | Expired link (backdate) returns 404; status label shows Expired in settings                                                                    |
| GST-09 | Revoke from settings: link 404s immediately; label shows Revoked                                                                               |
| GST-10 | Unknown/garbled token returns 404; response is `noindex`                                                                                       |
| GST-11 | Guest cannot reach `/games`, `/settings`, `/api/games/:id/cover` (redirect/401)                                                                |
| GST-12 | Token is stored hashed: DB `share_links` contains no raw token (SQL check)                                                                     |
| GST-13 | Two links with different restrictions behave independently                                                                                     |
| GST-14 | Admin-only: M and R cannot create or revoke links                                                                                              |
| GST-15 | A game made non-shareable or deleted disappears from an existing link immediately                                                              |

### 4.8 CSV import (IMP)

| ID     | Scenario                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| IMP-01 | Valid CSV imports N games with types, tags, platform, location; result summary matches `@smoke`               |
| IMP-02 | Header aliases (`name`, `game`, `min_players`, ...) are recognized                                            |
| IMP-03 | Rows with errors are reported by line number; valid rows still import _(confirm: partial vs all-or-nothing)_  |
| IMP-04 | Quoted fields with commas, escaped quotes, embedded newlines, CRLF and BOM                                    |
| IMP-05 | Re-importing the same file: duplicate handling matches current behavior _(confirm: skip, merge or duplicate)_ |
| IMP-06 | Unknown location names are created or flagged as designed _(confirm)_                                         |
| IMP-07 | Empty file, header-only file, non-CSV file, and a 5,000-row file fail or succeed gracefully                   |
| IMP-08 | Imported games appear in the list and carry correct `household_id` (DB check)                                 |
| IMP-09 | Only A/M can import                                                                                           |

### 4.9 Loans (LOAN)

| ID      | Scenario                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| LOAN-01 | Lend a copy to a borrower with a due date; appears under active loans `@smoke` |
| LOAN-02 | Lend without a due date works                                                  |
| LOAN-03 | Past due date shows an overdue flag; future date does not                      |
| LOAN-04 | Mark returned; moves to history, copy is lendable again                        |
| LOAN-05 | A copy already on loan cannot be lent again _(confirm)_                        |
| LOAN-06 | Borrower required; whitespace-only borrower rejected                           |
| LOAN-07 | Loan state is visible on the game's detail page _(confirm)_                    |
| LOAN-08 | Deleting a game or copy with an active loan behaves sanely (no 500)            |

### 4.10 Wishlist (WISH)

| ID      | Scenario                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| WISH-01 | Add an item with type, link, price, notes; listed `@smoke`                                                          |
| WISH-02 | Link must be a valid URL or empty; non-http schemes (`javascript:`) rejected and never rendered as a clickable href |
| WISH-03 | Convert to catalog: creates the game (and a copy per design), removes the wishlist item                             |
| WISH-04 | Delete an item                                                                                                      |
| WISH-05 | Restricted profile cannot add or convert                                                                            |

### 4.11 Play log and stats (PLAY)

| ID      | Scenario                                                                           |
| ------- | ---------------------------------------------------------------------------------- |
| PLAY-01 | Log a play with date, minutes, players, winner, notes; appears in history `@smoke` |
| PLAY-02 | Defaults: date defaults to today when blank                                        |
| PLAY-03 | Most-played ranking updates after logging; ties handled deterministically          |
| PLAY-04 | Neglected games list shows games with no recent plays and drops a game once played |
| PLAY-05 | Comma-separated players are split and trimmed; empty entries ignored               |
| PLAY-06 | Delete a play                                                                      |
| PLAY-07 | Hidden-from-restricted games do not appear in R's play log or stats                |

### 4.12 Barcode and UPC (UPC) `@external`

UPC is not BGG, so it is in scope. It uses the mock server.

| ID     | Scenario                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UPC-01 | Entering a known UPC fills the title from the mock                                                                                                                         |
| UPC-02 | Unknown UPC, 429/500 from upstream, and malformed JSON produce a friendly message, not a crash                                                                             |
| UPC-03 | Invalid code lengths rejected without an upstream request (assert on mock's request log)                                                                                   |
| UPC-04 | With `addInitScript` stubbing `BarcodeDetector` to return a fixed code, the scan button fills the title; without `BarcodeDetector`, the scan control is hidden or disabled |

### 4.13 Cross-cutting (X)

| ID   | Scenario                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X-01 | **Route x role smoke matrix** `@smoke`: every route visited as Anon, R, M, A and G; assert expected status/redirect and zero console errors                                       |
| X-02 | Household isolation: second household (via `db.ts`) has its own game; A of household 1 gets 404 for its id, covers, copies, plays, loans, and cannot see it in any list or select |
| X-03 | Color scheme: light, dark and auto render; the stored preference survives reload; no flash or console warning (regression for the script-tag warning)                             |
| X-04 | Mobile viewport (390x844): nav burger works, forms usable, grid reflows, no horizontal scroll                                                                                     |
| X-05 | Accessibility: axe scan with no serious/critical violations on login, games list, game detail, game form, settings, guest list                                                    |
| X-06 | Keyboard: tab order through the game form; Enter submits; Escape closes Mantine popovers                                                                                          |
| X-07 | `GET /api/health` returns 200 and a body that does not leak config `@smoke`                                                                                                       |
| X-08 | Startup: against an empty DB the app migrates itself; with `AUTO_MIGRATE=false` it does not _(separate CI invocation)_                                                            |
| X-09 | Security headers/cookies: no secrets in HTML, `__NEXT_DATA__`-style payloads, or RSC payloads for restricted/guest pages                                                          |
| X-10 | Unknown routes show a 404 page; server action errors show a message, not a stack trace                                                                                            |
| X-11 | Stored cover files live under `DATA_DIR`; deleting a game removes its file                                                                                                        |
| X-12 | Docker smoke (CI only, nightly): build the image, `docker compose -f docker-compose.prod.yml up`, run the `@smoke` subset against it                                              |

## 5. Mocked external APIs (BGG and UPC)

### Why not `page.route`

`page.route` only intercepts requests the browser makes. BGG and UPC calls are made by the Next.js
server (`fetch` inside route handlers), so the mock has to be a real HTTP server the app is
configured to call.

### Design

- `e2e/mocks/external-server.ts`: a small Node `http` server started by Playwright's second
  `webServer` entry on a fixed port (for example 4010), with `reuseExistingServer` off in CI.
- Routes mirror upstream:
  - `GET /bgg/search?type=boardgame&query=...` and `GET /bgg/thing?id=...&stats=1` return XML from
    `e2e/fixtures/bgg/*.xml` (real-shaped samples trimmed to the fields the parser reads).
  - `GET /upc/lookup?upc=...` returns JSON.
- Verifies the `Authorization: Bearer <BGG_API_TOKEN>` header and answers 401 if absent, so the
  app's auth header handling is tested too.
- Magic inputs trigger failure modes: query `__202` returns 202 ("preparing"), `__500` returns a
  500, `__slow` delays past the 10s timeout, `__garbage` returns malformed XML, `__empty` returns
  zero results, `__many` returns 25 hits (app should cap at 10).
- Control endpoints, available only to tests: `GET /__requests` (ordered request log with
  headers and query) and `POST /__reset`. Tests use them to assert request counts, for example
  "one search request per search, one detail request per pick, none in the background".
- App wiring: `BGG_BASE_URL=http://localhost:4010/bgg`, `UPC_BASE_URL=http://localhost:4010/upc`,
  `BGG_API_TOKEN=test-token`. Production defaults are unchanged.
- A unit-level guard (vitest): with the env vars unset, the base URLs equal the real ones, so a
  misconfigured test env cannot silently ship.

### Deferred BGG scenarios (BGG-xx), written after the harness exists

| ID     | Scenario                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| BGG-01 | Search shows at most 10 hits with year; picking one fills title, players, time, age, complexity, tags, description |
| BGG-02 | Description truncated to 2,000 characters; entities decoded; categories capped at six                              |
| BGG-03 | Not configured (no token): friendly message, no upstream request                                                   |
| BGG-04 | 202, 500, timeout and malformed XML each show a retryable error                                                    |
| BGG-05 | Restricted profile gets 403 from the lookup API and sees no lookup control                                         |
| BGG-06 | Request log proves on-demand behavior (matches the README claims)                                                  |
| BGG-07 | Prefilled fields stay editable and nothing is saved until the form is submitted                                    |
| BGG-08 | When cover fetching is built: images fetched once per pick, stored under `DATA_DIR`, never hotlinked               |

## 6. Phasing

| Phase | Scope                                                                                       | Why first                               |
| ----- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| P0    | Config, global setup, `db.ts`, console guard, role storageStates, X-01, X-07, AUTH-01 to 09 | Smoke net for render-time crashes       |
| P1    | CAT, COPY, BRW, SET                                                                         | Core daily use                          |
| P2    | VIS, GST, X-02, X-09                                                                        | Privacy guarantees; highest consequence |
| P3    | IMP, LOAN, WISH, PLAY                                                                       | Secondary features                      |
| P4    | UPC and mock server, X-03 to X-06, X-08, X-10, X-11                                         | Polish and robustness                   |
| P5    | CI job, sharding, Firefox/WebKit smoke, Docker smoke (X-12)                                 | Automation                              |
| P6    | BGG-xx scenarios                                                                            | Deferred per scope                      |

Rough size: about 150 tests. With a single worker and a prebuilt app, expect a full Chromium run
of 6 to 10 minutes; `@smoke` under a minute.

## 7. CI sketch

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      { image: 'postgres:17', env: { ... }, ports: ['5432:5432'], options: --health-cmd pg_isready }
  steps:
    - checkout, jdx/mise-action, pnpm install
    - cache ~/.cache/ms-playwright; pnpm exec playwright install --with-deps chromium
    - pnpm build
    - pnpm e2e # config starts the app and the mock server
    - upload-artifact: playwright-report/ and test-results/ (always on failure)
```

Run on every push to `main` (and PRs, once those exist). The nightly job adds Firefox, WebKit and
the Docker smoke run.

## 8. Risks and open questions

- Mantine widgets (Select, TagsInput, FileInput, NumberInput) need small helpers; budget time in P0.
- Server actions use opaque ids, so VIS-08 replays are done by capturing the request from a real
  submit, then replaying it under R's cookie, rather than hand-building the request.
- A single shared DB makes parallelism impossible until the per-worker database option is built.
- Several _(confirm)_ items hinge on behavior I have not checked, mainly import duplicates, lending
  an already-lent copy, and what exactly R may see in Settings. Decide the intended behavior first
  where the app is ambiguous, then pin it with a test.
- If you want rating-related assertions (guest "hides personal ratings"), note that per-person
  ratings are not built yet (v1.5), so GST-05 currently asserts on price, owner and condition.
