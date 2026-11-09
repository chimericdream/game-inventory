import { ArtCover, type ArtCoverProps } from './CoverArt';
import classes from './DecorativeShelf.module.css';

type Slot = ArtCoverProps | null;

/** Three shelves of made-up covers. A `null` is a gap where a game is out. */
const SHELVES: Slot[][] = [
  [
    { motif: 'hex', bg: '#c7612b', fg: '#f6e3c2' },
    { motif: 'cross', bg: '#1d2d44', fg: '#e8504a' },
    { motif: 'wing', bg: '#2f6f73', fg: '#f3d9a4' },
    { motif: 'rail', bg: '#a63d40', fg: '#f4ead2' },
    { motif: 'tiles', bg: '#5b7f3a', fg: '#e9d8a6' },
    { motif: 'grid', bg: '#2b2b33', fg: '#f2c14e' },
    { motif: 'burst', bg: '#e4572e', fg: '#1c1c1c' },
  ],
  [
    { motif: 'crown', bg: '#6a4c93', fg: '#f1dca7' },
    { motif: 'd20', bg: '#7a1f2b', fg: '#e9c46a' },
    null,
    { motif: 'tri', bg: '#3b6b5e', fg: '#e8e2b0' },
    { motif: 'gem', bg: '#2a2d6e', fg: '#e7c46a' },
    { motif: 'pyr', bg: '#c19a3a', fg: '#2b2418' },
    { motif: 'dots', bg: '#f08a8a', fg: '#4a1d28' },
  ],
  [
    { motif: 'wing', bg: '#b5472b', fg: '#f0dcb0' },
    { motif: 'lake', bg: '#3e8a64', fg: '#e8f0d4' },
    { motif: 'eye', bg: '#143d3a', fg: '#8fc9a9' },
    { motif: 'gear', bg: '#9a8f6a', fg: '#2a2a24' },
    null,
    { motif: 'planet', bg: '#b24a2b', fg: '#f2d0b0' },
    { motif: 'tiles', bg: '#8aa63a', fg: '#2f3a14' },
  ],
];

/**
 * A static wall of shelves for the sign-in and first-run pages. Everything on it is invented
 * artwork with no text, so an unauthenticated visitor learns nothing about this library (not a
 * title, a cover, or even how many games there are).
 */
export function DecorativeShelf() {
  return (
    <div className={classes.wall} aria-hidden>
      {SHELVES.map((shelf, row) => (
        <div key={row} className={classes.shelf} data-row={row}>
          {shelf.map((slot, i) =>
            slot ? (
              <div key={i} className={classes.cover}>
                <ArtCover {...slot} />
              </div>
            ) : (
              <span key={i} className={classes.gap} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
