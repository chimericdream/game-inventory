import { XMLParser } from 'fast-xml-parser';

// BGG_BASE_URL exists so end-to-end tests can point at a mock server.
const BASE = process.env.BGG_BASE_URL ?? 'https://boardgamegeek.com/xmlapi2';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export interface BggSearchHit {
  id: number;
  name: string;
  year: number | null;
  isExpansion: boolean;
}

export interface BggRef {
  id: number;
  name: string;
}

export interface BggGame {
  id: number;
  name: string;
  description: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  minAge: number | null;
  /** BGG "weight" 1–5, rounded. */
  complexity: number | null;
  tags: string[];
  /** The first publisher BGG lists (its primary one), or null. */
  publisher: string | null;
  /** Full-size cover on BGG's image host, or null. */
  imageUrl: string | null;
  isExpansion: boolean;
  /** For an expansion: the games it expands, as BGG lists them. */
  baseGames: BggRef[];
}

const toArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const attrNum = (node: { '@_value'?: string } | undefined) => {
  const n = Number(node?.['@_value']);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function decodeEntities(s: string) {
  return s
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'");
}

export function parseSearch(xml: string): BggSearchHit[] {
  const doc = parser.parse(xml);
  return toArray(doc?.items?.item).map((item: any) => {
    const names = toArray(item.name);
    const primary = names.find((n: any) => n['@_type'] === 'primary') ?? names[0];
    return {
      id: Number(item['@_id']),
      name: String(primary?.['@_value'] ?? ''),
      year: attrNum(item.yearpublished),
      isExpansion: item['@_type'] === 'boardgameexpansion',
    };
  });
}

const expansionLinks = (item: any, inbound: boolean): BggRef[] =>
  (toArray(item?.link) as any[])
    .filter((l) => l['@_type'] === 'boardgameexpansion' && (l['@_inbound'] === 'true') === inbound)
    .map((l) => ({ id: Number(l['@_id']), name: String(l['@_value'] ?? '') }))
    .filter((r) => Number.isInteger(r.id) && r.id > 0 && r.name);

/** The expansions BGG lists for a base game, by name. */
export function parseExpansions(xml: string): BggRef[] {
  const item = toArray(parser.parse(xml)?.items?.item)[0];
  return expansionLinks(item, false).toSorted((a, b) => a.name.localeCompare(b.name));
}

export function parseThing(xml: string): BggGame | null {
  const doc = parser.parse(xml);
  const item: any = toArray(doc?.items?.item)[0];
  if (!item) return null;
  const names = toArray(item.name);
  const primary: any = names.find((n: any) => n['@_type'] === 'primary') ?? names[0];
  const weight = Number(item.statistics?.ratings?.averageweight?.['@_value']);
  const links = toArray(item.link) as any[];
  return {
    id: Number(item['@_id']),
    name: String(primary?.['@_value'] ?? ''),
    description: decodeEntities(String(item.description ?? ''))
      .trim()
      .slice(0, 2000),
    minPlayers: attrNum(item.minplayers),
    maxPlayers: attrNum(item.maxplayers),
    playTimeMinutes: attrNum(item.playingtime),
    minAge: attrNum(item.minage),
    complexity:
      Number.isFinite(weight) && weight > 0 ? Math.min(5, Math.max(1, Math.round(weight))) : null,
    tags: links
      .filter((l) => l['@_type'] === 'boardgamecategory')
      .map((l) => String(l['@_value']))
      .slice(0, 6),
    publisher:
      links
        .find((l) => l['@_type'] === 'boardgamepublisher' && String(l['@_value'] ?? '').trim())
        ?.['@_value'].trim()
        .slice(0, 200) ?? null,
    imageUrl: bggImageUrl(item.image) ?? bggImageUrl(item.thumbnail),
    isExpansion: item['@_type'] === 'boardgameexpansion',
    baseGames: expansionLinks(item, true),
  };
}

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Returns the URL only if it is https on BGG's image host (geekdo-images.com); else null. */
export function bggImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value.trim());
    // BGG_IMAGE_ORIGIN exists so end-to-end tests can serve covers from a mock server.
    if (process.env.BGG_IMAGE_ORIGIN && u.origin === process.env.BGG_IMAGE_ORIGIN) return u.href;
    const host = u.hostname.toLowerCase();
    const ok = host === 'geekdo-images.com' || host.endsWith('.geekdo-images.com');
    return u.protocol === 'https:' && !u.username && !u.password && ok ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Downloads one cover from BGG's image host. Refuses other hosts, redirects, non-images and
 * anything over 8 MB, so the lookup cannot be used to fetch arbitrary URLs.
 */
export async function fetchBggImage(value: string): Promise<File> {
  const url = bggImageUrl(value);
  if (!url) throw new Error('Not a BoardGameGeek image URL.');
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BoardGameGeek image returned ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!IMAGE_TYPES.includes(type))
    throw new Error('BoardGameGeek image is not a JPEG, PNG or WebP.');
  if (Number(res.headers.get('content-length') ?? 0) > IMAGE_MAX_BYTES)
    throw new Error('BoardGameGeek image is too large.');
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw new Error('BoardGameGeek image is too large.');
  return new File([bytes], 'cover', { type });
}

async function bggFetch(path: string): Promise<string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new Error('BoardGameGeek lookup is not configured (set BGG_API_TOKEN).');
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/xml' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 202)
    throw new Error('BoardGameGeek is preparing the data; try again shortly.');
  if (!res.ok) throw new Error(`BoardGameGeek returned ${res.status}`);
  return res.text();
}

export async function searchBgg(query: string): Promise<BggSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const hits = parseSearch(
    await bggFetch(`/search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`),
  );
  return hits.slice(0, 10);
}

export async function getBggGame(id: number): Promise<BggGame | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return parseThing(await bggFetch(`/thing?id=${id}&stats=1`));
}

export async function getBggExpansions(id: number): Promise<BggRef[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  return parseExpansions(await bggFetch(`/thing?id=${id}`));
}
