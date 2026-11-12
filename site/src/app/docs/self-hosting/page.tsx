import type { Metadata } from 'next';
import Link from 'next/link';

import { REPO_URL } from '@/lib';

import classes from '../Docs.module.css';

export const metadata: Metadata = {
  title: 'Self-hosting',
  description: 'Install The Shelf with Docker, serve it over HTTPS, update it and back it up.',
  alternates: { canonical: '/docs/self-hosting/' },
};

export default function SelfHosting() {
  return (
    <>
      <h1>Self-hosting</h1>
      <p className={classes.lede}>
        The Shelf is one container plus PostgreSQL. A small VM or LXC with Docker is plenty.
      </p>

      <h2>Quick start</h2>
      <p>
        You need Docker with the Compose plugin. Clone the repository, set a database password and
        start the stack:
      </p>
      <pre>
        <code>{`git clone ${REPO_URL}.git
cd game-inventory
cp .env.example .env         # set POSTGRES_PASSWORD (and BGG_API_TOKEN if you want lookups)
docker compose -f docker-compose.prod.yml up -d --build`}</code>
      </pre>
      <ul>
        <li>
          The app listens on port 3000. Set <code>APP_PORT</code> to change it.
        </li>
        <li>Database migrations run automatically on start.</li>
        <li>
          The first visit asks you to create the household and the admin account. There is no
          default password.
        </li>
        <li>
          Uploaded images live in the <code>app-data</code> volume and the database in{' '}
          <code>db-data</code>.
        </li>
      </ul>

      <h2>HTTPS and Tailscale</h2>
      <p>
        The Shelf is designed to be reachable over a private network. With Tailscale installed on
        the host you can serve it over HTTPS on your tailnet:
      </p>
      <pre>
        <code>tailscale serve --bg 3000</code>
      </pre>
      <p>
        Then set <code>COOKIE_SECURE=true</code> so session cookies are only sent over HTTPS.
      </p>
      <div className={classes.note}>
        <p>
          Leave <code>COOKIE_SECURE</code> at <code>false</code> only while you reach the app over
          plain HTTP, for example on first setup at <code>localhost</code>.
        </p>
      </div>

      <h2>Automatic updates</h2>
      <p>
        Every push to <code>main</code> publishes{' '}
        <code>ghcr.io/chimericdream/game-inventory:latest</code>. The <code>deploy/</code> folder in
        the repository is a ready-made stack for a Docker host: the app, PostgreSQL, a Tailscale
        sidecar that serves HTTPS at <code>https://games.&lt;your-tailnet&gt;.ts.net</code>, and
        Watchtower, which pulls a new app image every five minutes.
      </p>
      <pre>
        <code>{`cd deploy
cp .env.example .env     # set TS_AUTHKEY and POSTGRES_PASSWORD
docker compose up -d`}</code>
      </pre>
      <p>
        Make the GitHub package public after the first publish, or add a registry login for
        Watchtower. PostgreSQL is never updated automatically.
      </p>

      <h2>Backups</h2>
      <p>
        <code>scripts/backup.sh</code> dumps the database and the uploaded images. Run it from cron;
        it keeps the newest 14 backups of each. To restore a database dump:
      </p>
      <pre>
        <code>{`gunzip -c db-<stamp>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U games -d games`}</code>
      </pre>

      <h2>Upgrading by hand</h2>
      <p>
        Pull the latest code and rebuild. Migrations run on start, and they are written to be safe
        for existing data.
      </p>
      <pre>
        <code>{`git pull
docker compose -f docker-compose.prod.yml up -d --build`}</code>
      </pre>

      <h2>Local development</h2>
      <p>
        Want to hack on it? The repository README covers the toolchain (mise, pnpm, Next.js and
        PostgreSQL in Docker). See also <Link href="/docs/configuration/">Configuration</Link>.
      </p>
    </>
  );
}
