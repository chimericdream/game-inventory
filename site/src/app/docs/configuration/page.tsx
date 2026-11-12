import type { Metadata } from 'next';

import classes from '../Docs.module.css';

export const metadata: Metadata = {
  title: 'Configuration',
  description: 'Environment variables for The Shelf, and the optional BoardGameGeek lookup.',
  alternates: { canonical: '/docs/configuration/' },
};

const VARS: [string, string][] = [
  ['DATABASE_URL', 'PostgreSQL connection string. Required.'],
  ['DATA_DIR', 'Where uploaded images are stored. Default ./data (/data in the container).'],
  ['BGG_API_TOKEN', 'BoardGameGeek API token. Enables the title lookup on the add-game form.'],
  ['COOKIE_SECURE', 'Set to true when the app is served over HTTPS.'],
  ['AUTO_MIGRATE', 'Set to false to skip database migrations on start.'],
  [
    'TRASH_RETENTION_DAYS',
    'Days a deleted item stays in the trash before it is removed for good. Default 30. 0 keeps items until an admin deletes them.',
  ],
];

export default function Configuration() {
  return (
    <>
      <h1>Configuration</h1>
      <p className={classes.lede}>
        The Shelf is configured entirely through environment variables, set in your{' '}
        <code>.env</code> file or compose file.
      </p>

      <div className={classes.scroll}>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {VARS.map(([name, text]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Trash</h2>
      <p>
        Deleting a game, copy, play, wishlist item, place or player moves it to the trash. An admin
        can restore it or delete it for good, and anything older than{' '}
        <code>TRASH_RETENTION_DAYS</code> is purged automatically. A game that still has copies
        cannot be deleted.
      </p>

      <h2>BoardGameGeek lookup</h2>
      <p>
        Optional. With <code>BGG_API_TOKEN</code> set, the “Look up” button on the add-game form
        searches the{' '}
        <a href="https://boardgamegeek.com/wiki/page/BGG_XML_API2">BoardGameGeek XML API</a> and can
        prefill the title, a short description, player counts, play time, minimum age, complexity,
        up to six categories and the cover image.
      </p>
      <ul>
        <li>
          Lookups happen only on demand, when a signed-in, non-restricted member searches. There is
          no bulk crawling, background syncing or scheduled polling.
        </li>
        <li>Requests use your own token. Nothing is proxied through a third party.</li>
        <li>
          The cover is downloaded by your server only when you pick a game and save it, then stored
          on your instance. Your browser never loads images from BoardGameGeek.
        </li>
        <li>
          Fetched data stays on your instance for personal use, and guest links expose only the
          games you explicitly allow.
        </li>
      </ul>
      <p>Data and images belong to BoardGameGeek and its contributors. Powered by BoardGameGeek.</p>
    </>
  );
}
