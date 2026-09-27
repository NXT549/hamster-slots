// release.test.js — the files a public release needs (1.0): the icons, the web
// app manifest, the links in index.html, the social picture and the version.
// A missing icon only shows up as a 404 in the browser, so it's checked here.

import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const exists = (path) => existsSync(new URL(path, root));

// A PNG's width and height (from its IHDR chunk, right after the 8-byte signature).
function pngSize(path) {
  const bytes = read(path);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('package.json has a semantic version', () => {
  const { version } = JSON.parse(read('package.json'));
  expect(version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  // The lockfile's copy of it matches (npm ci in the deploy workflow reads both).
  const lock = JSON.parse(read('package-lock.json'));
  expect(lock.version).toBe(version);
  expect(lock.packages[''].version).toBe(version);
});

test('the web app manifest lists icons that exist, at their real sizes', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  expect(manifest.name).toBe('Hamster Slots');
  expect(manifest.icons.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    const path = `public/${icon.src}`;
    expect(exists(path), path).toBe(true);
    const { width, height } = pngSize(path);
    expect(`${width}x${height}`).toBe(icon.sizes);
  }
});

test('index.html links the icons, the manifest and the social picture, and they exist', () => {
  const html = read('index.html').toString();
  const links = [...html.matchAll(/<link[^>]+href="\/([^"]+)"/g)].map((m) => m[1]);
  for (const icon of ['icons/icon-32.png', 'icons/icon-64.png', 'icons/icon-180.png', 'manifest.webmanifest']) {
    expect(links).toContain(icon);
    expect(exists(`public/${icon}`), icon).toBe(true);
  }
  for (const [file, size] of [['icons/icon-32.png', 32], ['icons/icon-64.png', 64], ['icons/icon-180.png', 180]]) {
    expect(pngSize(`public/${file}`)).toEqual({ width: size, height: size });
  }
  // The social picture needs a full address; it must be the file in public/, 1200×630.
  const og = html.match(/property="og:image" content="([^"]+)"/)[1];
  expect(og).toBe('https://nxt549.github.io/hamster-slots/social.png');
  expect(pngSize('public/social.png')).toEqual({ width: 1200, height: 630 });
});
