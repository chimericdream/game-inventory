import { describe, expect, it } from 'vitest';

import type { AuditEntry } from '@/server/data/audit';

import { actorLabel, describeActivity } from './activity';

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 'e',
  entityType: 'game',
  entityId: 'g1',
  action: 'create',
  changes: {},
  at: new Date('2026-11-09T12:00:00Z'),
  actorName: 'Ada',
  ...over,
});

const titles = new Map([
  ['g1', 'Catan'],
  ['g2', 'Azul'],
]);

describe('describeActivity', () => {
  it('names the game for creates, edits and deletes', () => {
    expect(describeActivity(entry({}), titles)).toBe('added the game Catan');
    expect(
      describeActivity(
        entry({ action: 'update', changes: { notes: [null, 'x'], tags: [[], ['a']] } }),
        titles,
      ),
    ).toBe('changed Catan’s notes, tags');
    expect(
      describeActivity(
        entry({ action: 'delete', entityId: 'gone', changes: { title: ['Old Game', null] } }),
        titles,
      ),
    ).toBe('permanently deleted the game Old Game');
  });

  it('describes loans, plays and players in plain words', () => {
    expect(
      describeActivity(
        entry({ entityType: 'loan', changes: { borrower: [null, 'Dana'] } }),
        titles,
      ),
    ).toBe('lent a game to Dana');
    expect(
      describeActivity(entry({ entityType: 'play', changes: { gameId: [null, 'g2'] } }), titles),
    ).toBe('logged a play of Azul');
    expect(
      describeActivity(
        entry({ entityType: 'player', changes: { displayName: [null, 'John'] } }),
        titles,
      ),
    ).toBe('added John as a player');
    expect(
      describeActivity(
        entry({
          entityType: 'player',
          action: 'update',
          changes: { merged: [null, { id: 'x', displayName: 'Jon', plays: 1 }] },
        }),
        titles,
      ),
    ).toBe('merged two people who play');
  });

  it('never throws on an entry it does not know', () => {
    expect(describeActivity(entry({ entityType: 'user', changes: {} }), titles)).toBe(
      'added someone to the household',
    );
    expect(
      describeActivity(entry({ entityType: 'mystery' as never, action: 'update' }), titles),
    ).toBe('updated something');
  });
});

describe('actorLabel', () => {
  it('credits the person, the trash cleanup, or someone who has left', () => {
    expect(actorLabel(entry({}))).toBe('Ada');
    expect(actorLabel(entry({ actorName: null }))).toBe('Someone who has since left');
    expect(
      actorLabel(
        entry({ action: 'delete', actorName: null, changes: { automatic: [null, true] } }),
      ),
    ).toBe('Trash cleanup');
  });
});
