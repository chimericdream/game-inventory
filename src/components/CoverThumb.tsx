'use client';

import { Box, Image } from '@mantine/core';
import { IconDice5 } from '@tabler/icons-react';

/** A small cover for list rows; a dice glyph stands in when the game has no cover. */
export function CoverThumb({ gameId, hasCover }: { gameId: string; hasCover: boolean }) {
  return (
    <Box
      w={40}
      h={52}
      style={{
        flex: 'none',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--mantine-color-default-hover)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {hasCover ? (
        <Image src={`/api/games/${gameId}/cover`} alt="" w={40} h={52} fit="cover" />
      ) : (
        <IconDice5 size={20} opacity={0.4} />
      )}
    </Box>
  );
}
