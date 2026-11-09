// A believable family library for the screenshot run: mixed types, covers, tags, owners and places.
import type * as Db from '../support/db';
import { coverPng } from '../support/images';
import { MEMBER } from '../support/roles';

type DbApi = typeof Db;

interface Demo {
  title: string;
  type?: Db.GameType;
  players?: [number, number];
  minutes?: number;
  complexity?: number;
  age?: number;
  tags?: string[];
  description?: string;
  notes?: string;
  system?: string;
  bookKind?: string;
  platform?: string;
  noCover?: boolean;
  visibility?: 'normal' | 'hide_images' | 'hidden_restricted';
  shareable?: boolean;
}

const GAMES: Demo[] = [
  {
    title: 'Catan',
    players: [3, 4],
    minutes: 90,
    complexity: 2,
    age: 10,
    tags: ['strategy', 'trading', 'family'],
    shareable: true,
    description: 'Settle an island, trade resources and race to ten victory points.',
    notes: 'Missing one brick card; use a coin.',
  },
  {
    title: 'Pandemic',
    players: [2, 4],
    minutes: 45,
    complexity: 2,
    age: 8,
    tags: ['co-op', 'family'],
    shareable: true,
    description: 'Work together to stop four diseases from spreading across the globe.',
  },
  {
    title: 'Wingspan',
    players: [1, 5],
    minutes: 70,
    complexity: 3,
    age: 10,
    tags: ['strategy', 'engine-building'],
    shareable: true,
    description: 'Attract birds to your wildlife preserves.',
  },
  {
    title: 'Ticket to Ride',
    players: [2, 5],
    minutes: 60,
    complexity: 2,
    age: 8,
    tags: ['family', 'trains'],
    shareable: true,
  },
  {
    title: 'Carcassonne',
    players: [2, 5],
    minutes: 45,
    complexity: 2,
    age: 7,
    tags: ['family', 'tile-laying'],
    shareable: true,
  },
  {
    title: 'Azul',
    players: [2, 4],
    minutes: 40,
    complexity: 2,
    age: 8,
    tags: ['abstract', 'family'],
    shareable: true,
  },
  {
    title: 'Terraforming Mars',
    players: [1, 5],
    minutes: 120,
    complexity: 4,
    age: 12,
    tags: ['strategy', 'engine-building'],
    description: 'Compete to transform the red planet into a livable world.',
  },
  {
    title: 'Gloomhaven: Jaws of the Lion',
    players: [1, 4],
    minutes: 90,
    complexity: 4,
    age: 14,
    tags: ['co-op', 'campaign'],
    visibility: 'hidden_restricted',
  },
  {
    title: 'Codenames',
    type: 'card',
    players: [4, 8],
    minutes: 15,
    complexity: 1,
    age: 10,
    tags: ['party', 'word'],
    shareable: true,
  },
  {
    title: 'Exploding Kittens',
    type: 'card',
    players: [2, 5],
    minutes: 15,
    complexity: 1,
    age: 7,
    tags: ['party', 'family'],
  },
  {
    title: 'Sushi Go!',
    type: 'card',
    players: [2, 5],
    minutes: 15,
    complexity: 1,
    age: 8,
    tags: ['family', 'drafting'],
    shareable: true,
  },
  {
    title: "Dungeons & Dragons: Player's Handbook",
    type: 'rpg',
    system: 'D&D 5e',
    bookKind: 'Core rulebook',
    tags: ['fantasy'],
    shareable: true,
  },
  {
    title: 'Monster Manual',
    type: 'rpg',
    system: 'D&D 5e',
    bookKind: 'Bestiary',
    tags: ['fantasy'],
  },
  {
    title: 'Call of Cthulhu Starter Set',
    type: 'rpg',
    system: 'Call of Cthulhu 7e',
    bookKind: 'Starter set',
    tags: ['horror'],
    visibility: 'hide_images',
  },
  {
    title: 'The Legend of Zelda: Tears of the Kingdom',
    type: 'video',
    platform: 'Switch',
    tags: ['adventure'],
    shareable: true,
  },
  {
    title: 'Mario Kart 8 Deluxe',
    type: 'video',
    platform: 'Switch',
    tags: ['racing', 'family'],
    shareable: true,
  },
  {
    title: 'Super Smash Bros. Ultimate',
    type: 'video',
    platform: 'Switch',
    tags: ['fighting', 'family'],
  },
  {
    title: 'God of War Ragnarök',
    type: 'video',
    platform: 'PS5',
    tags: ['adventure'],
    visibility: 'hidden_restricted',
  },
  { title: 'Ravensburger Castle 1000 pc', type: 'puzzle', tags: ['puzzle'] },
  {
    title: 'Dominion',
    type: 'card',
    players: [2, 4],
    minutes: 30,
    complexity: 2,
    age: 13,
    tags: ['deck-building', 'strategy'],
  },
  {
    title: 'Betrayal at House on the Hill',
    players: [3, 6],
    minutes: 60,
    complexity: 2,
    age: 12,
    tags: ['horror', 'party'],
    noCover: true,
  },
  {
    title: 'A Very Long Game Title That Keeps Going to Test How Cards Wrap Across Several Lines',
    players: [2, 6],
    minutes: 240,
    complexity: 5,
    age: 16,
    tags: ['strategy'],
    noCover: true,
  },
  {
    title: 'Uno',
    type: 'card',
    players: [2, 10],
    minutes: 20,
    complexity: 1,
    age: 7,
    tags: ['family'],
    noCover: true,
  },
  {
    title: 'Scrabble',
    players: [2, 4],
    minutes: 60,
    complexity: 2,
    age: 8,
    tags: ['word', 'family'],
  },
];

export interface DemoIds {
  ids: Record<string, string>;
}

const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** Seeds the demo library, locations, loans, plays and wishlist. Returns ids by title. */
export async function seedDemo(db: DbApi): Promise<DemoIds> {
  const hall = await db.seedLocation('Hall closet');
  const shelf = await db.seedLocation('Shelf 2', hall);
  const attic = await db.seedLocation('Attic');
  const den = await db.seedLocation('Den');
  const places = [hall, shelf, attic, den];

  const ids: Record<string, string> = {};
  let i = 0;
  for (const g of GAMES) {
    const type = g.type ?? 'board';
    const isVideo = type === 'video';
    ids[g.title] = await db.seedGame({
      title: g.title,
      type,
      description: g.description,
      notes: g.notes,
      tags: g.tags,
      minPlayers: g.players?.[0],
      maxPlayers: g.players?.[1],
      playTimeMinutes: g.minutes,
      complexity: g.complexity,
      minAge: g.age,
      system: g.system,
      bookKind: g.bookKind,
      visibility: g.visibility,
      shareable: g.shareable,
      cover: g.noCover ? false : coverPng(g.title),
      copies: [
        {
          platform: isVideo ? g.platform : null,
          format: isVideo && i % 2 === 0 ? 'digital' : 'physical',
          condition: (['good', 'new', 'worn', 'good', 'incomplete'] as const)[i % 5],
          priceCents: 1999 + i * 650,
          ownerEmail: i % 3 === 0 ? MEMBER.email : null,
          locationId: isVideo ? den : places[i % places.length],
        },
      ],
    });
    i++;
  }
  // Catan has a second, worn copy so the copies panel shows more than one row.
  await db.seedCopy(ids.Catan!, { condition: 'worn', priceCents: 800, locationId: attic });

  const copyOf = async (title: string) =>
    (await db.sql`select id from copies where game_id = ${ids[title]!} limit 1`)[0]!.id as string;
  await db.seedLoan(await copyOf('Azul'), {
    borrower: 'Neighbor Nick',
    lentOn: '2026-01-05',
    dueOn: '2026-01-26',
  });
  await db.seedLoan(await copyOf('Pandemic'), { borrower: 'Aunt Jo', dueOn: '2099-12-31' });
  await db.seedLoan(await copyOf('Codenames'), { borrower: 'Sam from school' });
  await db.seedLoan(await copyOf('Uno'), {
    borrower: 'Already back',
    lentOn: '2025-12-01',
    returnedOn: '2025-12-20',
  });

  await db.seedPlay(ids.Catan!, {
    playedOn: ago(3),
    minutes: 95,
    players: ['Ann', 'Bob', 'Cy'],
    winner: 'Ann',
  });
  await db.seedPlay(ids.Catan!, {
    playedOn: ago(40),
    minutes: 80,
    players: ['Ann', 'Bob'],
    winner: 'Bob',
  });
  await db.seedPlay(ids.Catan!, { playedOn: ago(90), players: ['Ann', 'Cy', 'Dee'] });
  await db.seedPlay(ids.Wingspan!, {
    playedOn: ago(7),
    minutes: 60,
    players: ['Ann', 'Dee'],
    winner: 'Dee',
  });
  await db.seedPlay(ids['Mario Kart 8 Deluxe']!, {
    playedOn: ago(1),
    minutes: 30,
    players: ['Kit', 'Mo', 'Ada'],
    winner: 'Kit',
  });
  await db.seedPlay(ids.Carcassonne!, { playedOn: ago(600), players: ['Ann'], winner: 'Ann' });

  await db.seedWish('Gloomhaven', 'board');
  await db.seedWish("Baldur's Gate 3", 'video');
  await db.seedWish('Pathfinder Core Rulebook', 'rpg');
  await db.sql`update wishlist_items set url = 'https://example.com/gloomhaven', price_cents = 13999, notes = 'For the holidays' where title = 'Gloomhaven'`;
  await db.sql`update wishlist_items set price_cents = 5999 where title = ${"Baldur's Gate 3"}`;

  return { ids };
}
