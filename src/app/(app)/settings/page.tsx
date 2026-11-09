import { Badge, Group, Stack, Text, Title } from '@mantine/core';

import { requireContext } from '@/server/auth/current';
import { listShareLinks } from '@/server/data/guest';
import { listLocations, listMembers } from '@/server/data/lookups';

import { AddLocationForm, AddMemberForm } from './SettingsForms';
import { ShareLinks } from './ShareLinks';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { ctx } = await requireContext();
  const [members, locations] = await Promise.all([listMembers(ctx), listLocations(ctx)]);
  const isAdmin = ctx.viewer.role === 'admin';
  const canEdit = ctx.viewer.role !== 'restricted';
  const links = isAdmin ? await listShareLinks(ctx) : [];
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <Stack gap="xl">
      <Title order={1}>Settings</Title>

      <Stack gap="xs">
        <Title order={2} size="h4">
          People
        </Title>
        <Stack gap={4}>
          {members.map((m) => (
            <Group key={m.id} gap="xs">
              <Text>{m.name}</Text>
              <Badge variant="light" color={m.role === 'restricted' ? 'orange' : 'blue'}>
                {m.role}
              </Badge>
            </Group>
          ))}
        </Stack>
        {isAdmin && <AddMemberForm />}
        <Text size="xs" c="dimmed">
          Restricted profiles are read-only and never see games marked hidden for them.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={2} size="h4">
          Locations
        </Title>
        {locations.length === 0 && <Text c="dimmed">None yet.</Text>}
        <Stack gap={4}>
          {locations.map((l) => (
            <Text key={l.id}>
              {l.parentId ? `${locationName.get(l.parentId)} › ${l.name}` : l.name}
            </Text>
          ))}
        </Stack>
        {canEdit && (
          <AddLocationForm parents={locations.map((l) => ({ value: l.id, label: l.name }))} />
        )}
      </Stack>

      {isAdmin && (
        <Stack gap="xs">
          <Title order={2} size="h4">
            Guest links
          </Title>
          <ShareLinks
            links={links.map((l) => ({
              id: l.id,
              label: l.label,
              expiresAt: l.expiresAt?.toISOString() ?? null,
              revokedAt: l.revokedAt?.toISOString() ?? null,
              status: l.revokedAt
                ? ('revoked' as const)
                : l.expiresAt && l.expiresAt < new Date()
                  ? ('expired' as const)
                  : ('active' as const),
              hideTypes: l.hideTypes,
              hideTags: l.hideTags,
              showNotes: l.showNotes,
              showLocations: l.showLocations,
            }))}
          />
        </Stack>
      )}
    </Stack>
  );
}
