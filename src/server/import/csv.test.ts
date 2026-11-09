import { describe, expect, it } from 'vitest';

import { failedRowsCsv, parseCsv, parseImport } from './csv';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas and newlines, CRLF and BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",z\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', 'z'],
    ]);
  });

  it('skips blank lines and keeps a final row without a trailing newline', () => {
    expect(parseCsv('a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseImport', () => {
  it('maps header aliases, normalizes types, and splits tags', () => {
    const { rows, errors } = parseImport(
      'Name,Category,Min_Players,Max_Players,Minutes,Tags,Console\n' +
        'Catan,Board Game,3,4,90,strategy;classic,\n' +
        'Zelda,video game,,,,,Switch\n',
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      title: 'Catan',
      type: 'board',
      minPlayers: 3,
      maxPlayers: 4,
      playTimeMinutes: 90,
      tags: ['strategy', 'classic'],
    });
    expect(rows[1]).toMatchObject({ title: 'Zelda', type: 'video', platform: 'Switch' });
  });

  it('reports bad rows with line numbers but keeps the good ones', () => {
    const { rows, errors } = parseImport('title,type\nOk,board\n,board\nBad,spaceship\n');
    expect(rows.map((r) => r.title)).toEqual(['Ok']);
    expect(errors).toEqual([
      { line: 3, message: 'Missing title' },
      { line: 4, message: 'Unknown type "spaceship"' },
    ]);
  });

  it('requires a title column', () => {
    expect(parseImport('foo,bar\n1,2').errors[0]?.message).toMatch(/title/);
  });
});

describe('import extras', () => {
  it('reads a puzzle piece count from a "pieces" column', () => {
    const { rows } = parseImport('title,type,pieces\nAlpine Lake,puzzle,1000\nCatan,board,\n');
    expect(rows.map((r) => r.pieceCount)).toEqual([1000, null]);
  });

  it('lists the columns it did not recognise', () => {
    const result = parseImport('Title,Type,Colour,Shelf Code\nCatan,board,red,A1\n');
    expect(result.unusedColumns).toEqual(['Colour', 'Shelf Code']);
    expect(result.rows).toHaveLength(1);
  });

  it('keeps failed rows so they can be downloaded, fixed and imported again', () => {
    const csv = 'title,type,notes\nOk,board,fine\n,board,"no, title"\nBad,spaceship,\n';
    const result = parseImport(csv);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(failedRowsCsv(result)).toBe(
      'title,type,notes\r\n,board,"no, title"\r\nBad,spaceship,\r\n',
    );
    // Fix the type and the title, and the same file imports cleanly.
    const fixed = parseImport(
      failedRowsCsv(result).replace('spaceship', 'card').replace(',board,', 'Named,board,'),
    );
    expect(fixed.errors).toEqual([]);
    expect(fixed.rows.map((r) => r.title)).toEqual(['Named', 'Bad']);
  });
});
