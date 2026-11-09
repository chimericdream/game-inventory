import type { ReactNode } from 'react';

/*
 * Abstract, nameless cover art for the decorative shelf on the sign-in pages. It is drawn from
 * scratch and shows nothing about any real game or about this library: no titles, no real covers.
 */

const hexPoints = (x: number, y: number, r: number) =>
  [0, 1, 2, 3, 4, 5]
    .map((i) =>
      [
        x + r * Math.cos((Math.PI / 3) * i + Math.PI / 6),
        y + r * Math.sin((Math.PI / 3) * i + Math.PI / 6),
      ]
        .map((n) => n.toFixed(1))
        .join(','),
    )
    .join(' ');

export type Motif =
  | 'hex'
  | 'cross'
  | 'wing'
  | 'rail'
  | 'tiles'
  | 'grid'
  | 'burst'
  | 'crown'
  | 'd20'
  | 'eye'
  | 'tri'
  | 'lake'
  | 'gem'
  | 'pyr'
  | 'dots'
  | 'gear'
  | 'planet';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const MOTIFS: Record<Motif, (f: string, bg: string) => ReactNode> = {
  hex: (f) =>
    range(16).map((k) => {
      const r = Math.floor(k / 4);
      const c = k % 4;
      const on = (r + c) % 3 === 0;
      return (
        <polygon
          key={k}
          points={hexPoints(18 + c * 22 + (r % 2 ? 11 : 0), 26 + r * 19, 11)}
          fill={on ? f : 'none'}
          stroke={f}
          strokeWidth={1.6}
          opacity={on ? 0.9 : 0.55}
        />
      );
    }),
  cross: (f) => (
    <>
      <circle cx={50} cy={52} r={30} fill="none" stroke={f} strokeWidth={2} />
      <path d="M42 30h16v16h16v16H58v16H42V62H26V46h16z" fill={f} />
    </>
  ),
  wing: (f) =>
    range(5).map((i) => (
      <path
        key={i}
        d={`M${14 + i * 4} ${74 - i * 9}Q50 ${20 - i * 2} ${90 - i * 4} ${72 - i * 9}`}
        fill="none"
        stroke={f}
        strokeWidth={3.4 - i * 0.4}
        strokeLinecap="round"
        opacity={1 - i * 0.15}
      />
    )),
  rail: (f) => (
    <>
      <path d="M-5 95Q30 80 40 56T105 20" fill="none" stroke={f} strokeWidth={3} />
      <path d="M-5 105Q30 90 40 66T105 30" fill="none" stroke={f} strokeWidth={3} />
      {[
        [18, 80],
        [40, 56],
        [66, 38],
        [88, 26],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={5} fill={f} />
      ))}
    </>
  ),
  tiles: (f) =>
    [0.95, 0.5, 0.75, 0.35, 0.85, 0.6, 0.4, 0.9, 0.55].map((o, i) => (
      <rect
        key={i}
        x={16 + (i % 3) * 24}
        y={22 + Math.floor(i / 3) * 24}
        width={22}
        height={22}
        fill={f}
        opacity={o}
      />
    )),
  grid: (f) =>
    range(16).map((k) => (
      <rect
        key={k}
        x={18 + (k % 4) * 18}
        y={24 + Math.floor(k / 4) * 14}
        width={16}
        height={11}
        rx={1}
        fill={k % 5 === 1 ? f : 'none'}
        stroke={f}
        strokeWidth={1.4}
      />
    )),
  burst: (f) => (
    <polygon
      points={range(16)
        .map((i) => {
          const a = (Math.PI / 8) * i;
          const r = i % 2 ? 18 : 38;
          return `${(50 + r * Math.cos(a)).toFixed(1)},${(54 + r * Math.sin(a)).toFixed(1)}`;
        })
        .join(' ')}
      fill={f}
    />
  ),
  crown: (f) => (
    <>
      <path d="M20 78L24 38l16 18 10-22 10 22 16-18 4 40z" fill={f} />
      <rect x={20} y={82} width={60} height={7} fill={f} />
    </>
  ),
  d20: (f) => (
    <>
      <polygon
        points="50,18 80,36 80,68 50,86 20,68 20,36"
        fill="none"
        stroke={f}
        strokeWidth={2.6}
      />
      <polygon points="50,28 70,62 30,62" fill={f} opacity={0.9} />
      <path d="M50 18v10M80 36L70 62M20 36l10 26M50 86V62" stroke={f} strokeWidth={1.6} />
    </>
  ),
  eye: (f, bg) => (
    <>
      <path d="M12 54Q50 14 88 54Q50 94 12 54z" fill="none" stroke={f} strokeWidth={2.6} />
      <circle cx={50} cy={54} r={15} fill={f} />
      <circle cx={50} cy={54} r={6} fill={bg} />
    </>
  ),
  tri: (f) => (
    <>
      <polygon points="50,22 66,50 34,50" fill={f} />
      <polygon points="34,54 50,82 18,82" fill={f} opacity={0.8} />
      <polygon points="66,54 82,82 50,82" fill={f} opacity={0.8} />
    </>
  ),
  lake: (f) => (
    <>
      <polygon points="-5,70 25,34 45,58 62,28 105,72" fill={f} opacity={0.9} />
      <rect x={-5} y={70} width={110} height={40} fill={f} opacity={0.35} />
      <circle cx={78} cy={20} r={8} fill={f} />
    </>
  ),
  gem: (f, bg) => (
    <>
      <polygon points="50,24 78,44 50,84 22,44" fill={f} opacity={0.95} />
      <path d="M22 44h56M50 24L38 44l12 40 12-40z" stroke={bg} strokeWidth={1.6} fill="none" />
    </>
  ),
  pyr: (f) =>
    range(4).map((i) => (
      <rect
        key={i}
        x={20 + i * 8}
        y={75 - i * 13}
        width={60 - i * 16}
        height={11}
        fill={f}
        opacity={1 - i * 0.12}
      />
    )),
  dots: (f) =>
    range(9).map((i) => (
      <circle
        key={i}
        cx={24 + (i % 3) * 26}
        cy={30 + Math.floor(i / 3) * 24}
        r={i % 2 ? 9 : 11}
        fill={f}
        opacity={i % 2 ? 0.55 : 0.95}
      />
    )),
  gear: (f) => (
    <>
      {range(10).map((i) => (
        <rect
          key={i}
          x={46}
          y={14}
          width={8}
          height={14}
          fill={f}
          transform={`rotate(${i * 36} 50 54)`}
        />
      ))}
      <circle cx={50} cy={54} r={26} fill="none" stroke={f} strokeWidth={7} />
      <circle cx={50} cy={54} r={7} fill={f} />
    </>
  ),
  planet: (f, bg) => (
    <>
      <circle cx={50} cy={52} r={28} fill={f} />
      <path d="M26 60q24 14 50-6" stroke={bg} strokeWidth={3} fill="none" />
      <ellipse
        cx={50}
        cy={52}
        rx={44}
        ry={10}
        fill="none"
        stroke={f}
        strokeWidth={2}
        transform="rotate(-18 50 52)"
      />
    </>
  ),
};

export interface ArtCoverProps {
  motif: Motif;
  bg: string;
  fg: string;
}

/** A flat 4:5 cover drawn only from shapes. Purely decorative, so it is hidden from assistive tech. */
export function ArtCover({ motif, bg, fg }: ArtCoverProps) {
  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
      style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', borderRadius: 3 }}
    >
      <rect width={100} height={125} fill={bg} />
      {MOTIFS[motif](fg, bg)}
    </svg>
  );
}
