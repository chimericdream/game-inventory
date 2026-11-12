import Link from 'next/link';
import { IconBrandGithub } from '@tabler/icons-react';

import { REPO_URL, SITE_NAME } from '@/lib';

import classes from './SiteHeader.module.css';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Link href="/" className={classes.brand}>
          <span className={classes.mark} aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {SITE_NAME}
        </Link>
        <nav className={classes.nav} aria-label="Main">
          <Link href="/docs/">Docs</Link>
          <Link href="/docs/self-hosting/" className={classes.hideSmall}>
            Self-hosting
          </Link>
          <a href={REPO_URL} className={classes.github}>
            <IconBrandGithub size={20} aria-hidden />
            <span>GitHub</span>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
