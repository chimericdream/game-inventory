// Mock of the BoardGameGeek XML API and the UPCitemdb trial API, for end-to-end tests.
// The app's server makes these calls, so browser-level interception cannot cover them.
// Run with: node e2e/mocks/external-server.ts   (Node strips the types)
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const TOKEN = process.env.BGG_API_TOKEN ?? 'test-token';

interface Logged {
  service: 'bgg' | 'upc';
  path: string;
  query: Record<string, string>;
  authorization: string | null;
  at: number;
}
const log: Logged[] = [];

const BGG_GAMES = [
  {
    id: 13,
    name: 'Catan',
    year: 1995,
    minPlayers: 3,
    maxPlayers: 4,
    playingTime: 120,
    minAge: 10,
    weight: 2.32,
    description: 'Trade, build &amp; settle.&#10;&#10;Collect resources.',
    categories: ['Negotiation', 'Economic'],
  },
  {
    id: 30549,
    name: 'Pandemic',
    year: 2008,
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 45,
    minAge: 8,
    weight: 2.4,
    description: 'Cooperate to cure four diseases.',
    categories: ['Medical'],
  },
  {
    id: 266192,
    name: 'Wingspan',
    year: 2019,
    minPlayers: 1,
    maxPlayers: 5,
    playingTime: 70,
    minAge: 10,
    weight: 2.44,
    description: 'Attract birds to your wildlife preserve.',
    categories: ['Animals', 'Card Game', 'Educational', 'Economic', 'Nature', 'Dice'],
  },
];

const xml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>\n${body}`;

function searchXml(items: { id: number; name: string; year: number | null }[]) {
  const rows = items
    .map(
      (g) =>
        `<item type="boardgame" id="${g.id}"><name type="primary" value="${g.name}"/>${
          g.year ? `<yearpublished value="${g.year}"/>` : ''
        }</item>`,
    )
    .join('');
  return xml(
    `<items total="${items.length}" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">${rows}</items>`,
  );
}

function thingXml(g: (typeof BGG_GAMES)[number]) {
  const links = g.categories
    .map((c, i) => `<link type="boardgamecategory" id="${1000 + i}" value="${c}"/>`)
    .join('');
  return xml(
    `<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"><item type="boardgame" id="${g.id}">` +
      `<name type="primary" sortindex="1" value="${g.name}"/>` +
      `<description>${g.description}</description>` +
      `<yearpublished value="${g.year}"/>` +
      `<minplayers value="${g.minPlayers}"/><maxplayers value="${g.maxPlayers}"/>` +
      `<playingtime value="${g.playingTime}"/><minage value="${g.minAge}"/>` +
      links +
      `<statistics page="1"><ratings><averageweight value="${g.weight}"/></ratings></statistics>` +
      `</item></items>`,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const query = Object.fromEntries(url.searchParams);
  const send = (status: number, body: string, type = 'application/xml') => {
    res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
    res.end(body);
  };

  // --- control endpoints (tests only) ---
  if (url.pathname === '/__health') return send(200, 'ok', 'text/plain');
  if (url.pathname === '/__requests') {
    const service = url.searchParams.get('service');
    const rows = service ? log.filter((l) => l.service === service) : log;
    return send(200, JSON.stringify(rows), 'application/json');
  }
  if (url.pathname === '/__reset') {
    log.length = 0;
    return send(200, 'reset', 'text/plain');
  }

  // --- BoardGameGeek ---
  if (url.pathname.startsWith('/bgg/')) {
    log.push({
      service: 'bgg',
      path: url.pathname,
      query,
      authorization: req.headers.authorization ?? null,
      at: Date.now(),
    });
    if (req.headers.authorization !== `Bearer ${TOKEN}`)
      return send(401, 'Unauthorized', 'text/plain');

    if (url.pathname === '/bgg/search') {
      const q = (query.query ?? '').toLowerCase();
      if (q.includes('__202')) return send(202, xml('<message>Queued</message>'));
      if (q.includes('__500')) return send(500, 'boom', 'text/plain');
      if (q.includes('__slow')) {
        await sleep(15_000);
        return send(200, searchXml([]));
      }
      if (q.includes('__garbage')) return send(200, '<<<not xml', 'application/xml');
      if (q.includes('__empty')) return send(200, searchXml([]));
      if (q.includes('__many')) {
        return send(
          200,
          searchXml(
            Array.from({ length: 25 }, (_, i) => ({
              id: 9000 + i,
              name: `Many ${i + 1}`,
              year: 2000 + i,
            })),
          ),
        );
      }
      const hits = BGG_GAMES.filter(
        (g) => g.name.toLowerCase().includes(q) || q.includes(g.name.toLowerCase()),
      );
      return send(200, searchXml(hits));
    }
    if (url.pathname === '/bgg/thing') {
      const game = BGG_GAMES.find((g) => String(g.id) === query.id);
      if (!game) return send(200, xml('<items termsofuse=""></items>'));
      return send(200, thingXml(game));
    }
    return send(404, 'Not found', 'text/plain');
  }

  // --- UPCitemdb ---
  if (url.pathname === '/upc/lookup') {
    log.push({ service: 'upc', path: url.pathname, query, authorization: null, at: Date.now() });
    const code = query.upc ?? '';
    if (code === '012345678905') {
      return send(
        200,
        JSON.stringify({ code: 'OK', items: [{ title: 'Catan Board Game' }] }),
        'application/json',
      );
    }
    if (code === '429429429429')
      return send(429, JSON.stringify({ code: 'EXCEED_LIMIT' }), 'application/json');
    if (code === '500500500500') return send(500, 'boom', 'text/plain');
    if (code === '777777777777') return send(200, '{not json', 'application/json');
    return send(200, JSON.stringify({ code: 'OK', items: [] }), 'application/json');
  }

  send(404, 'Not found', 'text/plain');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`external API mock listening on ${PORT}`);
});
