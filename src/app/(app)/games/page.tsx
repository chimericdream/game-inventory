import { IconX } from '@tabler/icons-react';
import Link from 'next/link';

import { GameTile } from '@/components/shelf/GameTile';
import { TYPE_LABELS } from '@/components/shelf/types';
import { LinkButton } from '@/components/Links';
import { requireContext } from '@/server/auth/current';
import {
  catalogFacets,
  librarySummary,
  listCatalogPage,
  parseCatalogFilters,
  type CatalogFacets,
  type CatalogFilters,
  type LibrarySummary,
} from '@/server/data/catalog';

import { FacetPanel } from './FacetPanel';
import { FilterSheet } from './FilterSheet';
import { catalogHref, filtersToParams } from './hrefs';
import classes from './Library.module.css';
import { SearchBox } from './SearchBox';
import { ShelfWithMore } from './ShelfWithMore';
import { coverUrl, toTile } from './tiles';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "287 games on 9 shelves. 4 are out on loan: 1 overdue, 2 due this week." */
function Summary({ s }: { s: LibrarySummary }) {
  const loanDetail = [
    s.overdue > 0 ? `${s.overdue} overdue` : null,
    s.dueThisWeek > 0 ? `${s.dueThisWeek} due this week` : null,
  ].filter(Boolean);
  return (
    <p className={classes.summary}>
      <b>{plural(s.games, 'game')}</b>
      {s.shelves > 0 && ` on ${plural(s.shelves, 'shelf', 'shelves')}`}.
      {s.onLoan > 0 && (
        <>
          {' '}
          <span className={classes.out}>
            {s.onLoan} {s.onLoan === 1 ? 'is' : 'are'} out on loan
          </span>
          {loanDetail.length > 0 && `: ${loanDetail.join(', ')}`}.
        </>
      )}
    </p>
  );
}

/** One removable chip per active filter, so what narrows the list is always visible. */
function activeFilters(filters: CatalogFilters, facets: CatalogFacets) {
  const current = filtersToParams(filters);
  const chips: { key: string; label: string; href: string }[] = [];
  const add = (key: string, param: string, label: string) =>
    chips.push({ key, label, href: catalogHref(current, { [param]: null }) });
  if (filters.search) add('q', 'q', `“${filters.search}”`);
  if (filters.type) add('type', 'type', TYPE_LABELS[filters.type] ?? filters.type);
  if (filters.players) add('players', 'players', plural(filters.players, 'player'));
  if (filters.maxMinutes) add('time', 'maxMinutes', `Up to ${filters.maxMinutes} min`);
  if (filters.tag) add('tag', 'tag', filters.tag);
  if (filters.locationId) {
    const name = facets.locations.find((l) => l.id === filters.locationId)?.name;
    add('location', 'location', name ?? 'Location');
  }
  if (filters.ownerUserId) {
    const name = facets.owners.find((o) => o.userId === filters.ownerUserId)?.name;
    add('owner', 'owner', name ?? 'Owner');
  }
  if (filters.availability) {
    add('availability', 'availability', filters.availability === 'out' ? 'Out on loan' : 'Here');
  }
  return chips;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ctx } = await requireContext();
  const filters = parseCatalogFilters(await searchParams);
  const [result, facets, summary] = await Promise.all([
    listCatalogPage(ctx, filters),
    catalogFacets(ctx, filters),
    librarySummary(ctx),
  ]);
  const chips = activeFilters(filters, facets);
  const params = filtersToParams(filters);
  const query = new URLSearchParams(params).toString();
  const canEdit = ctx.viewer.role !== 'restricted';
  const panel = <FacetPanel filters={filters} facets={facets} />;

  return (
    <div className={classes.layout}>
      <aside className={classes.sidebar} aria-label="Filters">
        {panel}
      </aside>

      <section className={classes.main}>
        <header className={classes.head}>
          <div>
            <h1 className={classes.title}>Library</h1>
            <Summary s={summary} />
          </div>
          <SearchBox />
        </header>

        <div className={classes.phoneBar}>
          <FilterSheet active={chips.filter((c) => c.key !== 'q').length}>{panel}</FilterSheet>
        </div>

        {summary.games > 0 && (
          <div className={classes.toolbar}>
            <div className={classes.active}>
              <span className={classes.count} data-result-count>
                {plural(result.total, 'game')}
              </span>
              {chips.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  className={classes.activeChip}
                  aria-label={`Remove filter: ${c.label}`}
                >
                  {c.label}
                  <IconX size={14} aria-hidden />
                </Link>
              ))}
              {chips.length > 0 && (
                <Link href="/games" className={classes.clear}>
                  Clear all
                </Link>
              )}
            </div>
            <nav className={classes.sort} aria-label="Sort">
              Sort
              <Link
                href={catalogHref(params, { sort: null })}
                className={classes.sortLink}
                aria-current={filters.sort !== 'newest'}
              >
                Title A–Z
              </Link>
              <Link
                href={catalogHref(params, { sort: 'newest' })}
                className={classes.sortLink}
                aria-current={filters.sort === 'newest'}
              >
                Newest first
              </Link>
            </nav>
          </div>
        )}

        {summary.games === 0 ? (
          <div className={classes.empty}>
            <h2>Your library is empty</h2>
            <p>
              {canEdit
                ? 'Add the first game, or bring in a whole collection from a spreadsheet.'
                : 'Nothing has been added yet.'}
            </p>
            {canEdit && <LinkButton href="/games/new">Add your first game</LinkButton>}
          </div>
        ) : result.rows.length === 0 ? (
          <div className={classes.empty}>
            <h2>No games match</h2>
            <p>Nothing in the library fits all of those filters at once.</p>
            <LinkButton href="/games" variant="default">
              Clear all filters
            </LinkButton>
          </div>
        ) : (
          <ShelfWithMore
            key={query}
            query={query}
            total={result.total}
            shown={result.rows.length}
            hasMore={result.hasMore}
          >
            {result.rows.map((row) => (
              <GameTile
                key={row.id}
                game={toTile(row)}
                href={`/games/${row.id}`}
                coverUrl={coverUrl(row.id)}
              />
            ))}
          </ShelfWithMore>
        )}
      </section>
    </div>
  );
}
