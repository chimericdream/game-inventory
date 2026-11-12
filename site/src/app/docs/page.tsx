import type { Metadata } from 'next';
import Link from 'next/link';

import { REPO_URL } from '@/lib';

import classes from './Docs.module.css';

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Documentation for The Shelf, a self-hosted game library for families.',
  alternates: { canonical: '/docs/' },
};

export default function DocsHome() {
  return (
    <>
      <h1>Documentation</h1>
      <p className={classes.lede}>
        Everything you need to run The Shelf at home and share it with the people you play with.
      </p>

      <h2>What it is</h2>
      <p>
        The Shelf is a web app for a household’s game collection: board games, card games, RPG books
        and console or PC games. It runs on your own server and stores everything in your own
        PostgreSQL database.
      </p>
      <ul>
        <li>
          A <strong>game</strong> is the title. A <strong>copy</strong> is a physical or digital
          instance someone owns, with its own owner, location, condition and platform.
        </li>
        <li>
          <strong>Plays</strong> record who sat at the table. Players do not need an account, so a
          visiting friend can be logged by name and linked to an account later.
        </li>
        <li>
          <strong>Loans</strong> track which copy is out and with whom. Due dates are optional.
        </li>
        <li>
          <strong>Guest links</strong> and <strong>restricted profiles</strong> control who sees
          what.
        </li>
      </ul>

      <h2>Where to start</h2>
      <ul>
        <li>
          <Link href="/docs/self-hosting/">Self-hosting</Link>: install it with Docker, enable
          HTTPS, update it and back it up.
        </li>
        <li>
          <Link href="/docs/configuration/">Configuration</Link>: every environment variable, and
          the optional BoardGameGeek lookup.
        </li>
        <li>
          <Link href="/docs/sharing-and-privacy/">Sharing and privacy</Link>: guest links, kid
          profiles and what is never exposed.
        </li>
        <li>
          <Link href="/docs/faq/">FAQ</Link>: quick answers.
        </li>
      </ul>

      <p>
        The project is open source. Architecture notes and contribution conventions live in the{' '}
        <a href={REPO_URL}>repository</a>.
      </p>
    </>
  );
}
