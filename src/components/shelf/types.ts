export const TYPE_LABELS: Record<string, string> = {
  board: 'Board game',
  card: 'Card game',
  rpg: 'RPG',
  video: 'Video game',
  puzzle: 'Puzzle',
  other: 'Other',
};

/** Plural forms, for headings and links that stand for every game of a kind. */
export const TYPE_PLURALS: Record<string, string> = {
  board: 'Board games',
  card: 'Card games',
  rpg: 'RPGs',
  video: 'Video games',
  puzzle: 'Puzzles',
  other: 'Other',
};

/** One hue per kind of game, used for the stand-in cover and the stripe on it. */
export const TYPE_HUES: Record<string, string> = {
  board: '#c8622a',
  card: '#6b4c9a',
  rpg: '#8a2b3a',
  video: '#d92846',
  puzzle: '#4f86a8',
  other: '#8a8a5e',
};
