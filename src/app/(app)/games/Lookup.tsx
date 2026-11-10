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
  isExpansion?: boolean;
}

interface ExpansionHit {
  id: number;
  name: string;
  /** Already in the library, by BGG id or title. */
  owned: boolean;
}

interface Props {
  /** `filled` names the fields the lookup supplied, for a note above the form. */
  onPick: (values: Partial<GameFormValues>, filled: string[]) => void;
  /** Adding an expansion to this game: its BGG expansions are listed up front. */
  base?: { title: string; bggId: number | null } | null;
  /** Games an expansion can belong to, to match BGG's base game by name. */
  baseGames?: { value: string; label: string }[];
}

// BarcodeDetector is not in the TS DOM lib yet.
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare const BarcodeDetector: new (opts: { formats: string[] }) => Detector;

export function Lookup({ onPick, base = null, baseGames = [] }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What "Try again" does after a failed lookup (not after an empty result, where retrying is pointless).
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [scanning, setScanning] = useState(false);
  const [expansions, setExpansions] = useState<ExpansionHit[] | null>(null);
  const [expansionsError, setExpansionsError] = useState<string | null>(null);
  const canScan = useSyncExternalStore(
    () => () => {},
    () => 'BarcodeDetector' in window,
    () => false,
  );

  // Adding an expansion: list the base game's expansions from BGG so each is one click away.
  // A game added before BGG ids were kept is found again by its exact title.
  useEffect(() => {
    if (!base) return;
    const abort = new AbortController();
    (async () => {
      try {
        let bggId = base.bggId;
        if (!bggId) {
          const res = await fetch(`/api/lookup/bgg?q=${encodeURIComponent(base.title)}`, {
            signal: abort.signal,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
          bggId =
            (data.hits as Hit[]).find(
              (h) =>
                !h.isExpansion && h.name.trim().toLowerCase() === base.title.trim().toLowerCase(),
            )?.id ?? null;
        }
        if (!bggId) {
          setExpansions([]);
          return;
        }
        const res = await fetch(`/api/lookup/bgg?expansionsOf=${bggId}`, { signal: abort.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
        setExpansions(data.expansions);
      } catch (e) {
        if (!abort.signal.aborted) {
          setExpansionsError(e instanceof Error ? e.message : 'Lookup failed');
        }
      }
    })();
    return () => abort.abort();
  }, [base]);

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
      // BGG names the base game of an expansion; match it to a game we have, by title.
      const baseName = (g.baseGames as { name: string }[]).map((b) => b.name.trim().toLowerCase());
      const baseMatch = baseGames.find((b) => baseName.includes(b.label.trim().toLowerCase()));
      onPick(
        {
          title: g.name,
          type: 'board',
          bggId: g.id,
          ...(g.isExpansion || base
            ? { isExpansion: true, ...(baseMatch && !base ? { baseGameId: baseMatch.value } : {}) }
            : {}),
          description: g.description,
          tags: g.tags.join(', '),
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          playTimeMinutes: g.playTimeMinutes,
          complexity: g.complexity,
          minAge: g.minAge,
          bggImageUrl: g.imageUrl,
        },
        [
          g.name && 'title',
          g.description && 'description',
          g.tags?.length && 'tags',
          (g.minPlayers || g.maxPlayers) && 'players',
          g.playTimeMinutes && 'play time',
          g.complexity && 'complexity',
          g.minAge && 'minimum age',
          g.imageUrl && 'cover',
          !base && baseMatch && g.isExpansion && 'base game',
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
            {h.isExpansion ? ' · expansion' : ''}
          </Button>
        ))}
        {base && (
          <Stack gap={2} data-bgg-expansions>
            <Text size="sm" fw={600}>
              Expansions of {base.title} on BoardGameGeek
            </Text>
            {expansionsError && (
              <Text size="sm" c="dimmed">
                {expansionsError} You can still search by name above.
              </Text>
            )}
            {!expansionsError && expansions === null && (
              <Text size="sm" c="dimmed">
                Loading…
              </Text>
            )}
            {expansions?.length === 0 && (
              <Text size="sm" c="dimmed">
                BoardGameGeek lists no expansions for this game. Search by name above.
              </Text>
            )}
            <Stack gap={0} mah={260} style={{ overflowY: 'auto' }}>
              {expansions?.map((e) => (
                <Button
                  key={e.id}
                  variant="subtle"
                  justify="space-between"
                  disabled={busy}
                  onClick={() => void pick({ id: e.id, name: e.name, year: null })}
                  rightSection={
                    e.owned ? (
                      <Text size="xs" c="dimmed">
                        In library
                      </Text>
                    ) : null
                  }
                >
                  {e.name}
                </Button>
              ))}
            </Stack>
          </Stack>
        )}
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
