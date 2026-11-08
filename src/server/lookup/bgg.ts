import { XMLParser } from 'fast-xml-parser';

const BASE = 'https://boardgamegeek.com/xmlapi2';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export interface BggSearchHit {
  id: number;
  name: string;
  year: number | null;
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
    };
  });
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
  };
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
  const hits = parseSearch(await bggFetch(`/search?type=boardgame&query=${encodeURIComponent(q)}`));
  return hits.slice(0, 10);
}

export async function getBggGame(id: number): Promise<BggGame | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return parseThing(await bggFetch(`/thing?id=${id}&stats=1`));
}
