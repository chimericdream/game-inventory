'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Alert, Button, FileButton, Group, Text } from '@mantine/core';
import {
  IconDownload,
  IconFile,
  IconFileTypePdf,
  IconFileZip,
  IconPhoto,
  IconUpload,
  IconTrash,
} from '@tabler/icons-react';

import { ConfirmDelete } from '@/components/ConfirmDelete';
import { formatBytes } from '@/lib/bytes';

import { deleteCopyFileAction } from '../actions';
import classes from './CopyFiles.module.css';

export interface CopyFileItem {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

const MB = 1024 * 1024;

function FileIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') return <IconFileTypePdf size={20} aria-hidden />;
  if (mime === 'application/zip') return <IconFileZip size={20} aria-hidden />;
  if (mime.startsWith('image/')) return <IconPhoto size={20} aria-hidden />;
  return <IconFile size={20} aria-hidden />;
}

interface Props {
  gameId: string;
  copyId: string;
  files: CopyFileItem[];
  /** The viewer may add files (a member, on a print & play copy). */
  canUpload: boolean;
  /** The viewer may delete files. */
  canEdit: boolean;
  /** Largest file the server accepts, so a too-big file is turned down before it is sent. */
  maxFileMb: number;
}

/** The files attached to one copy, such as the PDFs of a print-and-play game, inside its card. */
export function CopyFiles({ gameId, copyId, files, canUpload, canEdit, maxFileMb }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (files.length === 0 && !canUpload) return null;

  async function upload(picked: File[]) {
    setError(null);
    try {
      for (const [i, file] of picked.entries()) {
        if (file.size > maxFileMb * MB) {
          setError(`${file.name} is over the ${maxFileMb} MB limit.`);
          break;
        }
        setBusy(picked.length > 1 ? `${file.name} (${i + 1} of ${picked.length})` : file.name);
        const res = await fetch(
          `/api/copies/${copyId}/files?name=${encodeURIComponent(file.name)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file,
          },
        );
        if (!res.ok) {
          setError(`${file.name}: ${(await res.text()) || 'Could not upload it.'}`);
          break;
        }
      }
    } catch {
      setError('The upload was interrupted. Try again.');
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <section className={classes.section} aria-label="Files">
      <h4 className={classes.heading}>Files</h4>
      {files.length > 0 ? (
        <ul className={classes.list}>
          {files.map((f) => (
            <li key={f.id} className={classes.item} data-copy-file>
              <span className={classes.icon}>
                <FileIcon mime={f.mime} />
              </span>
              <span className={classes.body}>
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={classes.name}
                >
                  {f.name}
                </a>
                <span className={classes.meta}>{formatBytes(f.sizeBytes)}</span>
              </span>
              <Group gap={2} wrap="nowrap">
                <ActionIcon
                  component="a"
                  href={`/api/files/${f.id}?download`}
                  variant="subtle"
                  color="gray"
                  aria-label={`Download ${f.name}`}
                >
                  <IconDownload size={16} />
                </ActionIcon>
                {canEdit && (
                  <ConfirmDelete
                    title={`Delete ${f.name}?`}
                    triggerLabel={`Delete ${f.name}`}
                    triggerIcon={<IconTrash size={16} />}
                    action={deleteCopyFileAction.bind(null, gameId, f.id)}
                  >
                    <Text size="sm">
                      It moves to the trash. You can restore it from Settings → Trash.
                    </Text>
                  </ConfirmDelete>
                )}
              </Group>
            </li>
          ))}
        </ul>
      ) : (
        <p className={classes.meta}>No files yet. Add the PDFs you print from.</p>
      )}
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {canUpload && (
        <Group gap="sm" className={classes.add}>
          <FileButton
            onChange={(picked) => picked.length > 0 && void upload(picked)}
            accept="application/pdf,application/zip,image/png,image/jpeg,.pdf,.zip,.png,.jpg,.jpeg"
            multiple
          >
            {(props) => (
              <Button
                {...props}
                variant="subtle"
                size="compact-sm"
                loading={busy !== null}
                leftSection={<IconUpload size={14} aria-hidden />}
              >
                Add files
              </Button>
            )}
          </FileButton>
          <span className={classes.meta} aria-live="polite">
            {busy ? `Uploading ${busy}…` : `PDF, ZIP, PNG or JPEG, up to ${maxFileMb} MB each`}
          </span>
        </Group>
      )}
    </section>
  );
}
