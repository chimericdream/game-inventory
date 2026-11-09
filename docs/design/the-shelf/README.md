# The Shelf: redesign of the whole app

**Direction.** The library is shown as an actual shelf. Each game is a flat, colour-coded cover standing on a wood plank, so the catalog reads as a wall of boxes rather than a table of records. Warm stone ground, forest green for actions, berry for anything out on loan or wrong. Fraunces for titles, Figtree for everything else. Light is primary, and dark follows `prefers-color-scheme` (or `?theme=dark` for screenshots). Browse everything from `source/index.html`.

**Screens.** All 7 requested groups are designed, plus the earlier four, with phone, desktop and dark and the key states.

| Screen | What it is |
|---|---|
| Catalog | A sentence instead of KPI tiles ("287 games on 9 shelves. 4 are out on loan: 1 overdue, 2 due this week."), large "Do we own...?" search, loans as berry tags on covers. |
| Game detail | Cover on its plank, facts as big numerals, notes, two copies (one lent), plays, win tally and neighbours. |
| Loans | A rope timeline of the next 18 days with covers hanging at their due date, grouped by urgency, with a persistent lend panel. |
| Guest share | No app chrome; a "Game night" picker (players, time) whose headline is the answer. |
| Plays | Recent plays, most played, "Not played in a year" with one-click log, and a ten-second log panel that remembers the last group. |
| Add / edit game | Type first, then a title lookup with suggestions and failure handling. Fields change per type. Cover, three-way visibility, guest-link switch. |
| Add copy | Owner, nested location tree with counts, condition, price, date. Empty state for a game with no copies. |
| Wishlist | Lists by person, with a birthday banner and gift hints. Link validation. |
| Import | A CSV intake that checks the columns before importing, with honest summaries for success, partial success and refusal. |
| Settings | People, Locations and Guest links as sub-tabs. The one-time link is shown once with Copy. Members see the same pages read-only. |
| Sign in and first run | A wall of the family's own covers beside one short form. Failed, redirected and first-run setup variants. |
| Restricted profile | A trimmed nav, hidden games absent (counts still add up), and a designed "no picture" tile for hidden images. Read-only detail. |
| Dead ends | 404, hidden game (looks like a 404), expired, revoked and unknown guest links, each with a shelf with one empty slot. |
| More (phone) | The tab that holds Import, Settings, Guest links and Sign out on phones. |

**Navigation decisions.** One pill bar on desktop: Library, Loans (4), Plays, Wishlist (7), Import, Settings, Add game and the user. Only queues that need attention carry a count. On phones this becomes a bottom tab bar (Library, Loans, Plays, Wishlist, More). The restricted profile gets Library, Plays and Wishlist only.

**Structural ideas to push further.**
- **Make location the primary structure.** Group the catalog by real shelf ("Basement > Shelf 3") and draw each shelf as one plank. A loaned game would leave a visible gap with its tag standing in the slot. The nested location tree in Settings and the add-copy picker already treat it as a first-class thing.
- **Make "game night" a member mode too.** The guest picker (how many are playing, how long) works for the family. A phone "Find it" mode would use the same idea: type a title, get the shelf and the slot.
- **Make copies first-class everywhere.** "Which one is out" is the question the family actually asks. Loans, detail and Add copy all lead with copies already.
- **One form pattern.** Add/edit, add copy, wishlist, people and links all use the same card, field and chip components. Further forms would cost almost nothing.
- **Lend and log as sheets or panels, not pages.** They are 10-second tasks done mid-conversation.

**Proposals that change behaviour or add features that were not in the facts given.** Treat each as a suggestion to confirm, not as existing behaviour.
1. Newest-first as the catalog's default sort, with the sort label and order matching.
2. "Same group as last time" shortcut and a "No winner" option in the play log.
3. "Not played in a year" with a one-click log on each row (the list itself was in the facts, the shortcut is mine).
4. Wishlist grouped by person, with a birthday banner and a "Hint for gift-givers" field. No "claim this gift" feature is drawn, but it is the obvious next step.
5. Title lookup that says what it filled, and a retry button on failure (the lookup was in the facts, the wording and states are mine).
6. Complexity picked as five numbered buttons, and book kind (Rulebook, etc.) as a field for RPG books.
7. Import checks columns first and lets the user download the rows that failed. It also lists "not used" columns.
8. Guest links: showing the full URL once with Copy was in the facts. A "Hides: ..." summary on each row is mine.
9. Distinct expired, revoked and unknown guest-link pages. Security may prefer one generic page for unknown links.
10. Guest page "Game night" picker (players, time) and availability shown as "Back Nov 16" with no borrower name.
11. Restricted profile: the plain "no picture" tile, and the hidden-game page that looks identical to a 404, so hidden games don't confirm they exist.
12. Phone "More" tab, and a bottom tab bar replacing the top nav.
13. "Remind" action on late loans, and a borrower history line in the lend panel ("Jonas has borrowed 1 game before and returned it on time").
14. Copy counts on every location, and "can't delete a place that has copies".
15. The household name ("The Hartwell family library") on the sign-in wall and the guest page. The first-run form asks for it.

**Files.** All screenshots are full-page unless noted as a viewport shot. States are reachable via URL parameters: `?q=ca`, `?type=Board`, `?sheet=1`, `?open=catan`, `?state=...`, `?s=...`, `?m=...`, `?k=...`, `?err=...`, `?role=member`, `?theme=dark`.

| File | What it is |
|---|---|
| `source/index.html` | Contact sheet linking every page and state |
| `source/style.css`, `forms.css`, `data.js`, `ui.js`, `kidui.js` | Shared tokens and components, demo data and cover art, shared helpers, restricted-profile helpers |
| `source/catalog.html`, `detail.html`, `loans.html`, `guest.html` | The first four screens |
| `source/plays.html`, `edit.html`, `addcopy.html`, `wishlist.html`, `import.html`, `settings.html`, `signin.html`, `kid.html`, `kidgame.html`, `dead.html`, `more.html` | Round 3 screens |
| `01`-`03` | Catalog: desktop, phone, dark |
| `04`-`06` | Catan detail: desktop, phone, dark |
| `07`-`09` | Catalog states: search, phone filter sheet (viewport), phone dark |
| `10`-`13` | Loans: desktop, phone, dark, phone lend sheet (viewport) |
| `14`-`17` | Guest share: desktop, phone, dark, phone game sheet (viewport) |
| `18`-`22` | Plays: desktop, phone, dark, phone log sheet (viewport), empty state |
| `23`-`27` | Add/edit: lookup open, phone, dark, RPG with title and image errors, phone lookup failed |
| `28`, `29`, `29b` | Add copy: empty state desktop, phone, dark |
| `30`-`33` | Wishlist: desktop, phone with link error, dark, empty |
| `34`-`38b` | Import: before choosing, phone with file chosen, dark partial success, refused file, phone success, desktop file chosen |
| `39`-`46` | Settings: people desktop, phone with duplicate email, dark, short password, locations, link just created, phone links, member read-only |
| `47`-`52` | Sign in: desktop, phone failed, dark, redirected, first-run desktop, first-run phone |
| `53`-`57` | Restricted profile: library desktop, phone, dark, game with hidden image desktop and phone |
| `58`-`62` | Dead ends: hidden game, 404 phone, expired link phone, revoked link desktop, unknown link dark |
| `63` | The phone "More" tab |
| `CRITIQUE.md` | Critique log: sources, decisions, declined skill recommendations |
