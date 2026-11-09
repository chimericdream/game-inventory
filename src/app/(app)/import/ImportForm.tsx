'use client';

import { useActionState } from 'react';
import { Alert, Button, FileInput, List, Stack, Text } from '@mantine/core';

import { importAction } from './actions';

export function ImportForm() {
  const [state, action, pending] = useActionState(importAction, {});
  return (
    <form action={action}>
      <Stack>
        <FileInput name="file" label="CSV file" accept=".csv,text/csv" required />
        <Button type="submit" loading={pending} w="fit-content">
          Import
        </Button>
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        {state.created !== undefined && (
          <Alert color="green" variant="light">
            Imported {state.created} game{state.created === 1 ? '' : 's'}
            {state.skipped?.length
              ? `, skipped ${state.skipped.length} already in the library`
              : ''}
            .
          </Alert>
        )}
        {state.rowErrors && state.rowErrors.length > 0 && (
          <div>
            <Text fw={600} size="sm">
              Rows that were skipped
            </Text>
            <List size="sm">
              {state.rowErrors.slice(0, 20).map((e) => (
                <List.Item key={e.line}>
                  Line {e.line}: {e.message}
                </List.Item>
              ))}
            </List>
          </div>
        )}
      </Stack>
    </form>
  );
}
