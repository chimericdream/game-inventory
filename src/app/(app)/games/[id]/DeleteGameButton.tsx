'use client';

import { Text } from '@mantine/core';

import { ConfirmDelete } from '@/components/ConfirmDelete';

import { deleteGameAction } from '../actions';

interface Props {
  id: string;
  title: string;
  copies: number;
  plays: number;
  /** Titles of this game's expansions. */
  expansions: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Delete game" asks first. The game goes to the trash, where it can be restored. */
export function DeleteGameButton({ id, title, copies, plays, expansions }: Props) {
  return (
    <ConfirmDelete
      title={`Delete ${title}?`}
      triggerLabel="Delete game"
      blocked={
        copies > 0
          ? `${title} still has ${plural(copies, 'owned copy', 'owned copies')}. Remove ${copies === 1 ? 'it' : 'them'} first, then delete the game.`
          : undefined
      }
      action={() => deleteGameAction(id, {}, new FormData())}
    >
      <Text size="sm">
        {title} moves to the trash and disappears from the library and guest links.
        {plays > 0 && ` Its ${plural(plays, 'logged play')} are hidden with it.`} You can restore it
        from Settings → Trash.
      </Text>
      {expansions.length > 0 && (
        <Text size="sm" mt="xs" fw={600}>
          {plural(expansions.length, 'expansion')} ({expansions.slice(0, 3).join(', ')}
          {expansions.length > 3 ? ', …' : ''}) will stay in the library without a base game until
          this one is restored.
        </Text>
      )}
    </ConfirmDelete>
  );
}
