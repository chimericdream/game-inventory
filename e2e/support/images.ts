// Tiny generated images so no binary fixtures live in the repo.
import { deflateSync } from 'node:zlib';

/** A valid 1x1 PNG. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

export const png = (name = 'cover.png') => ({
  name,
  mimeType: 'image/png',
  buffer: TINY_PNG,
});

/** Text pretending to be a PNG: the browser-declared type is image/png but the bytes are not. */
export const fakePng = () => ({
  name: 'fake.png',
  mimeType: 'image/png',
  buffer: Buffer.from('this is not an image'),
});

export const textFile = () => ({
  name: 'notes.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('hello'),
});

/** A PNG-typed file over the 8 MB limit. */
export const oversizePng = () => ({
  name: 'huge.png',
  mimeType: 'image/png',
  buffer: Buffer.concat([TINY_PNG, Buffer.alloc(9 * 1024 * 1024)]),
});

// --- realistic covers for the screenshot run ---------------------------------------------------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** A 300x400 box-art stand-in: a gradient whose hue comes from the title, with a frame and a banner. */
export function coverPng(title: string): Buffer {
  const w = 300;
  const h = 400;
  let seed = 0;
  for (const ch of title) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = seed % 360;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      let rgb = hsl((hue + (x + y) / 12) % 360, 0.55, 0.3 + 0.35 * (1 - y / h));
      const inFrame = x > 14 && x < w - 14 && y > 14 && y < h - 14;
      const banner = y > 150 && y < 250 && x > 30 && x < w - 30;
      if (!inFrame) rgb = hsl(hue, 0.4, 0.15);
      else if (banner) rgb = hsl((hue + 40) % 360, 0.6, 0.85);
      else if ((x + y) % 40 < 3) rgb = hsl(hue, 0.5, 0.75);
      raw.set(rgb, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
