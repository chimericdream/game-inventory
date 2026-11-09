'use client';

import { useState, useTransition } from 'react';
import { Button } from '@mantine/core';

import { GameTile, type TileGame } from '@/components/shelf/GameTile';
import classes from '@/components/shelf/Shelf.module.css';

import { loadMoreGamesAction } from './actions';
import { coverUrl } from './tiles';

interface Props {
  /** The first page, already rendered on the server. */
  children: React.ReactNode;
  /** The filters as a query string, without a page number. */
  query: string;
  total: number;
  shown: number;
  hasMore: boolean;
}

/**
 * The first page arrives server-rendered; "Load more" fetches the next page through a server
 * action (so it passes through the same visibility checks) and appends it to the same shelf.
 * The parent gives this component a `key` built from the filters, so changing a filter starts
 * a fresh shelf instead of appending to the old one.
 */
export function ShelfWithMore({ children, query, total, shown, hasMore }: Props) {
  const [extra, setExtra] = useState<TileGame[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(hasMore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    setError(null);
    startTransition(async () => {
      const result = await loadMoreGamesAction(query, page + 1);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setExtra((prev) => [...prev, ...result.tiles]);
      setPage((p) => p + 1);
      setMore(result.hasMore);
    });
  }

  return (
    <>
      <ul className={classes.shelf}>
        {children}
        {extra.map((game) => (
          <GameTile
            key={game.id}
            game={game}
            href={`/games/${game.id}`}
            coverUrl={coverUrl(game.id)}
          />
        ))}
      </ul>
      <div className={classes.more}>
        <p aria-live="polite">
          Showing {shown + extra.length} of {total}
        </p>
        {more && (
          <Button variant="default" onClick={loadMore} loading={pending}>
            Load more
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </>
  );
}
