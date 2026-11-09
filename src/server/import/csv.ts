import { GAME_TYPES, type GameType } from '../data/games';

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = input.replace(/^﻿/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface ImportRow {
  title: string;
  type: GameType;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  complexity: number | null;
  pieceCount: number | null;
  tags: string[];
  platform: string | null;
  location: string | null;
  notes: string | null;
}

export interface ImportParseResult {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  /** The file's header row as written. */
  header: string[];
  /** Header names that were not recognised, so their values were ignored. */
  unusedColumns: string[];
  /** The rows behind `errors`, with their original cells, so they can be fixed and re-imported. */
  failedRows: { line: number; cells: string[] }[];
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** The header plus the rows that failed, as CSV text ready to download, fix and import again. */
export function failedRowsCsv(result: Pick<ImportParseResult, 'header' | 'failedRows'>): string {
  const lines = [result.header, ...result.failedRows.map((r) => r.cells)];
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const HEADER_ALIASES: Record<string, string> = {
  name: 'title',
  game: 'title',
  title: 'title',
  type: 'type',
  category: 'type',
  minplayers: 'minPlayers',
  min_players: 'minPlayers',
  maxplayers: 'maxPlayers',
  max_players: 'maxPlayers',
  playtime: 'playTimeMinutes',
  play_time: 'playTimeMinutes',
  minutes: 'playTimeMinutes',
  complexity: 'complexity',
  weight: 'complexity',
  pieces: 'pieceCount',
  piece_count: 'pieceCount',
  piececount: 'pieceCount',
  tags: 'tags',
  genre: 'tags',
  platform: 'platform',
  console: 'platform',
  location: 'location',
  notes: 'notes',
};

const num = (v: string | undefined) => {
  if (!v || v.trim() === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const TYPE_ALIASES: Record<string, GameType> = {
  boardgame: 'board',
  'board game': 'board',
  cardgame: 'card',
  'card game': 'card',
  ttrpg: 'rpg',
  videogame: 'video',
  'video game': 'video',
};

export function parseImport(csv: string): ImportParseResult {
  const table = parseCsv(csv);
  const errors: ImportParseResult['errors'] = [];
  const failedRows: ImportParseResult['failedRows'] = [];
  if (table.length === 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'File is empty' }],
      header: [],
      unusedColumns: [],
      failedRows,
    };
  }

  const rawHeader = table[0]!.map((h) => h.trim());
  const header = rawHeader.map((h) => HEADER_ALIASES[h.toLowerCase()] ?? null);
  const unusedColumns = rawHeader.filter((h, i) => h !== '' && header[i] === null);
  if (!header.includes('title')) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'A "title" (or "name") column is required' }],
      header: rawHeader,
      unusedColumns,
      failedRows,
    };
  }

  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (key: string) => {
      const col = header.indexOf(key);
      return col === -1 ? undefined : cells[col]?.trim();
    };
    const title = get('title');
    if (!title) {
      errors.push({ line, message: 'Missing title' });
      failedRows.push({ line, cells });
      return;
    }
    const rawType = (get('type') ?? 'board').toLowerCase();
    const type =
      TYPE_ALIASES[rawType] ?? (GAME_TYPES.find((t) => t === rawType) as GameType | undefined);
    if (!type) {
      errors.push({ line, message: `Unknown type "${get('type')}"` });
      failedRows.push({ line, cells });
      return;
    }
    const complexity = num(get('complexity'));
    rows.push({
      title,
      type,
      minPlayers: num(get('minPlayers')),
      maxPlayers: num(get('maxPlayers')),
      playTimeMinutes: num(get('playTimeMinutes')),
      complexity: complexity && complexity >= 1 && complexity <= 5 ? complexity : null,
      pieceCount: num(get('pieceCount')),
      tags: (get('tags') ?? '')
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean),
      platform: get('platform') || null,
      location: get('location') || null,
      notes: get('notes') || null,
    });
  });
  return { rows, errors, header: rawHeader, unusedColumns, failedRows };
}
