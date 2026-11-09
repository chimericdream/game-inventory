'use client';

import { useState } from 'react';
import { Box, Text } from '@mantine/core';

import { saveGameAction } from '../actions';
import { EMPTY_GAME, GameForm, type GameFormValues } from '../GameForm';
import { Lookup } from '../Lookup';

export function NewGameClient() {
  const [initial, setInitial] = useState<GameFormValues>(EMPTY_GAME);
  const [version, setVersion] = useState(0);
  const [filled, setFilled] = useState<string[]>([]);
  return (
    <>
      <Box maw={{ base: '100%', md: 700 }}>
        <Lookup
          onPick={(values, names) => {
            setInitial({ ...EMPTY_GAME, ...values });
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
        cancelHref="/games"
      />
    </>
  );
}
