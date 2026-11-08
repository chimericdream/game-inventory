import { getApiContext } from '@/server/auth/current';
import { lookupUpc } from '@/server/lookup/upc';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.viewer.role === 'restricted')
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const title = await lookupUpc(new URL(req.url).searchParams.get('code') ?? '');
    return Response.json({ title });
  } catch {
    return Response.json({ title: null });
  }
}
