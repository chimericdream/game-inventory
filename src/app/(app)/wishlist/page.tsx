import { Button } from '@mantine/core';
import { redirect } from 'next/navigation';

import { TYPE_LABELS } from '@/components/shelf/types';
import { requireContext } from '@/server/auth/current';
import { listMembers } from '@/server/data/lookups';
import { listWishlist } from '@/server/data/wishlist';

import { acquiredAction, removeWishlistAction } from '../tracking-actions';
import { WishAside, WishSheetButton } from './WishForm';
import classes from './Wishlist.module.css';

export const dynamic = 'force-dynamic';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function WishlistPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const [items, members] = await Promise.all([listWishlist(ctx), listMembers(ctx)]);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  // One list per person: the viewer's own first, then everyone else by name.
  const groups = new Map<string | null, typeof items>();
  for (const item of items) {
    const key = item.requestedByUserId;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const ordered = [...groups.entries()].toSorted(([a], [b]) => {
    if (a === ctx.viewer.userId) return -1;
    if (b === ctx.viewer.userId) return 1;
    return (nameOf.get(a ?? '') ?? 'zzz').localeCompare(nameOf.get(b ?? '') ?? 'zzz');
  });
  const heading = (userId: string | null) =>
    userId === ctx.viewer.userId
      ? 'Your wishlist'
      : userId && nameOf.get(userId)
        ? `${nameOf.get(userId)}’s wishlist`
        : 'Wished for by someone who has since left';

  return (
    <div className={classes.layout}>
      <div>
        <header className={classes.head}>
          <h1 className={classes.title}>Wishlist</h1>
          <p className={classes.summary}>
            {items.length === 0 ? (
              'The wishlist is empty.'
            ) : (
              <>
                <b>{plural(items.length, 'thing')} wished for</b> by{' '}
                {plural(groups.size, 'person', 'people')}.
              </>
            )}
          </p>
          <WishSheetButton />
        </header>

        {ordered.map(([userId, list]) => (
          <section
            key={userId ?? 'nobody'}
            className={classes.group}
            aria-labelledby={`w-${userId}`}
          >
            <h2 id={`w-${userId}`}>
              {heading(userId)}
              <span className={classes.count}>{list.length}</span>
            </h2>
            <ul className={classes.list}>
              {list.map((i) => (
                <li key={i.id} className={classes.item} data-wish>
                  <div>
                    <h3 className={classes.name}>
                      {i.url ? (
                        <a href={i.url} target="_blank" rel="noopener noreferrer">
                          {i.title}
                        </a>
                      ) : (
                        i.title
                      )}
                    </h3>
                    <div className={classes.facts}>
                      <span className={classes.kind}>{TYPE_LABELS[i.type] ?? i.type}</span>
                      {i.priceCents !== null && (
                        <span className={classes.price}>${(i.priceCents / 100).toFixed(2)}</span>
                      )}
                    </div>
                    {i.notes && <p className={classes.note}>{i.notes}</p>}
                  </div>
                  <div className={classes.actions}>
                    <form action={acquiredAction.bind(null, i.id)}>
                      <Button type="submit" variant="light">
                        We got it
                      </Button>
                    </form>
                    <form action={removeWishlistAction.bind(null, i.id)}>
                      <Button type="submit" variant="subtle" color="red">
                        Remove
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <WishAside />
    </div>
  );
}
