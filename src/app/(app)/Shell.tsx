'use client';

import { AppShell, Burger, Button, Container, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDice5, IconLogout } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '../(auth)/actions';
import classes from './Shell.module.css';

interface Props {
  user: { name: string; role: string };
  children: React.ReactNode;
}

/** Areas a restricted profile can use; the rest redirect it back to the games list. */
const RESTRICTED_NAV = new Set(['/games', '/settings']);

const NAV = [
  { href: '/games', label: 'Games' },
  { href: '/plays', label: 'Play log' },
  { href: '/loans', label: 'Loans' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
];

/** One column shared by the top bar and the page, so the logo sits on the content's left edge. */
const COLUMN = 1200;

export function Shell({ user, children }: Props) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  const items = NAV.filter(({ href }) => user.role !== 'restricted' || RESTRICTED_NAV.has(href));
  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { desktop: true, mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className={classes.header}>
        <Container size={COLUMN} h="100%" px="md">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="lg" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Link href="/games" className={classes.brand} onClick={close}>
                <IconDice5 size={20} stroke={1.5} aria-hidden />
                Game Library
              </Link>
              <Group component="nav" aria-label="Main" gap={2} visibleFrom="sm" wrap="nowrap">
                {items.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={classes.link}
                    data-active={pathname.startsWith(href) || undefined}
                    aria-current={pathname.startsWith(href) ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </Group>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed" visibleFrom="md">
                {user.name}
                {user.role === 'restricted' ? ' (restricted)' : ''}
              </Text>
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="subtle"
                  color="gray"
                  size="compact-sm"
                  leftSection={<IconLogout size={16} />}
                >
                  Sign out
                </Button>
              </form>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Navbar p="xs" className={classes.navbar}>
        {items.map(({ href, label }) => (
          <NavLink
            key={href}
            component={Link}
            href={href}
            label={label}
            active={pathname.startsWith(href)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Container size={COLUMN} px="md" py="lg">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
