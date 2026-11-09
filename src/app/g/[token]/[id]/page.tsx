import { notFound } from 'next/navigation';
import Link from 'next/link';

import { CoverTile } from '@/components/shelf/CoverTile';
import { TYPE_LABELS } from '@/components/shelf/types';
import { guestGame, resolveShareLink } from '@/server/data/guest';
import { getDb } from '@/server/db/client';

import classes from '../Guest.module.css';

export const dynamic = 'force-dynamic';

export const metadata = { robots: { index: false, follow: false } };

export default async function GuestGamePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const db = getDb();
  const link = await resolveShareLink(db, token);
  if (!link) notFound();
  const game = await guestGame(db, link, id);
  if (!game) notFound();

  const board = game.board;
  const players =
    board?.minPlayers && board?.maxPlayers && board.minPlayers !== board.maxPlayers
      ? `${board.minPlayers}–${board.maxPlayers} players`
      : board?.minPlayers || board?.maxPlayers
        ? `${board.minPlayers ?? board.maxPlayers} ${(board.minPlayers ?? board.maxPlayers) === 1 ? 'player' : 'players'}`
        : null;
  const facts = [
    players,
    board?.playTimeMinutes ? `${board.playTimeMinutes} min` : null,
    board?.complexity ? `Complexity ${board.complexity} of 5` : null,
    board?.minAge ? `Ages ${board.minAge}+` : null,
  ].filter(Boolean);

  return (
    <div className={classes.page}>
      <Link href={`/g/${token}`} className={classes.back}>
        ← All games
      </Link>
      <div className={classes.detail}>
        <div className={classes.stand}>
          <CoverTile
            title={game.title}
            type={game.type}
            src={game.coverImage ? `/g/${token}/cover/${game.id}` : null}
          />
        </div>
        <div>
          <h1 className={classes.title}>{game.title}</h1>
          <p className={classes.lead}>
            {[TYPE_LABELS[game.type], ...game.platforms].filter(Boolean).join(' · ')}
          </p>
          {facts.length > 0 && (
            <ul className={classes.facts}>
              {facts.map((f) => (
                <li key={f} className={classes.fact}>
                  {f}
                </li>
              ))}
            </ul>
          )}
          {game.description && <p className={classes.text}>{game.description}</p>}
          {game.tags.length > 0 && (
            <ul className={classes.tags} aria-label="Tags">
              {game.tags.map((t) => (
                <li key={t} className={classes.tag}>
                  {t}
                </li>
              ))}
            </ul>
          )}
          {game.notes && <p className={classes.note}>{game.notes}</p>}
          {game.locations.length > 0 && (
            <p className={classes.kept}>Kept in: {game.locations.join(', ')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
