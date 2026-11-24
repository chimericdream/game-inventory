import { randomUUID } from 'node:crypto';

import { getApiContext } from '@/server/auth/current';
import { addCopyFile, cleanFileName, prepareCopyFileUpload } from '@/server/data/copy-files';
import {
  attachableType,
  maxFileBytes,
  removeStored,
  saveAttachment,
  UploadError,
} from '@/server/storage';

export const dynamic = 'force-dynamic';

const text = (message: string, status: number) => new Response(message, { status });

/**
 * Attaches a file to a print-and-play copy. The body is the raw file (not a form), streamed to
 * disk, because server actions cap request size and `formData()` would hold the whole file in
 * memory. The name comes in `?name=`. Requiring `application/octet-stream` also means a page on
 * another site cannot trigger an upload with a plain form post.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return text('Unauthorized', 401);
  if (ctx.viewer.role === 'restricted') return text('Not allowed', 403);
  if (req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/octet-stream') {
    return text('Send the file as application/octet-stream.', 415);
  }
  const name = cleanFileName(new URL(req.url).searchParams.get('name') ?? '');
  const type = attachableType(name);
  if (!type) return text('Attach a PDF, ZIP, PNG or JPEG file.', 415);

  const { id } = await params;
  const target = await prepareCopyFileUpload(ctx, id);
  if (!target) return text('Only a print & play copy can have files.', 404);

  const max = maxFileBytes();
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    return text(`Files must be ${Math.round(max / 1024 / 1024)} MB or smaller.`, 413);
  }
  if (!req.body) return text('That file is empty.', 400);

  const fileId = randomUUID();
  let saved: { rel: string; size: number };
  try {
    saved = await saveAttachment(ctx.householdId, fileId, type.ext, req.body, max);
  } catch (e) {
    if (e instanceof UploadError) return text(e.message, e.status);
    console.error('File upload failed', e);
    return text('Could not save the file.', 500);
  }
  try {
    await addCopyFile(ctx, id, {
      id: fileId,
      name,
      mime: type.mime,
      sizeBytes: saved.size,
      storagePath: saved.rel,
    });
  } catch (e) {
    await removeStored(saved.rel);
    console.error('File upload failed', e);
    return text('Could not save the file.', 500);
  }
  return Response.json({ id: fileId }, { status: 201 });
}
