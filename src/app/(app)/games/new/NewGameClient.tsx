'use client';

import { useState } from 'react';
import { Box } from '@mantine/core';

import { saveGameAction } from '../actions';
import { EMPTY_GAME, GameForm, type GameFormValues } from '../GameForm';
import { Lookup } from '../Lookup';

export function NewGameClient() {
  const [initial, setInitial] = useState<GameFormValues>(EMPTY_GAME);
  const [version, setVersion] = useState(0);
  return (
    <>
      <Box maw={{ base: '100%', md: 700 }}>
        <Lookup
          onPick={(values) => {
            setInitial({ ...EMPTY_GAME, ...values });
            setVersion((v) => v + 1); // remount the form so its defaults update
          }}
        />
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
