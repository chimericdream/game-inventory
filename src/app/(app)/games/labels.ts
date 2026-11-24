export const TYPE_LABELS: Record<string, string> = {
  board: 'Board game',
  card: 'Card game',
  rpg: 'RPG',
  video: 'Video game',
  puzzle: 'Puzzle',
  other: 'Other',
};

export const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const VISIBILITY_OPTIONS = [
  { value: 'normal', label: 'Visible to everyone' },
  { value: 'hide_images', label: 'Hide images from restricted profiles' },
  { value: 'hidden_restricted', label: 'Hide entirely from restricted profiles' },
];

export const CONDITION_LABELS: Record<string, string> = {
  unopened: 'Unopened',
  like_new: 'Like new',
  good: 'Good',
  worn: 'Worn',
  damaged: 'Damaged',
  incomplete: 'Incomplete',
};

export const CONDITION_OPTIONS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const FORMAT_LABELS: Record<string, string> = {
  physical: 'Physical',
  digital: 'Digital',
  print_and_play: 'Print & play',
};

export const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const ACCESSORY_KIND_LABELS: Record<string, string> = {
  playmat: 'Playmat',
  organizer: 'Organizer or insert',
  upgraded_components: 'Upgraded components',
  miniatures: 'Miniatures',
  sleeves: 'Sleeves',
  other: 'Other',
};

export const ACCESSORY_KIND_OPTIONS = Object.entries(ACCESSORY_KIND_LABELS).map(
  ([value, label]) => ({ value, label }),
);
