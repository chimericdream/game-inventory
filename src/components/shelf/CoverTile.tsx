'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import classes from './CoverTile.module.css';
import { TYPE_HUES, TYPE_LABELS } from './types';

/** The first character as a whole code point, so an emoji is never cut in half. */
const firstLetter = (title: string) => (Array.from(title.trim())[0] ?? '').toUpperCase();

/** The cover tile's own shape, width over height. Pictures of any other shape are never cropped. */
const TILE_RATIO = 4 / 5;

/** Width over height of a loaded picture, or null if it has not loaded (or failed to). */
const ratioOf = (el: HTMLImageElement) =>
  el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : null;

interface Props {
  title: string;
  type: string;
  /** Where to load the picture from, or null for a game with none. */
  src: string | null;
  /**
   * What a picture that is not exactly 4:5 does. `fill` (for grids and lists) keeps the 4:5 tile
   * and shows the whole picture over a blurred copy of itself, which shows at the sides of a tall
   * picture and above and below a wide one; `flat` (for a game's own page) lets the cover take the
   * picture's own shape.
   */
  fit?: 'fill' | 'flat';
  /** Anything to lay along the bottom edge of the cover, such as a loan tag. */
  children?: React.ReactNode;
}

/**
 * A game's cover, 4:5 with the whole picture always visible (see `fit`). Without a picture it shows
 * a tinted tile with the game's first letter and kind (the title sits right below the cover, so it
 * is not repeated on the tile), so a missing cover still reads as a game rather than a hole. The
 * tile is legible in both colour schemes because it only mixes the type's hue into the page's own
 * surface colours.
 */
export function CoverTile({ title, type, src, fit = 'fill', children }: Props) {
  const img = useRef<HTMLImageElement>(null);
  // Width over height, known once the picture has loaded. Until then the cover is a plain 4:5 tile.
  const [ratio, setRatio] = useState<number | null>(null);
  // A cached picture can finish loading before hydration attaches onLoad, so check once mounted.
  // A later change of picture fires onLoad again, cached or not.
  useEffect(() => {
    if (img.current?.complete) setRatio(ratioOf(img.current));
  }, []);

  const offShape = src !== null && ratio !== null && ratio !== TILE_RATIO;
  const style = {
    '--hue': TYPE_HUES[type] ?? TYPE_HUES.other,
    ...(offShape && { '--ratio': ratio }),
  } as CSSProperties;
  return (
    <div className={classes.cover} style={style} data-fit={offShape ? fit : undefined}>
      {src ? (
        <>
          {/* Covers are served by our own route, so the image optimiser has nothing to add. */}
          {offShape && fit === 'fill' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={classes.backdrop} src={src} alt="" aria-hidden />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={img}
            className={classes.picture}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => setRatio(ratioOf(e.currentTarget))}
          />
        </>
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
