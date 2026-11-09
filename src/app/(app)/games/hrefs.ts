import type { CatalogFilters } from '@/server/data/catalog';

export type ParamRecord = Record<string, string>;

/** The URL parameters that describe a set of filters, leaving out anything at its default. */
export function filtersToParams(f: CatalogFilters): ParamRecord {
  const out: ParamRecord = {};
  if (f.search) out.q = f.search;
  if (f.type) out.type = f.type;
  if (f.players) out.players = String(f.players);
  if (f.maxMinutes) out.maxMinutes = String(f.maxMinutes);
  if (f.tag) out.tag = f.tag;
  if (f.locationId) out.location = f.locationId;
  if (f.ownerUserId) out.owner = f.ownerUserId;
  if (f.availability) out.availability = f.availability;
  if (f.sort && f.sort !== 'title') out.sort = f.sort;
  return out;
}

/** A link to the library with one or more parameters changed (`null` removes one). */
export function catalogHref(
  current: ParamRecord,
  patch: Record<string, string | null | undefined>,
): string {
  const next: ParamRecord = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') delete next[key];
    else next[key] = value;
  }
  const qs = new URLSearchParams(next).toString();
  return qs ? `/games?${qs}` : '/games';
}
