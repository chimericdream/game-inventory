import { getApiContext } from '@/server/auth/current';
import { getBggGame, searchBgg } from '@/server/lookup/bgg';

export const dynamic = 'force-dynamic';

/** GET ?q=term -> search hits; GET ?id=13 -> one game's details. Signed-in, non-restricted only. */
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.viewer.role === 'restricted')
    return Response.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  try {
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
