import type { CSSProperties } from 'react';

import classes from './CoverTile.module.css';
import { TYPE_HUES, TYPE_LABELS } from './types';

/** The first character as a whole code point, so an emoji is never cut in half. */
const firstLetter = (title: string) => (Array.from(title.trim())[0] ?? '').toUpperCase();

interface Props {
  title: string;
  type: string;
  /** Where to load the picture from, or null for a game with none. */
  src: string | null;
  /** Anything to lay along the bottom edge of the cover, such as a loan tag. */
  children?: React.ReactNode;
}

/**
 * A game's cover at a fixed 4:5 shape. Without a picture it shows a tinted tile with the game's
 * first letter and kind (the title sits right below the cover, so it is not repeated on the tile),
 * so a missing cover still reads as a game rather than a hole. The tile is legible in both colour
 * schemes because it only mixes the type's hue into the page's own surface colours.
 */
export function CoverTile({ title, type, src, children }: Props) {
  const style = { '--hue': TYPE_HUES[type] ?? TYPE_HUES.other } as CSSProperties;
  return (
    <div className={classes.cover} style={style}>
      {src ? (
        // Covers are served by our own route, so the image optimiser has nothing to add.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className={classes.placeholder}>
          <span className={classes.initial} aria-hidden>
            {firstLetter(title)}
          </span>
          <span className={classes.kind}>{TYPE_LABELS[type] ?? TYPE_LABELS.other}</span>
        </div>
      )}
      {children && <div className={classes.overlay}>{children}</div>}
    </div>
  );
}
