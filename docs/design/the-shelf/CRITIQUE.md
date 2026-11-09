# Critique log

Tooling run: `inspect.mjs --app` on all four pages (catalog, detail, loans, guest) at 1440, 768 and 390. `draw.mjs --app --kind community --style accent-ladder` was run to see what the skill would deal. Both ran fine. The skill's app mode is built around dashboards, so several of its rules (KPI tiles, chart hues, 18-32px titles) do not map onto a cover-driven library. Each point below says where it came from and what I did.

Final inspector state: catalog 4 FAIL / 4 WARN, detail 4 / 7, loans 1 / 2, guest 1 / 1. Every remaining item is declined below with a reason.

## Fixed after the first review

| # | Source | Finding | Action |
|---|---|---|---|
| 1 | Coordinator | Label said "Recently added first" next to "Sort Title A-Z", and the order was neither. | Sort control now reads "Newest first", which matches the data order. The left label shows "Showing 24 of 287". |
| 2 | Coordinator | Planks overhung the right margin. | `overflow-x: clip` on the shelf, so planks end flush with the last cover. |
| 3 | Coordinator | Empty left column on detail. | Added "Who wins at Catan" (4+3+2+1+1 = 11 plays, matching the header) and "Nearby on the shelf" (4 covers with names). Hidden on phones, where they would crowd the top of the page. |
| 4 | Own | The "4 players" chip looked pressed while the grid was unfiltered, and the sheet said "Show 11 games" with no filter. | Chip unpressed, sheet button now says "Show 287 games". |
| 5 | Own | Numbers did not agree. | Added the 4th loan (Betrayal, Grandma Jo, 4 days late). Summary now reads "4 out: 1 overdue, 2 due this week", which matches the Loans screen. Type counts sum to 287, locations to 287. |
| 6 | Skill: `tiny-text` | Cover subtitles rendered at 4-7px on phone thumbnails. | Cover subtitles only show when the cover is 150px wide or more. The nearby thumbnails use a 12px caption instead. |
| 7 | Skill: `tiny-text` | Loan tags were 10px on phone covers. | Raised to 11px. The cover title is hidden when a tag is present. |
| 8 | Skill: `gradient` | The no-cover placeholder used a repeating gradient. | Flat tone plus a dashed outline. |
| 9 | Skill: `tabular` | Only 43% of figures used tabular numerals. | `tabular-nums` set globally. |
| 10 | Skill: `panel-void` | "Sam's copy" card had an 87px blank band. | "Lend out" is pinned to the card foot, which is the allowed use of a stretched card. |
| 11 | Own | Phone detail showed a 2-up of rating and wins cards that fought the title. | Wins and nearby are desktop-only. |
| 12 | Own, found by looking | The guest availability chip reused the `.out` class and rendered as a full-width berry bar. | Renamed to `.busy`. |
| 13 | Skill: `headline-lines` | Tablet used 3 very wide columns, so cover titles wrapped to 3 lines. | 4 columns between 601 and 860px. |
| 14 | Own | A late loan's due text wrapped to two lines on phones, and history dates collided. | Due text is nowrap, and the late row puts the due line above the buttons. |

## Declined skill recommendations

| Skill rule | Rationale |
|---|---|
| `font-not-dealt` (DM Sans was dealt) | Fraunces plus Figtree is the product's identity. Warm, bookish serif titles are what make it read as a family shelf and not as an admin tool. DM Sans would be the generic result the brief asked to avoid. The two-face limit is respected. |
| `rainbow-chart` (13 hues) | These are cover art, not chart series. Cover colour is the data's own identity: each game is recognised by its colour from across a room. The chrome around them is neutral plus one green and one berry. |
| `colour-sprawl` (23% coloured) | Same reason. The covers are the content. In the Loans and Guest screens, which have much less art, the inspector reports almost none. |
| `gradient` on `.ct` (scrim under cover titles) | The rule itself allows a neutral scrim over a picture for legibility. Without the scrim, light titles on light motifs fail contrast. |
| `palette-cream` (text #f4ead2) | This is the colour of a title printed on the Ticket to Ride cover, not a page ground. The page ground is a cool stone. |
| `app-title-size` (title should be 18-32px) | Home, detail and guest pages are the place where the family's voice lives. I trimmed the Library and Loans titles from 52px to 44px for density, but did not go to 24px. The skill's target is for tool screens in long sessions. Detail keeps 84px because a game title is the object of the page. |
| `below-fold` (only 8/21 blocks on first screen) | A catalog is a scroll surface. The first screen already shows the summary, search, filters and two rows of covers, which answer the home question. |
| `mixed-font-headline` | These are small caption-plus-title pairs inside covers and badges beside headings, not headlines that switch face mid-line. |
| `covered-text` at 768 ("3-4" 50% hidden) | The page header is sticky and the checker sampled mid-scroll. Verified visually that the text is not obscured at rest. |
| `panel-void` on the "G" placeholder | The big faint initial is the placeholder's artwork. |

## Own judgement calls (not from the skill)

| # | Area | Finding | Action |
|---|---|---|---|
| a | Usability at the shelf | The main job is "do we own this?". | Search is the largest control on the catalog and is worded as that question. On phones it sits above the chips, and results keep the loan state visible on the cover. |
| b | Touch targets | Desktop chips are 32px. | Acceptable on a laptop. On phones chips are 38-44px, tab items 56px+, and sheet controls 40px+. |
| c | Contrast | Berry tag text and muted greys. | Checked by eye in both themes. Dark mode flips berry to a light pink with dark text. Muted text is about 5:1 or better. |
| d | Density | Catalog cards waste height on the second metadata line for games with long titles. | Titles clamp to 2 lines. I did not shrink the covers, because recognition from the art matters more than showing more rows. |
| e | Fit | Dashboard-style KPI tiles would not suit a family library. | I used sentences ("4 are out on loan: 1 overdue...") and let the loan tags and rope timeline carry the status. |
| f | Loans | Four loans do not need a table. | A rope timeline shows the next 18 days with covers hanging at their due date, and the list below is grouped by urgency in words (Late, Due this week, Later). The lend flow is a persistent right panel on desktop and a sheet on phones. |
| g | Guest | Guests should not see anything the family has not allowed. | Hidden RPG books are absent, and there are no ratings, notes, prices or shelf locations. Availability shows "Back Nov 16" with no borrower. A line on the page says what is private. |
| h | Dark mode | Light covers on a dark ground can glare. | Left as is. Flat covers have no highlights, and the dark ground is a green-black, not pure black. |


---

# Round 3 critique log (screens 18 to 63)

Tooling: `inspect.mjs --app` on every new page (plays, edit, addcopy, wishlist, import, settings, signin, kid, kidgame, dead, more, index) plus the earlier four re-run after changes. The same inspector findings recur on every page, so I log the recurring ones once and then list what is specific to each screen.

## Recurring skill findings, declined on every new page

| Skill rule | Pages | Decision and rationale |
|---|---|---|
| `font-not-dealt` (DM Sans dealt) | all | Declined, as in round 2. Fraunces + Figtree is the product's identity and holds across all 25 screens. |
| `app-title-size` (title should be 18-32px) | all | Declined. Page titles are 44px on working screens, larger on the sign-in and dead-end pages. A family's shelf has a voice, and a 24px "Settings" would read like admin software. |
| `rainbow-chart`, `colour-sprawl`, `palette-cream`, `gradient` on cover titles | signin, kid, catalog | Declined. These are cover art (and a scrim for legibility, which the rule allows). The kid view and sign-in wall are mostly covers by design. |
| `ragged-row` (form beside a sticky side card ends at a different height) | edit, addcopy, wishlist, settings | Declined. These are a long form or list beside a short sticky panel. Stretching the panel would create exactly the empty band the skill warns about elsewhere. |
| `covered-text` at 390 or 768 | edit, wishlist | Declined as a false positive. The page header is sticky, or the save bar is fixed. Content has bottom padding to clear the bar at rest. |
| `mixed-font-headline` | most | Declined. Caption-plus-title pairs and count badges next to headings. |
| `below-fold`, `panel-void` on index and More | index, more | Declined. `index.html` is a developer contact sheet. `More` is a phone-only list, so on desktop the empty half is not a real screen. |

## Changes made because of the skill

| Rule | Page | What changed |
|---|---|---|
| `button-fx` (shadow or glow) | plays, addcopy, loans, detail | Selected states used inset `box-shadow` rings and bars. Replaced by `outline` and `border-left`. The only shadow left is the lookup dropdown, which really floats. |
| `font-count` (3 typefaces) | import | The CSV sample was a styled `div`, so monospace counted as a third face. It is now a `<pre>`, which the skill treats as real code. |
| `hero-void` | plays | Checked the render. It measured the gap beside the sticky panel, not a real void. No change. |

## Own judgement, by screen

| Screen | Finding | Action and reasoning |
|---|---|---|
| Plays | Logging a play is the most frequent family action, and a modal in the way of the history is slow. | A persistent panel on desktop, a sheet on phones. The panel offers "Same group as last time" because most nights are the same four people. The panel is blank in the empty state so it doesn't look like saved data. |
| Plays | "Most played" and "Not played in a year" are different jobs. | Ranking uses thin bars with the figure at the right edge. The dust list is a card with a "Log a play" button on each row, so rediscovering a game is one click. |
| Add / edit | Title lookup could feel like a wizard. | Type, then title, with suggestions in a floating list. Picking a match fills fields and says so in a banner. Failure keeps everything typed and offers retry. Type changes the fields shown and never discards the title. |
| Add / edit | A single "hide" checkbox was not enough for the three visibility options. | Three radio cards with a sentence each, and the guest-link switch separated, because it is a different audience. |
| Add copy | A flat dropdown does not suit a tree of places. | A scrollable indented tree with copy counts and a path chip above it. |
| Wishlist | A list sorted by price tells you nothing. A family uses it for birthdays. | Lists by person, a banner for the next birthday, a "Hint for gift-givers" field. Items are tag-shaped tiles, not covers, because most wished games aren't owned. |
| Import | Partial success is the real world case. | The summary has three honest counts, then lines by number with one reason each. The skipped duplicate is shown differently from the unreadable rows. A refused file explains which column is missing and offers "choose the fixed file". |
| Settings | Three different admin jobs in one page. | Three sub-tabs. The one-time link URL is the loudest thing on the page when it exists, with the warning attached. Members and restricted users see the same layout, read-only, with an explanatory banner, so the reduced version is not a different product. |
| Sign in | The front door should say what this is. | A wall of the family's own covers on shelves, and one short form. Errors never say which of email or password is wrong. First-run setup reuses the same frame so it feels like the same place. |
| Restricted | A hidden image must not feel like a punishment. | A deliberate tile (soft tint from the title, big initial, the kind of game) instead of a dashed "missing" box. Hidden games are simply absent, and the counts add up (287 total, 230 shown). |
| Dead ends | A dead end should still look like the shelf. | One empty slot among real covers. A revoked link gets a tilted tag. The hidden-game page looks identical to a 404, on purpose. |
| Phone | Settings, Import and Sign out had no home on phones. | Added a "More" tab with a list. It carries the profile, Import, Settings, Guest links and Sign out. |
| Consistency | Numbers across screens. | Locations now add up (Basement 142, Living room 96 = 60 + 36, Kids' room 31, Garage 18 = 287; 9 places). Plays, loans and wishlist counts match the nav badges. Weekday names were wrong in two places and are fixed. |
