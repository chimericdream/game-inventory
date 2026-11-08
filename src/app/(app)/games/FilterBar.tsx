'use client';

import { useEffect, useState } from 'react';
import { Button, Group, NumberInput, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { TYPE_OPTIONS } from './labels';

interface Props {
  tags: string[];
  locations: { value: string; label: string }[];
}

export function FilterBar({ tags, locations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced] = useDebouncedValue(search, 300);

  function update(key: string, value: string | number | null | undefined) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, String(value));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    if (debounced !== (params.get('q') ?? '')) update('q', debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const hasFilters = [...params.keys()].length > 0;

  return (
    <Group mb="md" align="flex-end" gap="sm">
      <TextInput
        placeholder="Search titles"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={220}
      />
      <Select
        placeholder="Any type"
        data={TYPE_OPTIONS}
        value={params.get('type')}
        onChange={(v) => update('type', v)}
        clearable
        w={150}
      />
      <NumberInput
        placeholder="Players"
        min={1}
        value={params.get('players') ?? ''}
        onChange={(v) => update('players', v)}
        w={100}
      />
      <NumberInput
        placeholder="Max minutes"
        min={1}
        step={15}
        value={params.get('maxMinutes') ?? ''}
        onChange={(v) => update('maxMinutes', v)}
        w={130}
      />
      {tags.length > 0 && (
        <Select
          placeholder="Any tag"
          data={tags}
          value={params.get('tag')}
          onChange={(v) => update('tag', v)}
          clearable
          searchable
          w={150}
        />
      )}
      {locations.length > 0 && (
        <Select
          placeholder="Any location"
          data={locations}
          value={params.get('location')}
          onChange={(v) => update('location', v)}
          clearable
          w={160}
        />
      )}
      {hasFilters && (
        <Button
          variant="subtle"
          onClick={() => {
            setSearch('');
            router.replace(pathname);
          }}
        >
          Clear
        </Button>
      )}
    </Group>
  );
}
