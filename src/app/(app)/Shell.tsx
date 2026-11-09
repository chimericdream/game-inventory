'use client';

import { Avatar, Button, Container, Group, Text } from '@mantine/core';
import {
  IconArrowsExchange,
  IconBooks,
  IconDice5,
  IconDots,
  IconHeart,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUpload,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkButton, LinkIconButton } from '@/components/Links';
import type { NavCounts } from '@/server/data/nav';

import { logoutAction } from '../(auth)/actions';
import classes from './Shell.module.css';

interface Props {
  user: { name: string; role: string };
  counts: NavCounts;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Which count, if any, this item shows. */
  count?: keyof NavCounts;
}

/** Areas a restricted profile can use; the rest redirect it back to the library. */
const RESTRICTED_NAV = new Set(['/games', '/settings']);

const NAV: NavItem[] = [
  { href: '/games', label: 'Library', icon: IconBooks },
  { href: '/loans', label: 'Loans', icon: IconArrowsExchange, count: 'loans' },
  { href: '/plays', label: 'Plays', icon: IconDice5 },
  { href: '/wishlist', label: 'Wishlist', icon: IconHeart, count: 'wishlist' },
  { href: '/import', label: 'Import', icon: IconUpload },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

/** The four destinations that get a phone tab; everything else lives under More. */
const TABS = new Set(['/games', '/loans', '/plays', '/wishlist']);

/** One column shared by the top bar and the page, so the logo sits on the content's left edge. */
const COLUMN = 1240;

export function Shell({ user, counts, children }: Props) {
  const pathname = usePathname();
  const restricted = user.role === 'restricted';
  const items = NAV.filter(({ href }) => !restricted || RESTRICTED_NAV.has(href));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // A restricted profile has so few destinations that every one gets a tab and there is no More.
  const tabItems = restricted ? items : items.filter(({ href }) => TABS.has(href));
  const moreActive =
    !restricted &&
    (pathname.startsWith('/more') || items.some((i) => !TABS.has(i.href) && isActive(i.href)));

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <Container size={COLUMN} h="100%" px="md">
          <Group h="100%" justify="space-between" wrap="nowrap" gap="lg">
            <Group gap="xl" wrap="nowrap" className={classes.headerLeft}>
              <Link href="/games" className={classes.brand}>
                <IconBooks size={28} stroke={1.8} aria-hidden className={classes.brandMark} />
                The Shelf
              </Link>
              <nav aria-label="Main" className={classes.mainNav}>
                {items.map(({ href, label, count }) => (
                  <Link
                    key={href}
                    href={href}
                    className={classes.link}
                    data-active={isActive(href) || undefined}
                    aria-current={isActive(href) ? 'page' : undefined}
                  >
                    {label}
                    {count && counts[count] > 0 && (
                      <span className={classes.count} aria-label={`${counts[count]} waiting`}>
                        {counts[count]}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </Group>
            <Group gap="sm" wrap="nowrap">
              {!restricted && (
                <>
                  <LinkButton
                    href="/games/new"
                    leftSection={<IconPlus size={18} />}
                    visibleFrom="sm"
                  >
                    Add game
                  </LinkButton>
                  <LinkIconButton
                    href="/games/new"
                    aria-label="Add game"
                    variant="filled"
                    color="forest"
                    radius="xl"
                    size="lg"
                    hiddenFrom="sm"
                  >
                    <IconPlus size={20} />
                  </LinkIconButton>
                </>
              )}
              <Group gap="xs" wrap="nowrap" className={classes.who}>
                <Avatar color="forest" radius="xl" size={36} aria-hidden>
                  {user.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Text fw={600} visibleFrom="md">
                  {user.name}
                </Text>
              </Group>
              <form action={logoutAction} className={classes.signOut}>
                <Button
                  type="submit"
                  variant="subtle"
                  color="gray"
                  size="compact-md"
                  leftSection={<IconLogout size={16} />}
                >
                  Sign out
                </Button>
              </form>
            </Group>
          </Group>
        </Container>
      </header>

      <main className={classes.main}>
        <Container size={COLUMN} px="md" py="lg">
          {children}
        </Container>
      </main>

      <nav aria-label="Tabs" className={classes.tabs}>
        {tabItems.map(({ href, label, icon: Glyph, count }) => (
          <Link
            key={href}
            href={href}
            className={classes.tab}
            data-active={isActive(href) || undefined}
            aria-current={isActive(href) ? 'page' : undefined}
          >
            <span className={classes.tabIcon}>
              <Glyph size={22} stroke={1.8} aria-hidden />
              {count && counts[count] > 0 && (
                <span className={classes.tabCount}>{counts[count]}</span>
              )}
            </span>
            {label}
          </Link>
        ))}
        {!restricted && (
          <Link
            href="/more"
            className={classes.tab}
            data-active={moreActive || undefined}
            aria-current={moreActive ? 'page' : undefined}
          >
            <span className={classes.tabIcon}>
              <IconDots size={22} stroke={1.8} aria-hidden />
            </span>
            More
          </Link>
        )}
      </nav>
    </div>
  );
}
