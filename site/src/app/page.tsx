import Image from 'next/image';
import Link from 'next/link';
import {
  IconArrowsExchange,
  IconBooks,
  IconDice5,
  IconGift,
  IconHistory,
  IconLink,
  IconLock,
  IconServer,
  IconShieldCheck,
  IconTrash,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react';

import { HeroShelf } from '@/components/HeroShelf';
import { DESCRIPTION, REPO_URL, SITE_URL } from '@/lib';

import classes from './Landing.module.css';

const FEATURES = [
  {
    icon: IconBooks,
    title: 'A shelf, not a spreadsheet',
    text: 'Covers stand on planks. Filter by type, player count, time, location, owner or tag, and ask “do we own…?” in one search box.',
  },
  {
    icon: IconDice5,
    title: 'Copies, not just titles',
    text: 'Two copies of the same game? Each has its own owner, location, condition and price. Digital and console copies track their platform.',
  },
  {
    icon: IconArrowsExchange,
    title: 'Loans without nagging',
    text: 'Lend a copy in a couple of taps, pick the borrower from earlier loans, and see what is late at a glance. Due dates are optional.',
  },
  {
    icon: IconHistory,
    title: 'Plays and ratings',
    text: 'Log who played in ten seconds, friends included. See what gets played most and what has not hit the table in a year.',
  },
  {
    icon: IconGift,
    title: 'Wishlists per person',
    text: 'Everyone keeps their own list, with links and gift hints. Turn an item into a catalog entry when it arrives.',
  },
  {
    icon: IconUpload,
    title: 'Import and lookup',
    text: 'Bring a CSV with you. Add games with an optional BoardGameGeek lookup, or scan a barcode on browsers that support it.',
  },
];

const HOUSEHOLD = [
  {
    icon: IconUsers,
    title: 'Profiles for everyone',
    text: 'Give kids a restricted, read-only profile. Games you mark hidden, and their pictures if you choose, never reach it.',
  },
  {
    icon: IconLink,
    title: 'Guest links',
    text: 'Share a read-only link with friends before game night. It expires, can be revoked, and shows only the games you allow. Visitors get a picker for player count and time.',
  },
  {
    icon: IconLock,
    title: 'Enforced on the server',
    text: 'Hidden means hidden in the response, not just in the interface. Ratings, prices and owners are never sent to guests.',
  },
];

const SELF_HOST = [
  {
    icon: IconServer,
    text: 'Runs in Docker with PostgreSQL. A small VM or home server is plenty.',
  },
  {
    icon: IconShieldCheck,
    text: 'Your data stays on your server. Fonts and assets are self-hosted, and lookups only happen when you ask for one.',
  },
  {
    icon: IconHistory,
    text: 'An activity trail shows who changed what, so mistakes are easy to trace.',
  },
  {
    icon: IconTrash,
    text: 'Deletes go to a trash first and can be restored for 30 days by default.',
  },
];

const QUICKSTART = `git clone ${REPO_URL}.git
cd game-inventory
cp .env.example .env        # set POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'The Shelf',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any (self-hosted, Docker)',
  description: DESCRIPTION,
  url: SITE_URL,
  license: 'https://opensource.org/license/mit',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={classes.hero}>
        <div className={classes.wrap}>
          <p className={classes.eyebrow}>Self-hosted · Open source · Made for families</p>
          <h1>Every game you own, on one shelf.</h1>
          <p className={classes.lede}>
            The Shelf is a home for your family’s board games, card games, RPG books and console
            games. Answer “do we own it?”, track who borrowed what, and log what you played, on a
            server you run yourself.
          </p>
          <div className={classes.actions}>
            <Link href="/docs/self-hosting/" className="btn">
              Self-host it
            </Link>
            <a href={REPO_URL} className="btn ghost">
              View on GitHub
            </a>
          </div>
          <div className={classes.heroShelf}>
            <HeroShelf />
          </div>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="features">
        <div className={classes.wrap}>
          <h2 id="features">Everything a game shelf needs to know</h2>
          <p className={classes.sectionLede}>
            Small enough to run on a spare box, complete enough to replace the spreadsheet, the
            sticky notes and the “who has my copy?” text thread.
          </p>
          <ul className={classes.grid}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className={classes.card}>
                <Icon size={28} stroke={1.6} aria-hidden />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="look">
        <div className={classes.wrap}>
          <h2 id="look">Warm, calm and easy to read</h2>
          <p className={classes.sectionLede}>
            Colour stays quiet so the covers carry it. Light and dark follow your device, and on
            phones the app becomes a bottom tab bar with sheets for lending and logging.
          </p>
          <figure className={classes.shot}>
            <Image
              src="/library.png"
              width={1440}
              height={900}
              alt="The library page: a sidebar of filters beside a grid of game covers standing on wooden planks, with three games tagged as out on loan."
              sizes="(max-width: 1160px) 100vw, 1120px"
            />
            <figcaption>The library, with demo data.</figcaption>
          </figure>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="household">
        <div className={classes.wrap}>
          <h2 id="household">Share the shelf, keep the private bits private</h2>
          <ul className={classes.grid3}>
            {HOUSEHOLD.map(({ icon: Icon, title, text }) => (
              <li key={title} className={classes.card}>
                <Icon size={28} stroke={1.6} aria-hidden />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${classes.section} ${classes.band}`} aria-labelledby="own">
        <div className={classes.wrap}>
          <h2 id="own">Your server, your library</h2>
          <ul className={classes.list}>
            {SELF_HOST.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={24} stroke={1.6} aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className={classes.sectionLede}>
            It is built to sit behind Tailscale on a Proxmox host, and works anywhere Docker does.
          </p>
        </div>
      </section>

      <section className={classes.section} aria-labelledby="start">
        <div className={classes.wrap}>
          <h2 id="start">Up and running in a few minutes</h2>
          <pre className={classes.code}>
            <code>{QUICKSTART}</code>
          </pre>
          <p className={classes.sectionLede}>
            Then open <code>http://localhost:3000</code> and create your household. The{' '}
            <Link href="/docs/self-hosting/">self-hosting guide</Link> covers HTTPS, automatic
            updates and backups.
          </p>
          <div className={classes.actions}>
            <Link href="/docs/" className="btn">
              Read the docs
            </Link>
            <a href={REPO_URL} className="btn ghost">
              Star it on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
