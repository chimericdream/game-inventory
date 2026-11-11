import type { AuditEntry } from '@/server/data/audit';

const FIELD_NAMES: Record<string, string> = {
  title: 'title',
  type: 'type',
  description: 'description',
  notes: 'notes',
  visibility: 'visibility',
  shareable: 'guest sharing',
  coverImage: 'picture',
  tags: 'tags',
  board: 'details',
  rpg: 'details',
  puzzle: 'details',
  condition: 'condition',
  conditionNotes: 'condition details',
  ownerUserId: 'owner',
  locationId: 'location',
  priceCents: 'price',
  acquiredOn: 'date acquired',
  platform: 'platform',
  format: 'format',
  displayName: 'name',
  returnedOn: 'return date',
};

const fieldList = (keys: string[]) => {
  const names = [...new Set(keys.map((k) => FIELD_NAMES[k] ?? k))];
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and more`;
};

const first = (entry: AuditEntry, key: string) => {
  const pair = entry.changes[key];
  if (!pair) return null;
  const [before, after] = pair;
  const value = after ?? before;
  return typeof value === 'string' ? value : null;
};

/** What was moved to the trash, restored or deleted for good, in words: "the game Catan", "a play". */
function trashNoun(entry: AuditEntry, gameTitle: (id: string | null) => string | null) {
  const game = gameTitle(first(entry, 'gameId'));
  switch (entry.entityType) {
    case 'game': {
      const title = first(entry, 'title');
      return title ? `the game ${title}` : 'a game';
    }
    case 'copy':
      return game ? `a copy of ${game}` : 'a copy';
    case 'play':
      return game ? `a play of ${game}` : 'a play';
    case 'wishlist_item':
      return first(entry, 'title')
        ? `${first(entry, 'title')} from the wishlist`
        : 'a wishlist item';
    case 'location':
      return first(entry, 'name') ? `the place ${first(entry, 'name')}` : 'a place';
    case 'player':
      return first(entry, 'displayName') ?? 'a player';
    default:
      return null;
  }
}

function describeTrash(entry: AuditEntry, gameTitle: (id: string | null) => string | null) {
  const what = trashNoun(entry, gameTitle);
  if (!what) return null;
  // A wishlist item that became a game is not a deletion.
  if (entry.changes.acquired) return null;
  if (entry.action === 'delete') return `permanently deleted ${what}`;
  const change = entry.changes.deletedAt;
  if (entry.action !== 'update' || !change) return null;
  return change[1] ? `moved ${what} to the trash` : `restored ${what} from the trash`;
}

/**
 * A sentence for an audit entry, such as "added the game Catan". `titles` maps game ids to their
 * current titles, for entries that only carry the id.
 */
export function describeActivity(entry: AuditEntry, titles: Map<string, string>): string {
  const gameTitle = (id: string | null) => (id ? (titles.get(id) ?? null) : null);
  const trashed = describeTrash(entry, gameTitle);
  if (trashed) return trashed;
  switch (entry.entityType) {
    case 'game': {
      const title = titles.get(entry.entityId) ?? first(entry, 'title');
      const name = title ? ` ${title}` : '';
      if (entry.action === 'create') return `added the game${name}`;
      const changed = Object.keys(entry.changes);
      return `changed${name ? ` ${title}’s` : ' a game’s'} ${fieldList(changed)}`;
    }
    case 'copy': {
      const title = gameTitle(first(entry, 'gameId'));
      const of = title ? ` of ${title}` : '';
      if (entry.action === 'create') return `added a copy${of}`;
      if (entry.action === 'delete') return `removed a copy${of}`;
      return `changed a copy’s ${fieldList(Object.keys(entry.changes))}`;
    }
    case 'loan': {
      if (entry.action === 'create') {
        return `lent a game to ${first(entry, 'borrower') ?? 'someone'}`;
      }
      return 'marked a loan as returned';
    }
    case 'play': {
      const title = gameTitle(first(entry, 'gameId'));
      if (entry.action === 'delete') return 'deleted a play';
      return title ? `logged a play of ${title}` : 'logged a play';
    }
    case 'player': {
      const name = first(entry, 'displayName');
      if (entry.changes.merged) return 'merged two people who play';
      if (entry.changes.linked) return 'linked someone’s plays to their account';
      if (entry.action === 'create') return `added ${name ?? 'someone'} as a player`;
      if (entry.action === 'delete') return `removed ${name ?? 'a player'}`;
      return `renamed a player${name ? ` to ${name}` : ''}`;
    }
    case 'wishlist_item': {
      const title = first(entry, 'title');
      return entry.action === 'delete'
        ? `removed ${title ?? 'something'} from the wishlist`
        : `added ${title ?? 'something'} to the wishlist`;
    }
    case 'location': {
      const name = first(entry, 'name');
      return entry.action === 'delete'
        ? `removed the place ${name ?? ''}`.trim()
        : `added the place ${name ?? ''}`.trim();
    }
    case 'share_link': {
      const label = first(entry, 'label');
      if (entry.action === 'create') return `made a guest link${label ? ` called ${label}` : ''}`;
      return 'revoked a guest link';
    }
    case 'user': {
      const name = first(entry, 'name');
      return `added ${name ?? 'someone'} to the household`;
    }
    default:
      return `${entry.action}d something`;
  }
}
