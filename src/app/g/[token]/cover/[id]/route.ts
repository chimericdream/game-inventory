import { guestCoverPath, resolveShareLink } from '@/server/data/guest';
import { getDb } from '@/server/db/client';
import { readStored } from '@/server/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const db = getDb();
  const link = await resolveShareLink(db, token);
  if (!link) return new Response('Not found', { status: 404 });
  const path = await guestCoverPath(db, link, id);
  const file = path ? await readStored(path) : null;
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mime,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
