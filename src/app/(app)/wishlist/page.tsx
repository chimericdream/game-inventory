import { Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';
import { listWishlist } from '@/server/data/wishlist';

import { WishlistView } from './WishlistView';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const { ctx } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  const items = await listWishlist(ctx);
  return (
    <>
      <Title order={2} mb="md">
        Wishlist
      </Title>
      <WishlistView
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          url: i.url,
          priceCents: i.priceCents,
          notes: i.notes,
        }))}
      />
    </>
  );
}
