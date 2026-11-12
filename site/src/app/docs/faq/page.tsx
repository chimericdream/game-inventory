import type { Metadata } from 'next';
import Link from 'next/link';

import { REPO_URL } from '@/lib';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Quick answers about The Shelf.',
  alternates: { canonical: '/docs/faq/' },
};

export default function Faq() {
  return (
    <>
      <h1>FAQ</h1>

      <h2>Is there a hosted version?</h2>
      <p>
        No. The Shelf is self-hosted only, so your library lives on your own server. There is no
        sign-up and no subscription.
      </p>

      <h2>What does it cost?</h2>
      <p>Nothing. It is open source under the MIT license. You pay only for wherever you run it.</p>

      <h2>What kinds of games can I track?</h2>
      <p>
        Board games, card games, RPG books, console and PC video games, and puzzles. Fields change
        by type: players, play time and complexity for tabletop games, system and book kind for RPG
        books, platform for video games.
      </p>

      <h2>Does it sync with Steam or consoles?</h2>
      <p>
        Not at the moment. You can add games by hand, import a CSV, or use the optional
        BoardGameGeek lookup.
      </p>

      <h2>Do my friends need accounts?</h2>
      <p>
        No. Plays record players by display name, so a visiting friend needs no account. Guests can
        browse through a <Link href="/docs/sharing-and-privacy/">guest link</Link>.
      </p>

      <h2>Does it work on a phone?</h2>
      <p>
        Yes. The layouts are phone-first, with a bottom tab bar and sheets for lending and logging.
        Barcode scanning works in browsers that support the BarcodeDetector API.
      </p>

      <h2>Can several households share one install?</h2>
      <p>
        The app is built so that a household is the boundary for all data, but it runs in
        single-household mode, and that concept stays out of your way.
      </p>

      <h2>Where do I report a bug or ask for a feature?</h2>
      <p>
        On <a href={`${REPO_URL}/issues`}>GitHub</a>.
      </p>
    </>
  );
}
