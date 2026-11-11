import { describe, expect, it } from 'vitest';

import { bggImageUrl, parseExpansions, parseSearch, parseThing } from './bgg';

const SEARCH = `<?xml version="1.0" encoding="utf-8"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13"><name type="primary" value="CATAN"/><yearpublished value="1995"/></item>
  <item type="boardgameexpansion" id="27710"><name type="alternate" value="Catan: Cities"/><name type="primary" value="Catan Cities"/></item>
</items>`;

const THING = `<?xml version="1.0" encoding="utf-8"?>
<items><item type="boardgame" id="13">
  <name type="primary" sortindex="1" value="CATAN"/>
  <thumbnail>https://cf.geekdo-images.com/thumb/catan.jpg</thumbnail>
  <image>https://cf.geekdo-images.com/original/catan.jpg</image>
  <description>Build &amp; trade.&#10;&#10;Settle the island.</description>
  <minplayers value="3"/><maxplayers value="4"/><playingtime value="120"/><minage value="10"/>
  <link type="boardgamecategory" id="1021" value="Economic"/>
  <link type="boardgamecategory" id="1026" value="Negotiation"/>
  <link type="boardgamemechanic" id="2" value="Dice Rolling"/>
  <link type="boardgamepublisher" id="37" value="Kosmos"/>
  <link type="boardgamepublisher" id="38" value="Catan Studio"/>
  <link type="boardgameexpansion" id="926" value="Seafarers"/>
  <link type="boardgameexpansion" id="325" value="Cities &amp; Knights"/>
  <statistics><ratings><averageweight value="2.33"/></ratings></statistics>
</item></items>`;

describe('BGG parsing', () => {
  it('parses search results, preferring the primary name', () => {
    expect(parseSearch(SEARCH)).toEqual([
      { id: 13, name: 'CATAN', year: 1995, isExpansion: false },
      { id: 27710, name: 'Catan Cities', year: null, isExpansion: true },
    ]);
  });

  it('parses a thing into catalog fields', () => {
    expect(parseThing(THING)).toEqual({
      id: 13,
      name: 'CATAN',
      description: 'Build & trade.\n\nSettle the island.',
      minPlayers: 3,
      maxPlayers: 4,
      playTimeMinutes: 120,
      minAge: 10,
      complexity: 2,
      tags: ['Economic', 'Negotiation'],
      publisher: 'Kosmos',
      imageUrl: 'https://cf.geekdo-images.com/original/catan.jpg',
      isExpansion: false,
      baseGames: [],
    });
  });

  it('takes the first publisher, and null when BGG lists none', () => {
    const none = THING.replace(/<link type="boardgamepublisher"[^>]*\/>\n?/g, '');
    expect(parseThing(none)?.publisher).toBeNull();
    const amp = none.replace(
      '</item>',
      '<link type="boardgamepublisher" id="1" value="Z-Man &amp; Co"/></item>',
    );
    expect(parseThing(amp)?.publisher).toBe('Z-Man & Co');
  });

  it('lists the expansions of a base game by name', () => {
    expect(parseExpansions(THING)).toEqual([
      { id: 325, name: 'Cities & Knights' },
      { id: 926, name: 'Seafarers' },
    ]);
  });

  it('reads the base game of an expansion from its inbound link', () => {
    const exp = `<items><item type="boardgameexpansion" id="926">
      <name type="primary" value="Seafarers"/>
      <link type="boardgameexpansion" id="13" value="CATAN" inbound="true"/></item></items>`;
    expect(parseThing(exp)).toMatchObject({
      isExpansion: true,
      baseGames: [{ id: 13, name: 'CATAN' }],
    });
    // Inbound links are the base game, never one of its own expansions.
    expect(parseExpansions(exp)).toEqual([]);
  });

  it('falls back to the thumbnail, and to null when there is no image', () => {
    const thumb = THING.replace(/<image>.*<\/image>\n?/, '');
    expect(parseThing(thumb)?.imageUrl).toBe('https://cf.geekdo-images.com/thumb/catan.jpg');
    expect(parseThing(thumb.replace(/<thumbnail>.*<\/thumbnail>\n?/, ''))?.imageUrl).toBeNull();
  });

  it('only accepts https URLs on the BGG image host', () => {
    expect(bggImageUrl('https://cf.geekdo-images.com/a.jpg')).toBe(
      'https://cf.geekdo-images.com/a.jpg',
    );
    for (const bad of [
      'http://cf.geekdo-images.com/a.jpg',
      'https://evil.example/a.jpg',
      'https://geekdo-images.com.evil.example/a.jpg',
      'https://user:pw@cf.geekdo-images.com/a.jpg',
      'http://169.254.169.254/',
      'not a url',
      undefined,
    ])
      expect(bggImageUrl(bad)).toBeNull();
  });

  it('handles empty results', () => {
    expect(parseSearch('<items total="0"></items>')).toEqual([]);
    expect(parseThing('<items></items>')).toBeNull();
  });
});
