import { Title } from '@mantine/core';
import { IconChevronRight, IconLogout, IconSettings, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireContext } from '@/server/auth/current';

import { logoutAction } from '../../(auth)/actions';
import classes from './More.module.css';

export const dynamic = 'force-dynamic';

/** The phone's fifth tab: everything that does not get a tab of its own. */
export default async function MorePage() {
  const { ctx, user } = await requireContext();
  if (ctx.viewer.role === 'restricted') redirect('/games');
  return (
    <>
      <Title order={1} mb="md">
        More
      </Title>
      <p className={classes.who}>Signed in as {user.name}</p>
      <ul className={classes.list}>
        <li>
          <Link href="/import" className={classes.row}>
            <IconUpload size={22} stroke={1.8} aria-hidden />
            <span>Import a collection</span>
            <IconChevronRight size={18} aria-hidden className={classes.chevron} />
          </Link>
        </li>
        <li>
          <Link href="/settings" className={classes.row}>
            <IconSettings size={22} stroke={1.8} aria-hidden />
            <span>Settings</span>
            <IconChevronRight size={18} aria-hidden className={classes.chevron} />
          </Link>
        </li>
        <li>
          <form action={logoutAction}>
            <button type="submit" className={classes.row}>
              <IconLogout size={22} stroke={1.8} aria-hidden />
              <span>Sign out</span>
            </button>
          </form>
        </li>
      </ul>
    </>
  );
}
