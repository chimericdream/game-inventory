// Tiny generated images so no binary fixtures live in the repo.

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
