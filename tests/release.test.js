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

// Every update has a name from what it's about (the user's pick, 1.3.1; AGENTS.md →
// Git and releases): package.json's releaseName, shown in the Menu, and every
// version's heading in the CHANGELOG ("## [1.3.0] - 2026-09-27 · The Hamster Casino").
test('every update has a name', () => {
  const { version, releaseName } = JSON.parse(read('package.json'));
  expect(typeof releaseName).toBe('string');
  expect(releaseName.trim().length).toBeGreaterThan(0);
  const changelog = read('CHANGELOG.md').toString();
  // A release candidate's entries wait under [Unreleased], which names the update to come.
  const heading = version.includes('-')
    ? changelog.match(/^## \[Unreleased\].*$/m)
    : changelog.match(new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\].*$`, 'm'));
  expect(heading, `a CHANGELOG heading for ${version}`).not.toBeNull();
  expect(heading[0]).toContain(releaseName);
  const released = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}(.*)$/gm)];
  expect(released.length).toBeGreaterThan(5);
  for (const [line, , name] of released) expect(name, line).toMatch(/^ · \S/);
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
