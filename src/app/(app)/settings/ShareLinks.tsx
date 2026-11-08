'use client';

import { useActionState, useSyncExternalStore } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CopyButton,
  Group,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';

import { TYPE_OPTIONS } from '../games/labels';
import { createShareLinkAction, revokeShareLinkAction } from './share-actions';

export interface LinkRow {
  id: string;
  label: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  hideTypes: string[];
  hideTags: string[];
  showNotes: boolean;
  showLocations: boolean;
}

export function ShareLinks({ links }: { links: LinkRow[] }) {
  const [state, action, pending] = useActionState(createShareLinkAction, {});
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  );
  const url = state.path ? `${origin}${state.path}` : null;

  return (
    <Stack gap="sm">
      {url && (
        <Alert
          color="green"
          variant="light"
          title="Link created. Copy it now; it can't be shown again."
        >
          <Group gap="xs">
            <Text size="sm" style={{ wordBreak: 'break-all' }}>
              {url}
            </Text>
            <CopyButton value={url}>
              {({ copied, copy }) => (
                <Button size="compact-sm" variant="default" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
      )}

      {links.map((l) => {
        const inactive = l.status !== 'active';
        return (
          <Paper key={l.id} withBorder p="sm" radius="md">
            <Group justify="space-between">
              <div>
                <Group gap="xs">
                  <Text fw={600}>{l.label}</Text>
                  {l.status === 'revoked' ? (
                    <Badge color="red">Revoked</Badge>
                  ) : inactive ? (
                    <Badge color="gray">Expired</Badge>
                  ) : (
                    <Badge color="green">Active</Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {l.expiresAt
                    ? `Expires ${new Date(l.expiresAt).toLocaleDateString()}`
                    : 'No expiry'}
                  {l.hideTypes.length ? ` · hides ${l.hideTypes.join(', ')}` : ''}
                  {l.hideTags.length ? ` · hides tags ${l.hideTags.join(', ')}` : ''}
                  {l.showNotes ? ' · shows notes' : ''}
                  {l.showLocations ? ' · shows locations' : ''}
                </Text>
              </div>
              {!inactive && (
                <form action={revokeShareLinkAction.bind(null, l.id)}>
                  <Button type="submit" color="red" variant="light" size="compact-sm">
                    Revoke
                  </Button>
                </form>
              )}
            </Group>
          </Paper>
        );
      })}

      <form action={action}>
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Text fw={600}>New guest link</Text>
            <Text size="xs" c="dimmed">
              Guests see only games marked &quot;Allow on guest links&quot;. Ratings, prices, owners
              and condition are never shown.
            </Text>
            {state.error && (
              <Alert color="red" variant="light">
                {state.error}
              </Alert>
            )}
            <Group align="flex-end" gap="xs">
              <TextInput name="label" label="Name" placeholder="Game store trip" required />
              <NumberInput
                name="expiresInDays"
                label="Expires after (days)"
                min={1}
                placeholder="Never"
                w={170}
              />
            </Group>
            <Checkbox.Group label="Hide these types">
              <Group gap="sm" mt={4}>
                {TYPE_OPTIONS.map((t) => (
                  <Checkbox key={t.value} name="hideTypes" value={t.value} label={t.label} />
                ))}
              </Group>
            </Checkbox.Group>
            <TextInput
              name="hideTags"
              label="Hide games with these tags"
              description="Comma separated"
            />
            <Group>
              <Switch name="showNotes" label="Show notes" />
              <Switch name="showLocations" label="Show locations" />
            </Group>
            <Group>
              <Button type="submit" loading={pending}>
                Create link
              </Button>
            </Group>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
