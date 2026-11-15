import { readFileSync } from 'node:fs';

import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from './client';
import { games, gameTags, households, shareLinks, tags } from './schema';
import { createTestDb } from './test-db';

// The migration has already run on the empty test database; this replays it over rows written the
// way the old BGG lookup stored them. Migrations run inside one transaction, so this does too.
const statements = readFileSync('./drizzle/0005_decode_html_entities.sql', 'utf8').split(
  '--> statement-breakpoint',
);
const runMigration = (db: Db) =>
  db.transaction(async (tx) => {
    for (const s of statements) await tx.execute(sql.raw(s));
  });

let db: Db;
let householdId: string;
beforeEach(async () => {
  db = await createTestDb();
  householdId = (await db.insert(households).values({ name: 'Home' }).returning())[0]!.id;
});

const addGame = async (values: Partial<typeof games.$inferInsert> & { title: string }) =>
  (
    await db
      .insert(games)
      .values({ householdId, type: 'board', ...values })
      .returning({ id: games.id })
  )[0]!.id;

const addTag = async (name: string, ...gameIds: string[]) => {
  const id = (await db.insert(tags).values({ householdId, name }).returning())[0]!.id;
  for (const gameId of gameIds)
    await db.insert(gameTags).values({ householdId, gameId, tagId: id });
  return id;
};

describe('0005 decode_html_entities', () => {
  it('decodes named and numeric references in game text', async () => {
    const id = await addGame({
      title: 'Tom&#039;s Tale &amp; More',
      description:
        'Heroes may be &ldquo;squished&rdquo; &mdash; the monster&rsquo;s cup.\nCaf&eacute; &#x2014; &#8230;',
      publisher: 'Dr. Finn&#39;s Games',
    });
    await runMigration(db);
    const [g] = await db.select().from(games).where(eq(games.id, id));
    expect(g).toMatchObject({
      title: "Tom's Tale & More",
      description: 'Heroes may be “squished” — the monster’s cup.\nCafé — …',
      publisher: "Dr. Finn's Games",
    });
  });

  it('leaves plain ampersands, unknown names and unsafe code points alone', async () => {
    const text = 'R&D; Fish & Chips &bogus; &#0; &#x1;&#55296; AT&T &amp';
    const id = await addGame({ title: text, description: null, publisher: null });
    await runMigration(db);
    const [g] = await db.select().from(games).where(eq(games.id, id));
    expect(g).toMatchObject({ title: text, description: null, publisher: null });
  });

  it('renames tags, merging one into an existing tag with the clean name', async () => {
    const a = await addGame({ title: 'A' });
    const b = await addGame({ title: 'B' });
    const c = await addGame({ title: 'C' });
    const clean = await addTag("children's game", a);
    await addTag('Children&#039;s Game', a, b);
    await addTag('Children&apos;s Game', c);
    const renamed = await addTag('Sci&#8209;Fi &amp; Fantasy', c);
    await addTag('Dice', b);

    await runMigration(db);

    const after = await db.select({ id: tags.id, name: tags.name }).from(tags);
    expect(after.toSorted((x, y) => x.name.localeCompare(y.name))).toEqual([
      { id: clean, name: "children's game" },
      { id: expect.any(String), name: 'Dice' },
      { id: renamed, name: 'Sci‑Fi & Fantasy' },
    ]);
    const onClean = await db
      .select({ gameId: gameTags.gameId })
      .from(gameTags)
      .where(eq(gameTags.tagId, clean));
    expect(onClean.map((r) => r.gameId).toSorted()).toEqual([a, b, c].toSorted());
  });

  it('keeps guest-link tag rules in step with the renamed tags', async () => {
    const [link] = await db
      .insert(shareLinks)
      .values({
        householdId,
        label: 'Friends',
        tokenHash: 'x',
        hideTags: ['Horror', 'Children&#039;s Game'],
      })
      .returning();
    await runMigration(db);
    const [after] = await db.select().from(shareLinks).where(eq(shareLinks.id, link!.id));
    expect(after?.hideTags).toEqual(['Horror', "Children's Game"]);
  });
});
