import { ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CoverTile } from '@/components/shelf/CoverTile';
import { longDate } from '@/lib/dates';
import { requireContext } from '@/server/auth/current';
import { listCatalog } from '@/server/data/catalog';
import { lastPlayGroup, playerStats, playStats, recentPlays } from '@/server/data/plays';
import { listPlayersForPicker } from '@/server/data/players';

import { coverUrl } from '../games/tiles';
import { deletePlayAction } from '../tracking-actions';
import { LogAside, LogSheetButton } from './LogPlay';
import classes from './Plays.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const NEGLECT_PREVIEW = 5;
const RECENT_PAGE = 12;

const weekday = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function monthsSince(iso: string, today: string) {
  const a = new Date(`${iso}T00:00:00Z`);
  const b = new Date(`${today}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function href(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();
  return qs ? `/plays?${qs}` : '/plays';
}

export default async function PlaysPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const sp = await searchParams;
  const playerId = first(sp.player);
  const defaultGameId = first(sp.game);
  const showAll = first(sp.all) === '1';
  const limit = first(sp.more) === '1' ? 60 : RECENT_PAGE;

  const [catalog, plays, stats, who, picker, lastGroup] = await Promise.all([
    listCatalog(ctx, { includeExpansions: true }),
    recentPlays(ctx, limit + 1, { playerId }),
    playStats(ctx),
    playerStats(ctx),
    listPlayersForPicker(ctx),
    lastPlayGroup(ctx),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const hasMore = plays.length > limit;
  const shown = plays.slice(0, limit);
  const dusty = showAll ? stats.neglected : stats.neglected.slice(0, NEGLECT_PREVIEW);
  const top = stats.mostPlayed[0];
  const topCount = top?.plays ?? 1;
  const active = who.find((p) => p.playerId === playerId);

  const panelProps = {
    games: catalog.map((g) => ({ value: g.id, label: g.title })),
    people: picker.map((p) => ({ id: p.id, name: p.displayName, member: p.userId !== null })),
    lastGroup,
    defaultGameId: catalog.some((g) => g.id === defaultGameId) ? defaultGameId : undefined,
  };

  return (
    <div className={classes.layout}>
      <div>
        <header className={classes.head}>
          <h1 className={classes.title}>Plays</h1>
          <p className={classes.summary}>
            <b>{plural(stats.playsThisYear, 'play')} this year.</b>
            {top && ` ${top.title} leads with ${top.plays}.`}
            {stats.neglected.length > 0 &&
              ` ${plural(stats.neglected.length, 'game')} on the shelf ${stats.neglected.length === 1 ? 'has' : 'have'}n’t been opened in over a year.`}
          </p>
          <LogSheetButton {...panelProps} />
        </header>

        {who.length > 0 && (
          <nav className={classes.people} aria-label="Filter by player">
            <Link href="/plays" className={classes.person} aria-current={!playerId}>
              Everyone
            </Link>
            {who.map((p) => (
              <Link
                key={p.playerId}
                href={href({ player: p.playerId })}
                className={classes.person}
                aria-current={playerId === p.playerId}
              >
                {p.displayName}
              </Link>
            ))}
          </nav>
        )}

        <section className={classes.section} aria-labelledby="recent">
          <h2 id="recent">
            Recent plays
            {active && <span className={classes.note}>with {active.displayName}</span>}
          </h2>
          {shown.length === 0 ? (
            <div className={classes.empty}>
              <p>{playerId ? 'No plays with that person yet.' : 'No plays logged yet.'}</p>
            </div>
          ) : (
            <ul className={classes.list}>
              {shown.map((p) => (
                <li key={p.play.id} className={classes.play} data-play>
                  <span className={classes.date}>
                    {longDate(p.play.playedOn)}
                    <small>{weekday(p.play.playedOn)}</small>
                  </span>
                  <div className={classes.cover}>
                    <CoverTile
                      title={p.title}
                      type={p.type}
                      src={p.coverImage ? coverUrl(p.gameId) : null}
                    />
                  </div>
                  <div className={classes.body}>
                    <h3 className={classes.gameName}>
                      <Link href={`/games/${p.gameId}`}>{p.title}</Link>
                    </h3>
                    <div className={classes.chips}>
                      {p.participants.map((person) => (
                        <span
                          key={person.id}
                          className={classes.pill}
                          data-guest={person.userId === null ? '' : undefined}
                        >
                          {person.displayName}
                        </span>
                      ))}
                    </div>
                    {(p.play.durationMinutes || p.play.notes) && (
                      <div className={classes.meta}>
                        {[
                          p.play.durationMinutes ? `${p.play.durationMinutes} min` : null,
                          p.play.notes,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <form action={deletePlayAction.bind(null, p.play.id)} className={classes.remove}>
                    <ActionIcon
                      type="submit"
                      variant="subtle"
                      color="gray"
                      aria-label="Delete play"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {hasMore && limit === RECENT_PAGE && (
            <Link href={href({ player: playerId, more: '1' })} className={classes.moreLink}>
              Show older plays
            </Link>
          )}
        </section>

        <div className={classes.twoCol}>
          <section className={classes.section} aria-labelledby="most">
            <h2 id="most">Most played</h2>
            {stats.mostPlayed.length === 0 ? (
              <div className={classes.empty}>
                <p>Nothing yet.</p>
              </div>
            ) : (
              <ol className={classes.ranking}>
                {stats.mostPlayed.map((g, i) => (
                  <li key={g.gameId} className={classes.rank} data-most-played>
                    <span className={classes.rankNo}>{i + 1}</span>
                    <CoverTile
                      title={g.title}
                      type={g.type}
                      src={g.hasCover ? coverUrl(g.gameId) : null}
                    />
                    <div>
                      <div className={classes.rankName}>
                        <Link href={`/games/${g.gameId}`}>{g.title}</Link>
                      </div>
                      <div className={classes.bar} aria-hidden>
                        <i style={{ width: `${Math.max(6, (g.plays / topCount) * 100)}%` }} />
                      </div>
                    </div>
                    <span className={classes.rankCount} aria-label={`${plural(g.plays, 'play')}`}>
                      {g.plays}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={classes.section} aria-labelledby="dusty">
            <h2 id="dusty">
              Not played in a year
              <span className={classes.note}>{plural(stats.neglected.length, 'game')}</span>
            </h2>
            {stats.neglected.length === 0 ? (
              <div className={classes.empty}>
                <p>Everything on the shelf has had a turn this year.</p>
              </div>
            ) : (
              <ul className={classes.dusty}>
                {dusty.map((g) => (
                  <li key={g.gameId} className={classes.dustyRow} data-neglected>
                    <CoverTile
                      title={g.title}
                      type={g.type}
                      src={g.hasCover ? coverUrl(g.gameId) : null}
                    />
                    <span className={classes.dustyName}>
                      {g.title}
                      <small>
                        {g.lastPlayed
                          ? `Last played ${longDate(g.lastPlayed)}, ${plural(monthsSince(g.lastPlayed, today), 'month')} ago`
                          : 'Never played'}
                      </small>
                    </span>
                    <Link href={href({ game: g.gameId })} className={classes.pill}>
                      Log a play
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {stats.neglected.length > NEGLECT_PREVIEW && (
              <Link
                href={showAll ? href({}) : href({ all: '1' })}
                className={classes.moreLink}
                aria-expanded={showAll}
              >
                {showAll ? 'Show fewer' : `Show all ${stats.neglected.length}`}
              </Link>
            )}
          </section>
        </div>
      </div>

      <LogAside {...panelProps} />
    </div>
  );
}
