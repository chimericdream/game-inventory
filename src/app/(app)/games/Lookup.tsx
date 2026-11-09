'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconBarcode, IconSearch } from '@tabler/icons-react';

import type { GameFormValues } from './GameForm';

interface Hit {
  id: number;
  name: string;
  year: number | null;
}

interface Props {
  /** `filled` names the fields the lookup supplied, for a note above the form. */
  onPick: (values: Partial<GameFormValues>, filled: string[]) => void;
}

// BarcodeDetector is not in the TS DOM lib yet.
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare const BarcodeDetector: new (opts: { formats: string[] }) => Detector;

export function Lookup({ onPick }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What "Try again" does after a failed lookup (not after an empty result, where retrying is pointless).
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [scanning, setScanning] = useState(false);
  const canScan = useSyncExternalStore(
    () => () => {},
    () => 'BarcodeDetector' in window,
    () => false,
  );

  async function search(q = query) {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    setRetry(null);
    setHits([]); // a failed or empty search must not leave the previous results on screen
    try {
      const res = await fetch(`/api/lookup/bgg?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setHits(data.hits);
      if (data.hits.length === 0) setError('No matches on BoardGameGeek.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setRetry(() => () => void search(q));
    } finally {
      setBusy(false);
    }
  }

  async function pick(hit: Hit) {
    setBusy(true);
    setError(null);
    setRetry(null);
    try {
      const res = await fetch(`/api/lookup/bgg?id=${hit.id}`);
      const data = await res.json();
      if (!res.ok || !data.game) throw new Error(data.error ?? 'Lookup failed');
      const g = data.game;
      onPick(
        {
          title: g.name,
          type: 'board',
          description: g.description,
          tags: g.tags.join(', '),
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          playTimeMinutes: g.playTimeMinutes,
          complexity: g.complexity,
          minAge: g.minAge,
        },
        [
          g.name && 'title',
          g.description && 'description',
          g.tags?.length && 'tags',
          (g.minPlayers || g.maxPlayers) && 'players',
          g.playTimeMinutes && 'play time',
          g.complexity && 'complexity',
          g.minAge && 'minimum age',
        ].filter((x): x is string => typeof x === 'string'),
      );
      setHits([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setRetry(() => () => void pick(hit));
    } finally {
      setBusy(false);
    }
  }

  async function onBarcode(code: string) {
    setScanning(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/lookup/upc?code=${encodeURIComponent(code)}`);
      const { title } = await res.json();
      if (title) {
        setQuery(title);
        await search(title);
      } else {
        setError(`No product found for barcode ${code}. Search by title instead.`);
        setBusy(false);
      }
    } catch {
      setError('Barcode lookup failed.');
      setBusy(false);
    }
  }

  return (
    <Paper withBorder p="sm" radius="md" maw={640} mb="md">
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Find on BoardGameGeek
        </Text>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            placeholder="Search a title to fill in the details"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button
            onClick={() => void search()}
            loading={busy}
            leftSection={<IconSearch size={16} />}
          >
            Search
          </Button>
          {canScan && (
            <ActionIcon
              size="lg"
              variant="default"
              onClick={() => setScanning(true)}
              aria-label="Scan barcode"
            >
              <IconBarcode size={18} />
            </ActionIcon>
          )}
        </Group>
        {error && (
          <Alert color="yellow" variant="light">
            {error}
            {retry && (
              <Button variant="light" size="compact-sm" ml="sm" onClick={retry}>
                Try again
              </Button>
            )}
          </Alert>
        )}
        {hits.map((h) => (
          <Button key={h.id} variant="subtle" justify="flex-start" onClick={() => void pick(h)}>
            {h.name}
            {h.year ? ` (${h.year})` : ''}
          </Button>
        ))}
      </Stack>
      <Modal opened={scanning} onClose={() => setScanning(false)} title="Scan a barcode" centered>
        {scanning && (
          <Scanner
            onCode={onBarcode}
            onError={(m) => {
              setScanning(false);
              setError(m);
            }}
          />
        )}
      </Modal>
    </Paper>
  );
}

function Scanner({
  onCode,
  onError,
}: {
  onCode: (code: string) => void;
  onError: (m: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const run = { stop: false };
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e'] });
        while (!run.stop) {
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]) return onCode(found[0].rawValue);
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        onError('Could not open the camera.');
      }
    })();
    return () => {
      run.stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode, onError]);

  return <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 8 }} />;
}
