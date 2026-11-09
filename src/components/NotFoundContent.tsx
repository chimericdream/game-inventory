import { IconBooks } from '@tabler/icons-react';
import Link from 'next/link';

import classes from './NotFoundContent.module.css';

/**
 * The one page for every dead end: an unknown address, a game hidden from this profile, and a
 * guest link that is unknown, expired or revoked. They all look and read the same, so nothing here
 * can confirm that a hidden game or a dead link ever existed.
 *
 * `inShell` is for pages that already sit inside the app's own `<main>`.
 */
export function NotFoundContent({ inShell = false }: { inShell?: boolean }) {
  const Wrapper = inShell ? 'section' : 'main';
  return (
    <Wrapper className={`${classes.page} ${inShell ? classes.inShell : ''}`}>
      <div className={classes.shelf} aria-hidden>
        <span className={classes.book} style={{ background: '#c7612b' }} />
        <span className={classes.book} style={{ background: '#2f6f73', height: 96 }} />
        <span className={classes.gap} />
        <span className={classes.book} style={{ background: '#6a4c93', height: 112 }} />
        <span className={classes.book} style={{ background: '#a63d40', height: 92 }} />
      </div>
      <h1>That’s not on the shelf.</h1>
      <p>The page you asked for isn’t here. It may have moved, or you may not have access to it.</p>
      <Link href="/" className={classes.link}>
        <IconBooks size={18} aria-hidden /> Back to the library
      </Link>
    </Wrapper>
  );
}
