'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { Alert, Anchor, Button, FileInput, List, Stack, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

import { importAction } from './actions';

/** The rows that failed, as a CSV file the person can fix and import again. */
function DownloadFailed({ csv }: { csv: string }) {
  // Only rendered after an import has run in the browser, so this never runs on the server.
  const href = useMemo(() => URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), [csv]);
  useEffect(() => () => URL.revokeObjectURL(href), [href]);
  return (
    <Anchor href={href} download="rows-to-fix.csv" size="sm" fw={600}>
      <IconDownload size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
      Download the rows that failed
    </Anchor>
  );
}

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
            {state.failedCsv && (
              <div style={{ marginTop: 8 }}>
                <DownloadFailed csv={state.failedCsv} />
              </div>
            )}
          </div>
        )}
        {state.unusedColumns && state.unusedColumns.length > 0 && (
          <Text size="sm" c="dimmed" data-unused-columns>
            Not used: {state.unusedColumns.join(', ')}. The importer does not know{' '}
            {state.unusedColumns.length === 1 ? 'that column' : 'those columns'}, so the values in{' '}
            {state.unusedColumns.length === 1 ? 'it were' : 'them were'} left out.
          </Text>
        )}
      </Stack>
    </form>
  );
}
