'use client';

import { useState } from 'react';
import { Box, Text } from '@mantine/core';

import { saveGameAction } from '../actions';
import { EMPTY_GAME, GameForm, type GameFormValues } from '../GameForm';
import { Lookup } from '../Lookup';

interface Props {
  members: { value: string; label: string }[];
  locations: { value: string; label: string }[];
  baseGames: { value: string; label: string }[];
  /** Set when adding an expansion from a game's page. */
  base: { id: string; type: string } | null;
}

export function NewGameClient({ members, locations, baseGames, base }: Props) {
  const start: GameFormValues = base
    ? { ...EMPTY_GAME, type: base.type, isExpansion: true, baseGameId: base.id }
    : EMPTY_GAME;
  const [initial, setInitial] = useState<GameFormValues>(start);
  const [version, setVersion] = useState(0);
  const [filled, setFilled] = useState<string[]>([]);
  return (
    <>
      <Box maw={{ base: '100%', md: 700 }}>
        <Lookup
          onPick={(values, names) => {
            setInitial({ ...start, ...values });
            setFilled(names);
            setVersion((v) => v + 1); // remount the form so its defaults update
          }}
        />
        {filled.length > 0 && (
          <Text size="sm" mb="md" data-lookup-filled>
            Filled in {filled.join(', ')} from BoardGameGeek. Check the details, then save.
          </Text>
        )}
      </Box>
      <GameForm
        key={version}
        action={saveGameAction.bind(null, null)}
        initial={initial}
        cancelHref={base ? `/games/${base.id}` : '/games'}
        copyOptions={{ members, locations }}
        baseGames={baseGames}
      />
    </>
  );
}
