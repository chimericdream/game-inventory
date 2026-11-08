import { describe, expect, it } from 'vitest';

import { redactGame, type VisibleGameFields } from './visibility';

const admin = { kind: 'user', userId: 'a', role: 'admin' } as const;
const member = { kind: 'user', userId: 'm', role: 'member' } as const;
const kid = { kind: 'user', userId: 'k', role: 'restricted' } as const;

const game = (visibility: VisibleGameFields['visibility']): VisibleGameFields => ({
  visibility,
  coverImage: '/covers/x.jpg',
});

describe('redactGame', () => {
  it('shows normal games to restricted profiles unchanged', () => {
    expect(redactGame(game('normal'), kid)).toEqual(game('normal'));
  });

  it('strips the cover image for hide_images when the viewer is restricted', () => {
    expect(redactGame(game('hide_images'), kid)?.coverImage).toBeNull();
  });

  it('hides hidden_restricted games from restricted profiles entirely', () => {
    expect(redactGame(game('hidden_restricted'), kid)).toBeNull();
  });

  it('leaves everything visible for admin and member profiles', () => {
    for (const viewer of [admin, member]) {
      expect(redactGame(game('hidden_restricted'), viewer)).toEqual(game('hidden_restricted'));
      expect(redactGame(game('hide_images'), viewer)?.coverImage).toBe('/covers/x.jpg');
    }
  });
});
