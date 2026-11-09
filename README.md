# Game Library

A self-hosted web app for a household's game collection: board games, card games, RPG books and
console video games. Built with Next.js, Mantine, PostgreSQL and Drizzle.

## Features

- Catalog with type-specific details (players, play time, complexity; RPG system and book kind),
  tags, cover images, and multiple copies per title (owner, location, condition, platform, price)
- A shelf-style library: covers stand on planks, with server-side paging, sorting and filter counts
  (availability, type, players, time, location, owner, tags)
- Household profiles. A **restricted** profile (for kids) is read-only and never sees games marked
  hidden, or their cover images when marked "hide images". This is enforced on the server.
- CSV import, BoardGameGeek lookup, and barcode scanning (on browsers with `BarcodeDetector`)
- Guest links (`/g/<token>`): read-only, expirable, revocable. Guests see only games marked
  "Allow on guest links"; ratings, prices, owners and condition are never exposed, and each link can
  hide whole types or tags and opt in to notes and locations
- Loans (most have no due date; late ones are flagged) with one-tap lending to earlier borrowers, a
  wishlist per person that converts into catalog entries, per-person ratings, and a play log that
  records who played (friends need no account; an admin can link them to an account later or merge
  duplicates), with most-played and not-played-in-a-year lists
- An activity trail of who changed what, and a game-night picker on guest links
- Phone-first layouts with a tab bar, bottom sheets for forms, and light and dark themes

## Local development

```sh
mise install                 # node + pnpm versions from mise.toml
pnpm install
docker compose up -d db      # Postgres on localhost:5432
cp .env.example .env
pnpm dev                     # migrations run automatically on start
```

Open http://localhost:3000. The first visit asks you to create the household and admin account.

Checks: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Tests run the real migrations against an in-process Postgres (PGlite), so no database is needed.

## Deploying (Proxmox VM or LXC with Docker, reachable over Tailscale)

```sh
cp .env.example .env         # set POSTGRES_PASSWORD (and BGG_API_TOKEN if you want lookups)
docker compose -f docker-compose.prod.yml up -d --build
```

- The app listens on port 3000 (`APP_PORT` to change it). Migrations run on startup.
- Install Tailscale on the VM/LXC to give it its own tailnet address. To serve it over HTTPS on the
  tailnet, run `tailscale serve --bg 3000` and set `COOKIE_SECURE=true`.
- Uploaded images live in the `app-data` volume and the database in `db-data`.
- Back up with `scripts/backup.sh` (run it from cron); it keeps the newest 14 backups of each.
  To restore: `gunzip -c db-<stamp>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U games -d games`.

## Configuration

| Variable        | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `DATABASE_URL`  | Postgres connection string (required)               |
| `DATA_DIR`      | Where uploaded images are stored (default `./data`) |
| `BGG_API_TOKEN` | BoardGameGeek API token, enables title lookup       |
| `COOKIE_SECURE` | `true` when served over HTTPS                       |
| `AUTO_MIGRATE`  | `false` to skip migrations on start                 |

## BoardGameGeek integration

Optional. When `BGG_API_TOKEN` is set, the "Look up" button on the add-game form queries the
[BoardGameGeek XML API](https://boardgamegeek.com/wiki/page/BGG_XML_API2) to prefill a game's
title, description (truncated), player counts, play time, minimum age, complexity and up to six
categories. Fetching cover images from BGG is planned but not implemented yet; today covers are
uploaded manually. When added, it will follow the same rules below (on demand, one game at a
time, stored only on your own instance).

- Lookups happen only on demand when a signed-in, non-restricted household member searches (one
  search request returning up to 10 results) and picks a result (one detail request). There is no
  bulk crawling, background syncing or scheduled polling.
- Requests are authenticated with your own token; nothing is proxied through a third party.
- Fetched data is saved only to your own self-hosted instance for personal catalog use. It is never
  republished, and guest links expose only the games you explicitly allow.
- This is a non-commercial, self-hosted project. Data and images belong to BoardGameGeek and its
  contributors; "Powered by BoardGameGeek".

## License

[MIT](LICENSE). See `AGENTS.md` for architecture rules and conventions.
