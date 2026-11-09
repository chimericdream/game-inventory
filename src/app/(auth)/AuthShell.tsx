import { IconBooks } from '@tabler/icons-react';

import { DecorativeShelf } from '@/components/art/DecorativeShelf';

import classes from './AuthShell.module.css';

interface Props {
  title: string;
  lead: string;
  /** The form. */
  children: React.ReactNode;
  /** A line under the form. */
  footnote?: string;
}

/**
 * The front door: a wall of made-up shelves beside one short form. It is shown to anyone who can
 * reach the app, so it carries no information about this library (no titles, covers or names).
 */
export function AuthShell({ title, lead, children, footnote }: Props) {
  return (
    <div className={classes.door}>
      <aside className={classes.wall}>
        <DecorativeShelf />
      </aside>
      <main className={classes.form}>
        <div className={classes.brand}>
          <IconBooks size={34} stroke={1.8} aria-hidden />
          Game Library
        </div>
        <h1>{title}</h1>
        <p className={classes.lead}>{lead}</p>
        <div className={classes.body}>{children}</div>
        {footnote && <p className={classes.foot}>{footnote}</p>}
      </main>
    </div>
  );
}
