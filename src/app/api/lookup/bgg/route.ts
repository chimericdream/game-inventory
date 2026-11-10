import { getApiContext } from '@/server/auth/current';
import { libraryBggKeys } from '@/server/data/games';
import { getBggExpansions, getBggGame, searchBgg } from '@/server/lookup/bgg';

export const dynamic = 'force-dynamic';

/** GET ?q=term -> search hits; GET ?id=13 -> one game's details; GET ?expansionsOf=13 -> its expansions. Signed-in, non-restricted only. */
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.viewer.role === 'restricted')
    return Response.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  try {
    const expansionsOf = url.searchParams.get('expansionsOf');
    if (expansionsOf) {
      const [list, owned] = await Promise.all([
        getBggExpansions(Number(expansionsOf)),
        libraryBggKeys(ctx),
      ]);
      return Response.json({
        expansions: list.map((e) => ({
          ...e,
          owned: owned.ids.has(e.id) || owned.titles.has(e.name.trim().toLowerCase()),
        })),
      });
    }
    const id = url.searchParams.get('id');
    if (id) return Response.json({ game: await getBggGame(Number(id)) });
    return Response.json({ hits: await searchBgg(url.searchParams.get('q') ?? '') });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 502 },
    );
  }
}
