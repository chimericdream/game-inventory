import Link from 'next/link';

import { TYPE_LABELS } from '@/components/shelf/types';
import type { CatalogFacets, CatalogFilters } from '@/server/data/catalog';

import classes from './Facets.module.css';
import { catalogHref, filtersToParams } from './hrefs';

const PLAYER_CHOICES = [1, 2, 3, 4, 5, 6];
const TIME_CHOICES = [15, 30, 60, 90];

interface Props {
  filters: CatalogFilters;
  facets: CatalogFacets;
}

/** Locations in tree order, each with its depth, so nested shelves read as a path. */
function orderedLocations(locations: CatalogFacets['locations']) {
  const byParent = new Map<string | null, CatalogFacets['locations']>();
  for (const l of locations) {
    const list = byParent.get(l.parentId) ?? [];
    list.push(l);
    byParent.set(l.parentId, list);
  }
  const out: (CatalogFacets['locations'][number] & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const l of byParent.get(parent) ?? []) {
      out.push({ ...l, depth });
      walk(l.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Every filter as a plain link, so the whole panel is server-rendered and the URL is the only
 * state. Choosing the active value again clears it. Counts come from the data layer and already
 * exclude anything this viewer may not see.
 */
export function FacetPanel({ filters, facets }: Props) {
  const current = filtersToParams(filters);
  const toggle = (key: string, value: string, active: boolean) =>
    catalogHref(current, { [key]: active ? null : value });
  const locations = orderedLocations(facets.locations).filter(
    (l) => l.count > 0 || l.id === filters.locationId,
  );

  return (
    <div className={classes.panel}>
      {facets.availability && (
        <section className={classes.group} aria-labelledby="facet-availability">
          <h3 id="facet-availability">Availability</h3>
          <div className={classes.segments}>
            <Link
              href={catalogHref(current, { availability: null })}
              className={classes.segment}
              aria-current={!filters.availability}
            >
              All
            </Link>
            <Link
              href={catalogHref(current, { availability: 'here' })}
              className={classes.segment}
              aria-current={filters.availability === 'here'}
            >
              Here
            </Link>
            <Link
              href={catalogHref(current, { availability: 'out' })}
              className={classes.segment}
              aria-current={filters.availability === 'out'}
            >
              Out{facets.availability.out > 0 && <b>{facets.availability.out}</b>}
            </Link>
          </div>
        </section>
      )}

      <section className={classes.group} aria-labelledby="facet-type">
        <h3 id="facet-type">Type</h3>
        <ul className={classes.list}>
          <li>
            <Link
              href={catalogHref(current, { type: null })}
              className={classes.row}
              aria-current={!filters.type}
            >
              Everything
            </Link>
          </li>
          {facets.types.map((t) => (
            <li key={t.value}>
              <Link
                href={toggle('type', t.value, filters.type === t.value)}
                className={classes.row}
                aria-current={filters.type === t.value}
              >
                {TYPE_LABELS[t.value]}
                <span>{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={classes.group} aria-labelledby="facet-players">
        <h3 id="facet-players">Players tonight</h3>
        <div className={classes.chips}>
          {PLAYER_CHOICES.map((n) => (
            <Link
              key={n}
              href={toggle('players', String(n), filters.players === n)}
              className={classes.chip}
              aria-current={filters.players === n}
              aria-label={`${n === 6 ? '6 or more' : n} ${n === 1 ? 'player' : 'players'}`}
            >
              {n === 6 ? '6+' : n}
            </Link>
          ))}
        </div>
      </section>

      <section className={classes.group} aria-labelledby="facet-time">
        <h3 id="facet-time">Time we have</h3>
        <div className={classes.chips}>
          {TIME_CHOICES.map((m) => (
            <Link
              key={m}
              href={toggle('maxMinutes', String(m), filters.maxMinutes === m)}
              className={classes.chip}
              aria-current={filters.maxMinutes === m}
              aria-label={`Up to ${m} minutes`}
            >
              {m} min
            </Link>
          ))}
        </div>
      </section>

      {locations.length > 0 && (
        <section className={classes.group} aria-labelledby="facet-where">
          <h3 id="facet-where">Where is it</h3>
          <ul className={classes.list}>
            {locations.map((l) => (
              <li key={l.id}>
                <Link
                  href={toggle('location', l.id, filters.locationId === l.id)}
                  className={`${classes.row} ${l.depth > 0 ? classes.nested : ''}`}
                  style={l.depth > 1 ? { paddingLeft: 28 + (l.depth - 1) * 14 } : undefined}
                  aria-current={filters.locationId === l.id}
                >
                  {l.name}
                  <span>{l.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {facets.owners.length > 0 && (
        <section className={classes.group} aria-labelledby="facet-whose">
          <h3 id="facet-whose">Whose</h3>
          <div className={classes.chips}>
            {facets.owners.map((o) => (
              <Link
                key={o.userId}
                href={toggle('owner', o.userId, filters.ownerUserId === o.userId)}
                className={classes.chip}
                aria-current={filters.ownerUserId === o.userId}
              >
                {o.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {facets.tags.length > 0 && (
        <section className={classes.group} aria-labelledby="facet-tags">
          <h3 id="facet-tags">Tags</h3>
          <div className={classes.chips}>
            {facets.tags.map((t) => {
              const active = filters.tag?.toLowerCase() === t.name.toLowerCase();
              return (
                <Link
                  key={t.name}
                  href={toggle('tag', t.name, active)}
                  className={classes.chip}
                  aria-current={active}
                >
                  {t.name}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
