import { describe, expect, it } from 'vitest';

import { parseCsv, parseImport } from './csv';

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
