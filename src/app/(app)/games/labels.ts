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

export const CONDITION_OPTIONS = ['new', 'good', 'worn', 'damaged', 'incomplete'].map((c) => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}));

export function playersLabel(min?: number | null, max?: number | null) {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max} players`;
  const n = min ?? max;
  return `${n} player${n === 1 ? '' : 's'}`;
}
