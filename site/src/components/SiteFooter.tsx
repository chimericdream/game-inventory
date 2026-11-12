import Link from 'next/link';

import { REPO_URL, SITE_NAME } from '@/lib';

import classes from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={classes.footer}>
      <div className={classes.plank} aria-hidden />
      <div className={classes.inner}>
        <div>
          <p className={classes.name}>{SITE_NAME}</p>
          <p className={classes.muted}>
            Free and open source under the MIT license. Self-hosted, with no account to create
            elsewhere and no tracking.
          </p>
        </div>
        <nav aria-label="Footer" className={classes.links}>
          <Link href="/docs/">Docs</Link>
          <Link href="/docs/self-hosting/">Self-hosting</Link>
          <Link href="/docs/configuration/">Configuration</Link>
          <Link href="/docs/faq/">FAQ</Link>
          <a href={REPO_URL}>Source on GitHub</a>
          <a href={`${REPO_URL}/issues`}>Report an issue</a>
        </nav>
      </div>
      <p className={classes.credit}>
        Game details in the app can come from BoardGameGeek, whose data and images belong to
        BoardGameGeek and its contributors. Powered by BoardGameGeek.
      </p>
    </footer>
  );
}
