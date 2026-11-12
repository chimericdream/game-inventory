import type { Metadata } from 'next';

import classes from '../Docs.module.css';

export const metadata: Metadata = {
  title: 'Sharing and privacy',
  description: 'Guest links, restricted profiles and what The Shelf never exposes.',
  alternates: { canonical: '/docs/sharing-and-privacy/' },
};

export default function SharingAndPrivacy() {
  return (
    <>
      <h1>Sharing and privacy</h1>
      <p className={classes.lede}>
        Two audiences can see only part of your library: household members on a restricted profile,
        and guests with a share link. Both are enforced on the server.
      </p>

      <h2>Restricted profiles</h2>
      <p>
        A restricted profile, meant for kids, is read-only. It never sees games you mark{' '}
        <strong>hidden</strong>, and it does not see cover images for games marked{' '}
        <strong>hide images</strong>; those show a plain “no picture” tile instead. A hidden game’s
        page looks identical to a page that does not exist, so it never confirms that the game is
        there.
      </p>

      <h2>Guest links</h2>
      <p>
        A guest link (<code>/g/&lt;token&gt;</code>) is a read-only view for friends and relatives,
        with no sign-in.
      </p>
      <ul>
        <li>Links can expire and can be revoked at any time.</li>
        <li>
          Guests see only games marked <strong>Allow on guest links</strong>.
        </li>
        <li>
          Each link can hide whole types or tags, and can opt in to showing notes and locations.
        </li>
        <li>
          Visitors get a game-night picker: how many are playing and how long they have, and the
          answer is the headline.
        </li>
        <li>The full link is shown once, when you create it. Copy it then.</li>
      </ul>

      <h2>What is never exposed to guests</h2>
      <p>
        Ratings, prices, owners and condition are never sent to a guest link. Personal ratings also
        stay out of the activity trail, so nobody can see who rated what.
      </p>

      <h2>Activity trail</h2>
      <p>
        Every change is recorded with who made it, so you can see what happened to a game or a copy.
        Combined with the trash, a mistaken delete is easy to find and undo.
      </p>
    </>
  );
}
