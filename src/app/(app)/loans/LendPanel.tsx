'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Drawer, Select, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowsExchange } from '@tabler/icons-react';

import { lendAction } from '../tracking-actions';
import classes from './Loans.module.css';

export interface Borrower {
  name: string;
  loans: number;
  returned: number;
  returnedLate: number;
}

interface Props {
  copies: { value: string; label: string }[];
  borrowers: Borrower[];
}

const DUE_CHOICES = [
  { label: 'No due date', days: null },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'A month', days: 30 },
] as const;

const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function historyLine(b: Borrower | undefined) {
  if (!b) return null;
  const games = `${b.loans} ${b.loans === 1 ? 'game' : 'games'}`;
  if (b.returned === 0) return `${b.name} has borrowed ${games} before.`;
  const late =
    b.returnedLate === 0 ? 'returned everything on time' : `returned ${b.returnedLate} late`;
  return `${b.name} has borrowed ${games} before and ${late}.`;
}

function LendForm({ copies, borrowers, onDone }: Props & { onDone?: () => void }) {
  const [borrower, setBorrower] = useState('');
  const [due, setDue] = useState('');
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof lendAction>>, fd: FormData) => {
      const result = await lendAction(prev, fd);
      if (result.ok) {
        setBorrower('');
        setDue('');
        onDone?.();
      }
      return result;
    },
    {},
  );
  const known = borrowers.find((b) => b.name.toLowerCase() === borrower.trim().toLowerCase());

  return (
    <form action={action} className={classes.panel}>
      <h2>Lend a game</h2>
      <p className={classes.hint}>Pick the copy that is leaving the shelf.</p>
      <Stack gap="sm">
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        <Select name="copyId" label="Game" data={copies} searchable required />
        <div>
          <TextInput
            name="borrower"
            label="Borrower"
            required
            value={borrower}
            onChange={(e) => setBorrower(e.currentTarget.value)}
          />
          {borrowers.length > 0 && (
            <div className={classes.chipRow} role="group" aria-label="Previous borrowers">
              {borrowers.slice(0, 8).map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={classes.chip}
                  aria-pressed={known?.name === b.name}
                  onClick={() => setBorrower(b.name)}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
          {historyLine(known) && <p className={classes.history}>{historyLine(known)}</p>}
        </div>
        <div>
          <TextInput
            name="dueOn"
            type="date"
            label="Due (optional)"
            value={due}
            onChange={(e) => setDue(e.currentTarget.value)}
          />
          <div className={classes.chipRow} role="group" aria-label="Quick due dates">
            {DUE_CHOICES.map((c) => {
              const value = c.days === null ? '' : isoIn(c.days);
              return (
                <button
                  key={c.label}
                  type="button"
                  className={classes.chip}
                  aria-pressed={due === value}
                  onClick={() => setDue(value)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button type="submit" loading={pending} mt="xs">
          Lend
        </Button>
      </Stack>
    </form>
  );
}

/** The lend form as a panel beside the list. Hidden on a phone, where the sheet takes over. */
export function LendAside(props: Props) {
  return (
    <div className={classes.desktopLend}>
      <LendForm {...props} />
    </div>
  );
}

/**
 * On a phone a button opens the lend form as a bottom sheet (focus trapped, Escape and a tap
 * outside close it, focus returns to the button).
 */
export function LendSheetButton(props: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <div className={classes.phoneLend}>
      <Button
        variant="default"
        leftSection={<IconArrowsExchange size={18} aria-hidden />}
        onClick={open}
        aria-haspopup="dialog"
      >
        Lend a game
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        size="90%"
        title="Lend a game"
        radius="lg"
      >
        <LendForm {...props} onDone={close} />
      </Drawer>
    </div>
  );
}
