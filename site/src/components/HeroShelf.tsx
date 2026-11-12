import { CoverTile } from '@app/components/shelf/CoverTile';
import shelf from '@app/components/shelf/Shelf.module.css';

interface Demo {
  title: string;
  type: string;
  sub: string;
  loan?: { who: string; line: string };
}

/** Invented titles, so no real publisher's name or art sits on the marketing page. */
const GAMES: Demo[] = [
  { title: 'Lanternfall', type: 'board', sub: '2–4p · 45 min' },
  { title: 'Orchard Kings', type: 'card', sub: '2–5p · 20 min' },
  { title: 'The Hollow Crown', type: 'rpg', sub: 'RPG · Rulebook' },
  {
    title: 'Quiet Thieves',
    type: 'board',
    sub: '3–5p · 60 min',
    loan: { who: 'Jonas', line: 'Due Sunday' },
  },
  { title: 'Tidepool Run', type: 'video', sub: 'Switch · 1–2p' },
  { title: 'Thousand Doors', type: 'puzzle', sub: 'Puzzle · 1–4p' },
];

/** The same cover tile and plank the app draws, filled with a made-up library. */
export function HeroShelf() {
  return (
    <ul className={shelf.shelf} aria-label="An example shelf of games">
      {GAMES.map((g) => (
        <li key={g.title}>
          <div className={shelf.tile}>
            <div className={shelf.stand}>
              <CoverTile title={g.title} type={g.type} src={null}>
                {g.loan && (
                  <span className={shelf.loan}>
                    Out with {g.loan.who}
                    <small>{g.loan.line}</small>
                  </span>
                )}
              </CoverTile>
            </div>
            <span className={shelf.meta}>
              <span className={shelf.title}>{g.title}</span>
              <span className={shelf.sub}>{g.sub}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
