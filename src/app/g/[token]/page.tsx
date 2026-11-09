import { IconBooks } from '@tabler/icons-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GameTile } from '@/components/shelf/GameTile';
import shelfClasses from '@/components/shelf/Shelf.module.css';
import { LinkButton } from '@/components/Links';
import { intParam, textParam } from '@/server/data/catalogFilters';
import {
  guestCatalog,
  guestCatalogCount,
  resolveShareLink,
  type GuestFilters,
} from '@/server/data/guest';
import { getDb } from '@/server/db/client';

import { SearchBox } from '../../(app)/games/SearchBox';
import classes from './Guest.module.css';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

const PAGE = 48;
const MAX = 240;
const PLAYER_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8];
const TIME_CHOICES = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

type SearchParams = Record<string, string | string[] | undefined>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function link(token: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();
  return qs ? `/g/${token}?${qs}` : `/g/${token}`;
}

export default async function GuestHome({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const db = getDb();
  const shared = await resolveShareLink(db, token);
  if (!shared) notFound();

  const players = intParam(sp, 'players');
  const maxMinutes = intParam(sp, 'maxMinutes');
  const search = textParam(sp, 'q');
  const more = textParam(sp, 'more') === '1';
  const filters: GuestFilters = { search, players, maxMinutes };
  const [games, total] = await Promise.all([
    guestCatalog(db, shared, { ...filters, limit: more ? MAX : PAGE }),
    guestCatalogCount(db, shared, filters),
  ]);

  const current = {
    players: players ? String(players) : undefined,
    maxMinutes: maxMinutes ? String(maxMinutes) : undefined,
    q: search,
  };
  const timeLabel =
    TIME_CHOICES.find((t) => t.minutes === maxMinutes)?.label ?? `${maxMinutes} min`;
  const headline =
    total === 0
      ? 'Nothing fits that'
      : players || maxMinutes
        ? `${plural(total, 'game')} ${[
            players ? `for ${plural(players, 'player')}` : null,
            maxMinutes ? `in ${timeLabel === '1 hour' ? 'an hour' : timeLabel}` : null,
          ]
            .filter(Boolean)
            .join(' ')}`
        : `${plural(total, 'game')} to look through`;

  return (
    <div className={classes.page}>
      <div className={classes.top}>
        <span className={classes.brand}>
          <IconBooks size={28} stroke={1.8} aria-hidden />
          Game Library
        </span>
        <span className={classes.readOnly}>Read-only</span>
      </div>

      <h1 className={classes.title}>What shall we play?</h1>
      <p className={classes.lead}>Shared with you · {shared.label}</p>

      <section className={classes.picker} aria-labelledby="game-night">
        <h2 id="game-night">Game night</h2>
        <p className={classes.privacy} style={{ marginTop: -8, marginBottom: 16 }}>
          Tell us who is playing and for how long, and we will show what fits.
        </p>
        <p className={classes.question}>How many are playing?</p>
        <div className={classes.chips}>
          {PLAYER_CHOICES.map((n) => (
            <Link
              key={n}
              href={link(token, { ...current, players: players === n ? undefined : String(n) })}
              className={classes.chip}
              aria-current={players === n}
              aria-label={plural(n, 'player')}
            >
              {n}
            </Link>
          ))}
        </div>
        <p className={classes.question}>How long do you have?</p>
        <div className={classes.chips}>
          {TIME_CHOICES.map((t) => (
            <Link
              key={t.minutes}
              href={link(token, {
                ...current,
                maxMinutes: maxMinutes === t.minutes ? undefined : String(t.minutes),
              })}
              className={classes.chip}
              aria-current={maxMinutes === t.minutes}
              aria-label={`Up to ${t.label}`}
            >
              {t.label}
            </Link>
          ))}
          <Link
            href={link(token, { ...current, maxMinutes: undefined })}
            className={classes.chip}
            aria-current={!maxMinutes}
          >
            Any
          </Link>
        </div>
        <p className={classes.question}>Or look for a title</p>
        <SearchBox />
        <p className={classes.privacy}>
          Ratings, prices and who has what are never shown on shared links.
        </p>
      </section>

      <h2 className={classes.headline}>{headline}</h2>
      {games.length > 0 && (
        <p className={classes.sub}>
          Showing {games.length} of {total}, sorted by title.
        </p>
      )}

      {games.length === 0 ? (
        <p className={classes.empty}>No games to show.</p>
      ) : (
        <ul className={shelfClasses.shelf}>
          {games.map((g) => (
            <GameTile
              key={g.id}
              game={{
                id: g.id,
                title: g.title,
                type: g.type,
                hasCover: g.coverImage !== null,
                platforms: g.platforms,
                minPlayers: g.board?.minPlayers ?? null,
                maxPlayers: g.board?.maxPlayers ?? null,
                playTimeMinutes: g.board?.playTimeMinutes ?? null,
                loan: null,
              }}
              href={`/g/${token}/${g.id}`}
              coverUrl={`/g/${token}/cover/${g.id}`}
            />
          ))}
        </ul>
      )}
      {!more && total > games.length && (
        <div className={classes.more}>
          <LinkButton href={link(token, { ...current, more: '1' })} variant="default">
            Show more
          </LinkButton>
        </div>
      )}

      <p className={classes.footer}>
        Shared from a family’s game library. This page can’t change anything.
      </p>
    </div>
  );
}
