'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Drawer, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDice5, IconRefresh } from '@tabler/icons-react';

import { logPlayAction } from '../tracking-actions';
import classes from './Plays.module.css';

export interface PickerPerson {
  id: string;
  name: string;
  /** Has an account in this household. */
  member: boolean;
}

interface Props {
  games: { value: string; label: string }[];
  people: PickerPerson[];
  /** Who took part in the most recent play, for the shortcut. */
  lastGroup: string[];
  /** Pre-selected game, from "Log a play" beside a game that has not been played in a while. */
  defaultGameId?: string;
}

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function LogForm({
  games,
  people,
  lastGroup,
  defaultGameId,
  onDone,
}: Props & { onDone?: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [extra, setExtra] = useState('');
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof logPlayAction>>, fd: FormData) => {
      const result = await logPlayAction(prev, fd);
      if (result.ok) {
        setSelected([]);
        setExtra('');
        setDate('');
        onDone?.();
      }
      return result;
    },
    {},
  );

  const byId = new Map(people.map((p) => [p.id, p]));
  const groupNames = lastGroup.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // A typed name that matches someone who has played before is offered as a tap instead.
  const typed = extra
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const matches = typed.flatMap((name) => {
    const found = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    return found ? [{ typed: name, person: found }] : [];
  });
  const useExisting = (typedName: string, id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setExtra(typed.filter((n) => n !== typedName).join(', '));
  };

  return (
    <form action={action} className={classes.panel}>
      <h2>Log a play</h2>
      <p className={classes.hint}>Takes about ten seconds.</p>
      <Stack gap="sm">
        {state.error && (
          <Alert color="red" variant="light">
            {state.error}
          </Alert>
        )}
        <Select
          name="gameId"
          label="Game"
          data={games}
          defaultValue={defaultGameId ?? null}
          searchable
          required
        />

        <div>
          <TextInput
            name="playedOn"
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
          <div className={classes.chipRow} role="group" aria-label="Today or yesterday">
            {[
              { label: 'Today', value: '' },
              { label: 'Yesterday', value: isoDay(-1) },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                className={classes.chip}
                aria-pressed={date === c.value}
                onClick={() => setDate(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <fieldset className={classes.who}>
          <legend>Who played</legend>
          {groupNames.length > 0 && (
            <button
              type="button"
              className={classes.sameGroup}
              onClick={() => setSelected(lastGroup.filter((id) => byId.has(id)))}
            >
              <IconRefresh size={16} aria-hidden />
              Same group as last time: {groupNames.join(', ')}
            </button>
          )}
          <div className={classes.chipRow}>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className={classes.chip}
                data-guest={p.member ? undefined : ''}
                aria-pressed={selected.includes(p.id)}
                onClick={() => toggle(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {selected.map((id) => (
            <input key={id} type="hidden" name="playerId" value={id} />
          ))}
          <TextInput
            name="newPlayers"
            label="Add someone"
            description="New names, separated by commas. No account needed."
            value={extra}
            onChange={(e) => setExtra(e.currentTarget.value)}
            mt="sm"
          />
          {matches.map((m) => (
            <p key={m.typed} className={classes.match}>
              Is this {m.person.name} from before?{' '}
              <button type="button" onClick={() => useExisting(m.typed, m.person.id)}>
                Use {m.person.name}
              </button>
            </p>
          ))}
        </fieldset>

        <NumberInput name="durationMinutes" label="Minutes" min={1} hideControls />
        <TextInput name="notes" label="Notes" />
        <Button type="submit" loading={pending} mt="xs">
          Log play
        </Button>
      </Stack>
    </form>
  );
}

/** The log form as a panel beside the list. Hidden on a phone, where the sheet takes over. */
export function LogAside(props: Props) {
  return (
    <div className={classes.desktopLog}>
      <LogForm key={props.defaultGameId ?? ''} {...props} />
    </div>
  );
}

/** On a phone a button opens the log form as a bottom sheet. */
export function LogSheetButton(props: Props) {
  const [opened, { open, close }] = useDisclosure(Boolean(props.defaultGameId));
  return (
    <div className={classes.phoneLog}>
      <Button
        leftSection={<IconDice5 size={18} aria-hidden />}
        onClick={open}
        aria-haspopup="dialog"
      >
        Log a play
      </Button>
      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        size="92%"
        title="Log a play"
        radius="lg"
      >
        <LogForm {...props} onDone={close} />
      </Drawer>
    </div>
  );
}
