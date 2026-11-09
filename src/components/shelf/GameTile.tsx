import Link from 'next/link';

import { shortDate } from '@/lib/dates';

import { CoverTile } from './CoverTile';
import classes from './Shelf.module.css';
import { TYPE_LABELS } from './types';

/** What a tile needs to draw one game. Deliberately small: nothing private rides along. */
export interface TileGame {
  id: string;
  title: string;
  type: string;
  hasCover: boolean;
  platforms: string[];
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  /** Present only for household members; restricted profiles and guests never get it. */
  loan: { borrower: string; dueOn: string | null; daysOut: number } | null;
  /** Restricted profiles only learn that the game is out, nothing about who has it. */
  out?: boolean;
}

interface Props {
  game: TileGame;
  /** Detail page address. */
  href: string;
  /** Cover address, or null to force the stand-in. */
  coverUrl: string | null;
}

const players = (min: number | null, max: number | null) => {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max}p`;
  return `${min ?? max}p`;
};

function loanLine(loan: NonNullable<TileGame['loan']>) {
  if (loan.dueOn) return `Due ${shortDate(loan.dueOn)}`;
  if (loan.daysOut === 0) return 'Out today';
  return `Out ${loan.daysOut} day${loan.daysOut === 1 ? '' : 's'}`;
}

export function GameTile({ game, href, coverUrl }: Props) {
  const meta = [
    game.platforms.join(' / ') || null,
    players(game.minPlayers, game.maxPlayers),
    game.playTimeMinutes ? `${game.playTimeMinutes} min` : null,
  ].filter(Boolean);
  return (
    <li>
      <Link href={href} className={classes.tile} data-game-card>
        <div className={classes.stand}>
          <CoverTile title={game.title} type={game.type} src={game.hasCover ? coverUrl : null}>
            {game.loan && (
              <span className={classes.loan}>
                Out with {game.loan.borrower}
                <small>{loanLine(game.loan)}</small>
              </span>
            )}
            {!game.loan && game.out && <span className={classes.loan}>Out</span>}
          </CoverTile>
        </div>
        <span className={classes.meta}>
          <span className={classes.title}>{game.title}</span>
          <span className={classes.sub}>
            {meta.length > 0 ? meta.join(' · ') : (TYPE_LABELS[game.type] ?? TYPE_LABELS.other)}
          </span>
        </span>
      </Link>
    </li>
  );
}
