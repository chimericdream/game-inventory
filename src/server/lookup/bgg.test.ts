import { describe, expect, it } from 'vitest';

import { parseSearch, parseThing } from './bgg';

const SEARCH = `<?xml version="1.0" encoding="utf-8"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13"><name type="primary" value="CATAN"/><yearpublished value="1995"/></item>
  <item type="boardgame" id="27710"><name type="alternate" value="Catan: Cities"/><name type="primary" value="Catan Cities"/></item>
</items>`;

const THING = `<?xml version="1.0" encoding="utf-8"?>
<items><item type="boardgame" id="13">
  <name type="primary" sortindex="1" value="CATAN"/>
  <description>Build &amp; trade.&#10;&#10;Settle the island.</description>
  <minplayers value="3"/><maxplayers value="4"/><playingtime value="120"/><minage value="10"/>
  <link type="boardgamecategory" id="1021" value="Economic"/>
  <link type="boardgamecategory" id="1026" value="Negotiation"/>
  <link type="boardgamemechanic" id="2" value="Dice Rolling"/>
  <statistics><ratings><averageweight value="2.33"/></ratings></statistics>
</item></items>`;

describe('BGG parsing', () => {
  it('parses search results, preferring the primary name', () => {
    expect(parseSearch(SEARCH)).toEqual([
      { id: 13, name: 'CATAN', year: 1995 },
      { id: 27710, name: 'Catan Cities', year: null },
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
    });
  });

  it('handles empty results', () => {
    expect(parseSearch('<items total="0"></items>')).toEqual([]);
    expect(parseThing('<items></items>')).toBeNull();
  });
});
