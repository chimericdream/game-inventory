'use client';

import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function GuestSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const push = useDebouncedCallback((q: string) => {
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
  }, 300);
  return (
    <TextInput
      mb="md"
      maw={320}
      placeholder="Search titles"
      leftSection={<IconSearch size={16} />}
      value={value}
      onChange={(e) => {
        setValue(e.currentTarget.value);
        push(e.currentTarget.value);
      }}
    />
  );
}
