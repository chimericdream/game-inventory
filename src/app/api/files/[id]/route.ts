import { getApiContext } from '@/server/auth/current';
import { getCopyFileForDownload } from '@/server/data/copy-files';
import { storedSize, streamStored } from '@/server/storage';

export const dynamic = 'force-dynamic';

/** `bytes=a-b`, `bytes=a-` or `bytes=-n` as an inclusive range, or null if it cannot be satisfied. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

/** `inline` or `attachment` with a name that survives non-ASCII characters. */
function disposition(kind: 'inline' | 'attachment', name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  // encodeURIComponent leaves ' ( ) * alone, but RFC 8187 does not allow them in filename*.
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Serves an attached file to a signed-in household member. Goes through the data layer, so a kid
 * profile gets a 404 for a game hidden from it, and there is no guest equivalent of this route.
 * PDFs open in the browser; ranges are supported so phone viewers can jump to a page.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const file = await getCopyFileForDownload(ctx, id);
  if (!file) return new Response('Not found', { status: 404 });
  const size = await storedSize(file.storagePath);
  if (size === null) return new Response('Not found', { status: 404 });

  const forceDownload = new URL(req.url).searchParams.has('download');
  const inline = !forceDownload && file.mime !== 'application/zip';
  const headers: Record<string, string> = {
    'Content-Type': file.mime,
    'Content-Disposition': disposition(inline ? 'inline' : 'attachment', file.name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  const header = req.headers.get('range');
  if (header) {
    const range = parseRange(header, size);
    if (!range) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    return new Response(streamStored(file.storagePath, range), {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }
  return new Response(streamStored(file.storagePath), {
    headers: { ...headers, 'Content-Length': String(size) },
  });
}
