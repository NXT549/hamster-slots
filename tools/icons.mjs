// icons.mjs — makes the game's icons from the hamster sprite in src/view/art.ts:
// the browser-tab icon (favicon), the phone home-screen icons and the app
// icons in the web manifest. They go in public/icons/ (Vite copies public/ into
// the build as it is).
//
// Run it again after the hamster sprite changes:
//     node tools/icons.mjs
//
// It writes the PNG files itself (Node's built-in zlib does the compression),
// so it needs no extra packages. Every pixel of the sprite becomes a whole
// square of pixels, so the icons stay crisp pixel art.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { SPRITES, PALETTE } from '../src/view/art.ts';

const OUT = new URL('../public/icons/', import.meta.url);
const BACKGROUND = '#fdf5ec'; // the cage wall (style.css --wall-top), behind the home-screen icons

// The hamster without its empty rows and columns.
function cropped(rows) {
  const filled = (ch) => !!PALETTE[ch];
  const ys = rows.map((row, y) => ([...row].some(filled) ? y : -1)).filter((y) => y >= 0);
  const xs = [...rows[0]].map((_, x) => (rows.some((row) => filled(row[x])) ? x : -1)).filter((x) => x >= 0);
  return rows.slice(ys[0], ys.at(-1) + 1).map((row) => row.slice(xs[0], xs.at(-1) + 1));
}

const hex = (colour) => [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));

// An RGBA picture `size` pixels square: the sprite at `scale`, centred, on `background` (or clear).
function paint(rows, size, scale, background = null) {
  const px = new Uint8Array(size * size * 4);
  if (background) {
    const [r, g, b] = hex(background);
    for (let i = 0; i < size * size; i++) px.set([r, g, b, 255], i * 4);
  }
  const w = rows[0].length * scale;
  const h = rows.length * scale;
  const left = Math.floor((size - w) / 2);
  const top = Math.floor((size - h) / 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!PALETTE[ch]) return;
    const [r, g, b] = hex(PALETTE[ch]);
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) px.set([r, g, b, 255], ((top + y * scale + dy) * size + left + x * scale + dx) * 4);
    }
  }));
  return px;
}

// ── A tiny PNG writer: the file signature, then IHDR (size), IDAT (pixels), IEND ──
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(px, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits per channel, RGBA, no interlace
  const raw = Buffer.alloc(size * (size * 4 + 1)); // each row starts with filter type 0 (none)
  for (let y = 0; y < size; y++) raw.set(px.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hamster = cropped(SPRITES.hamster);
// [file, size, scale, background]. The app icons keep the hamster inside the
// middle 80% ("maskable": phones may cut the corners off into a circle).
const ICONS = [
  ['icon-32.png', 32, 1, null], // the browser tab
  ['icon-64.png', 64, 2, null], // the browser tab on a sharp screen
  ['icon-180.png', 180, 7, BACKGROUND], // iPhone / iPad home screen
  ['icon-192.png', 192, 6, BACKGROUND], // Android home screen (web manifest)
  ['icon-512.png', 512, 18, BACKGROUND], // app stores, install screens (web manifest)
];
mkdirSync(OUT, { recursive: true });
for (const [file, size, scale, background] of ICONS) {
  writeFileSync(new URL(file, OUT), png(paint(hamster, size, scale, background), size));
  console.log(`public/icons/${file}: ${size}×${size}, the hamster at ${scale}×`);
}
