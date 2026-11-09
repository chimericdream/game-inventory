import { Button } from '@mantine/core';
import { IconDice5, IconPencil, IconStar, IconStarFilled } from '@tabler/icons-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LinkButton } from '@/components/Links';
import { CoverTile } from '@/components/shelf/CoverTile';
import { TYPE_LABELS } from '@/components/shelf/types';
import { longDate } from '@/lib/dates';
import { requireContext } from '@/server/auth/current';
import { lastEdit } from '@/server/data/audit';
import { getGameDetail } from '@/server/data/games';
import { listLocationOptions, listMembers } from '@/server/data/lookups';
import { playerStats, playsForGame } from '@/server/data/plays';
import { ratingSummary } from '@/server/data/ratings';

import { deleteGameAction, rateGameAction } from '../actions';
import { coverUrl } from '../tiles';
import { CopiesPanel } from './CopiesPanel';
import classes from './Detail.module.css';

export const dynamic = 'force-dynamic';

const COMPLEXITY = ['Very light', 'Light', 'Medium', 'Heavy', 'Very heavy'];

const weekday = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

interface Fact {
  value: string;
  unit?: string;
  label: string;
  meter?: number;
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireContext();
  const detail = await getGameDetail(ctx, id);
  if (!detail) notFound();
  const { game, board, rpg, puzzle } = detail;
  const member = ctx.viewer.role !== 'restricted';

  const [members, locations, plays, whoPlays, rating, edited] = await Promise.all([
    listMembers(ctx),
    listLocationOptions(ctx),
    member ? playsForGame(ctx, id) : Promise.resolve([]),
    member ? playerStats(ctx, { gameId: id }) : Promise.resolve([]),
    member ? ratingSummary(ctx, id) : Promise.resolve(null),
    member ? lastEdit(ctx, 'game', id) : Promise.resolve(null),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  const facts: Fact[] = [];
  const players =
    board?.minPlayers && board?.maxPlayers && board.minPlayers !== board.maxPlayers
      ? `${board.minPlayers}–${board.maxPlayers}`
      : String(board?.minPlayers ?? board?.maxPlayers ?? '');
  if (players) facts.push({ value: players, label: 'players' });
  if (board?.playTimeMinutes)
    facts.push({ value: String(board.playTimeMinutes), unit: 'min', label: 'play time' });
  if (board?.complexity) {
    facts.push({
      value: String(board.complexity),
      unit: '/ 5',
      label: `complexity, ${COMPLEXITY[board.complexity - 1]?.toLowerCase()}`,
      meter: board.complexity,
    });
  }
  if (board?.minAge) facts.push({ value: `${board.minAge}+`, label: 'minimum age' });
  if (puzzle?.pieceCount) {
    facts.push({ value: puzzle.pieceCount.toLocaleString('en-US'), label: 'pieces' });
  }
  if (rpg?.system) facts.push({ value: rpg.system, label: 'system' });
  if (rpg?.bookKind) facts.push({ value: rpg.bookKind, label: 'kind of book' });

  const copyCount = detail.copies.length;
  const subtitle = [
    TYPE_LABELS[game.type],
    `${copyCount} ${copyCount === 1 ? 'copy' : 'copies'}`,
    member && plays.length > 0
      ? `played ${plays.length} ${plays.length === 1 ? 'time' : 'times'}`
      : null,
  ].filter(Boolean);

  return (
    <>
      <nav className={classes.crumbs} aria-label="Breadcrumb">
        <Link href="/games">Library</Link>
        <span aria-hidden>›</span>
        <span>{TYPE_LABELS[game.type]}</span>
      </nav>

      <div className={classes.layout}>
        <aside className={classes.side}>
          <div className={classes.stand}>
            <CoverTile
              title={game.title}
              type={game.type}
              src={game.coverImage ? coverUrl(game.id) : null}
            />
          </div>

          {rating && (
            <section className={classes.card} aria-labelledby="your-rating">
              <h2 id="your-rating">Your rating</h2>
              <form action={rateGameAction.bind(null, id)} className={classes.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="submit"
                    name="score"
                    value={n}
                    className={classes.star}
                    aria-label={`${n} out of 5`}
                    aria-pressed={rating.mine === n}
                  >
                    {rating.mine !== null && n <= rating.mine ? (
                      <IconStarFilled size={26} aria-hidden />
                    ) : (
                      <IconStar size={26} aria-hidden />
                    )}
                  </button>
                ))}
              </form>
              <p className={classes.hint}>
                {rating.count > 0
                  ? `Family average ${rating.average} from ${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}`
                  : 'Nobody has rated this yet'}
              </p>
            </section>
          )}
        </aside>

        <div className={classes.main}>
          <header>
            <h1 className={classes.title}>{game.title}</h1>
            <p className={classes.subtitle}>{subtitle.join(' · ')}</p>
            {member && (
              <div className={classes.actions}>
                <LinkButton
                  href={`/plays?game=${id}`}
                  leftSection={<IconDice5 size={16} aria-hidden />}
                >
                  Log a play
                </LinkButton>
                <LinkButton
                  href={`/games/${id}/edit`}
                  variant="default"
                  leftSection={<IconPencil size={16} aria-hidden />}
                >
                  Edit
                </LinkButton>
              </div>
            )}
          </header>

          {facts.length > 0 && (
            <dl className={classes.facts}>
              {facts.map((f) => (
                <div key={f.label} className={classes.fact}>
                  <dt className={classes.factLabel}>{f.label}</dt>
                  <dd className={classes.factValue}>
                    {f.value}
                    {f.unit && <small>{f.unit}</small>}
                    {f.meter && (
                      <span className={classes.meter} aria-hidden>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <i key={n} data-on={f.meter && n <= f.meter ? true : undefined} />
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {game.description && <p className={classes.text}>{game.description}</p>}

          {detail.tags.length > 0 && (
            <ul className={classes.tags} aria-label="Tags">
              {detail.tags.map((t) => (
                <li key={t} className={classes.tag}>
                  {t}
                </li>
              ))}
            </ul>
          )}

          {member && game.notes && (
            <figure className={classes.notes} style={{ margin: 0 }}>
              <figcaption>Notes</figcaption>
              <blockquote>{game.notes}</blockquote>
            </figure>
          )}

          <section className={classes.section} aria-labelledby="copies">
            <h2 id="copies">Copies</h2>
            <CopiesPanel
              gameId={id}
              canEdit={member}
              members={members.map((m) => ({ value: m.id, label: m.name }))}
              locations={locations}
              copies={detail.copies.map((c) => ({
                id: c.id,
                format: c.format,
                platform: c.platform,
                condition: c.condition,
                conditionNotes: c.conditionNotes,
                ownerName: c.ownerUserId ? (memberName.get(c.ownerUserId) ?? null) : null,
                locationName: c.locationName,
                priceCents: c.priceCents,
                acquiredOn: c.acquiredOn,
                loan: c.loan,
              }))}
            />
          </section>

          {member && (
            <section className={classes.section} aria-labelledby="plays">
              <h2 id="plays">
                Recent plays
                {plays.length > 0 && (
                  <span className={classes.sectionNote}>{plays.length} in all</span>
                )}
              </h2>
              {plays.length === 0 ? (
                <p className={classes.hint}>Nobody has logged a play of this game yet.</p>
              ) : (
                <ul className={classes.plays}>
                  {plays.slice(0, 5).map((p) => (
                    <li key={p.id} className={classes.play}>
                      <span className={classes.playDate}>
                        {longDate(p.playedOn)}
                        <small>{weekday(p.playedOn)}</small>
                      </span>
                      <span className={classes.who}>
                        {p.participants.length === 0 && (
                          <span className={classes.hint}>No players recorded</span>
                        )}
                        {p.participants.map((person) => (
                          <span key={person.id} className={classes.person}>
                            {person.displayName}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {whoPlays.length > 0 && (
                <p className={classes.hint}>
                  Who plays this: {whoPlays.map((p) => `${p.displayName} ${p.plays}`).join(' · ')}
                </p>
              )}
            </section>
          )}

          {member && (
            <footer className={classes.footer}>
              <span>
                {edited
                  ? `Last ${edited.action === 'create' ? 'added' : 'edited'} by ${edited.actorName ?? 'someone who has since left'} on ${longDate(edited.at.toISOString().slice(0, 10))}`
                  : ''}
              </span>
              <form action={deleteGameAction.bind(null, id)}>
                <Button type="submit" color="red" variant="subtle">
                  Delete game
                </Button>
              </form>
            </footer>
          )}
        </div>
      </div>
    </>
  );
}
