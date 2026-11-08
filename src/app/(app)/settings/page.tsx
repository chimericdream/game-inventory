import { Badge, Group, List, Stack, Text, Title } from '@mantine/core';

import { requireContext } from '@/server/auth/current';
import { listLocations, listMembers } from '@/server/data/lookups';

import { AddLocationForm, AddMemberForm } from './SettingsForms';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { ctx } = await requireContext();
  const [members, locations] = await Promise.all([listMembers(ctx), listLocations(ctx)]);
  const isAdmin = ctx.viewer.role === 'admin';
  const canEdit = ctx.viewer.role !== 'restricted';
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <Stack gap="xl">
      <Title order={2}>Settings</Title>

      <Stack gap="xs">
        <Title order={4}>People</Title>
        <List spacing={4} listStyleType="none">
          {members.map((m) => (
            <List.Item key={m.id}>
              <Group gap="xs">
                <Text>{m.name}</Text>
                <Badge variant="light" color={m.role === 'restricted' ? 'orange' : 'blue'}>
                  {m.role}
                </Badge>
              </Group>
            </List.Item>
          ))}
        </List>
        {isAdmin && <AddMemberForm />}
        <Text size="xs" c="dimmed">
          Restricted profiles are read-only and never see games marked hidden for them.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Locations</Title>
        {locations.length === 0 && <Text c="dimmed">None yet.</Text>}
        <List spacing={4}>
          {locations.map((l) => (
            <List.Item key={l.id}>
              {l.parentId ? `${locationName.get(l.parentId)} › ${l.name}` : l.name}
            </List.Item>
          ))}
        </List>
        {canEdit && (
          <AddLocationForm parents={locations.map((l) => ({ value: l.id, label: l.name }))} />
        )}
      </Stack>
    </Stack>
  );
}
