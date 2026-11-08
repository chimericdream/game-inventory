'use client';

import { AppShell, Burger, Button, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDice5, IconLogout, IconSettings, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '../(auth)/actions';

interface Props {
  user: { name: string; role: string };
  children: React.ReactNode;
}

const NAV = [
  { href: '/games', label: 'Games', icon: IconDice5 },
  { href: '/import', label: 'Import', icon: IconUpload },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function Shell({ user, children }: Props) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>Game Library</Text>
          </Group>
          <Group gap="sm">
            <Text size="sm" c="dimmed" visibleFrom="xs">
              {user.name}
              {user.role === 'restricted' ? ' (restricted)' : ''}
            </Text>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="subtle"
                size="compact-sm"
                leftSection={<IconLogout size={16} />}
              >
                Sign out
              </Button>
            </form>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {NAV.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            component={Link}
            href={href}
            label={label}
            leftSection={<Icon size={18} />}
            active={pathname.startsWith(href)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
