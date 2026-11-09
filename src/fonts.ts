import localFont from 'next/font/local';

/*
 * Both families are self-hosted (OFL licensed, see the licence files beside the font files), so
 * the app makes no request to a font service. Titles use Fraunces; everything else uses Figtree.
 */

export const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-latin-wght-normal.woff2', style: 'normal' },
    { path: './fonts/fraunces-latin-wght-italic.woff2', style: 'italic' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
  weight: '100 900',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const figtree = localFont({
  src: [
    { path: './fonts/figtree-latin-wght-normal.woff2', style: 'normal' },
    { path: './fonts/figtree-latin-wght-italic.woff2', style: 'italic' },
  ],
  variable: '--font-figtree',
  display: 'swap',
  weight: '300 900',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});
