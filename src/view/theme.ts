// theme.ts — VIEW layer. Turns the pixel-art frame sprites (src/view/art.ts) into CSS
// variables, so style.css can use them as crisp pixel borders:
//   .btn-primary { --btn-frame: var(--frame-btn-primary); }
//
// It uses "9-slice" scaling (CSS border-image): the 4 corners of a 12×12 frame
// stay sharp, and its edges and middle stretch to fit any box. That's how one tiny
// picture can frame a button, a tile or the whole tray.
//
// Every button is ONE sprite (frameButton) repainted in that button's colours.
// The colours are read from the theme tokens in style.css :root (e.g. --primary
// and --primary-dark), so colours still live in one place.

import { spriteURL } from './art.ts';
import { Pixmap, pixel, mixPixel } from './paint.ts';
import { applyFrames } from './frames.ts';
import type { Colors } from './art.ts';
import { mix } from './dom.ts';

// Button colour sets: the face colour and the darker lip under it (both tokens).
const BUTTONS: Record<string, [string, string]> = {
  primary: ['--primary', '--primary-dark'],
  soft: ['--soft', '--soft-dark'],
  buy: ['--buy', '--buy-dark'],
  gold: ['--gold', '--gold-dark'],
  danger: ['--danger', '--danger-dark'],
  token: ['--token', '--token-dark'],
  heirloom: ['--heirloom', '--heirloom-dark'],
  off: ['--off', '--off-dark'],
  card: ['--kraft', '--kraft-dark'],
  black: ['--card-black', '--card-black-dark'], // the card gamble's "Black" (Red uses danger)
};

const INK = '#2b1a10'; // what outlines are darkened towards

// The 9-slice frames, for tests/art.test.js (it checks their edges really repeat).
export const FRAME_SPRITES = ['frameCard', 'framePaper', 'frameTab', 'frameButton', 'frameRail'];

// Every token this file reads. They must exist in style.css :root as "#rrggbb"
// colours, because mix() works on hex colours (tests/art.test.js checks).
export const THEME_TOKENS = [
  ...new Set([...Object.values(BUTTONS).flat(), '--buy-dark', '--buy', '--gold-dark', '--gold', '--heirloom-dark', '--heirloom',
    '--soft-dark', '--soft', '--kraft', '--kraft-dark', '--kraft-edge', '--felt', '--felt-dark', '--felt-light', '--felt-edge',
    '--wood', '--wood-light', '--wood-dark', '--wood-ink', '--page', '--page-dot', '--outline-ink']),
];

// 1.5.0: the wallpaper round the game (the page): a quilted diamond lattice with a little
// flower in every diamond, painted in the page's tokens as a 24×24 tile (drawn at 2×).
function pageTile(page: string, dot: string, ink: string): string {
  const t = new Pixmap(24, 24);
  const base = pixel(page);
  const line = pixel(dot);
  const deep = mixPixel(pixel(dot), pixel(ink), 0.12);
  const light = mixPixel(base, 0xffffffff, 0.35);
  t.rect(0, 0, 24, 24, base);
  for (let k = 0; k < 24; k++) {
    // Two diagonal lines cross the tile (they meet the next tile's, so the lattice repeats).
    t.set(k, k, line);
    t.set(23 - k, k, line);
    if (k % 2 === 0) { t.set(k, (k + 1) % 24, light); t.set(23 - k, (k + 1) % 24, light); }
  }
  // A flower in the middle of each diamond (the tile's middle, and its edges' middles).
  for (const [x, y] of [[12, 5], [12, 18], [5, 12], [18, 12]]) {
    t.set(x, y, deep);
    t.set(x - 1, y, line); t.set(x + 1, y, line); t.set(x, y - 1, line); t.set(x, y + 1, line);
  }
  const c = document.createElement('canvas');
  t.toCanvas(c);
  return c.toDataURL();
}

// 1.5.0: cardboard's fibres, laid over the tray: see-through specks and little strands of
// lighter and darker kraft (a 32×32 tile at 2×).
function kraftTile(kraft: string, dark: string): string {
  const t = new Pixmap(32, 32);
  const light = (mixPixel(pixel(kraft), 0xffffffff, 0.5) & 0x00ffffff) | (0x38 << 24);
  const deep = (pixel(dark) & 0x00ffffff) | (0x30 << 24);
  const hash = (n: number) => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };
  for (let k = 0; k < 70; k++) {
    const x = Math.floor(hash(k) * 32);
    const y = Math.floor(hash(k + 100) * 32);
    const col = k % 3 ? light : deep;
    t.data[y * 32 + x] = col;
    if (k % 7 === 0) t.data[y * 32 + ((x + 1) % 32)] = col; // a little strand
    if (k % 11 === 0) t.data[y * 32 + ((x + 2) % 32)] = col;
  }
  const c = document.createElement('canvas');
  t.toCanvas(c);
  return c.toDataURL();
}

export function applyTheme(root: HTMLElement = document.documentElement): void {
  const css = getComputedStyle(root);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const url = (sprite: string, colors: Colors | null = null) => `url("${spriteURL(sprite, colors)}")`;
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  // A paper frame with a coloured edge (letters 2 and 3 are paper shade + outline).
  const edged = (sprite: string, edge: string, tint: string) => url(sprite, { 3: token(edge), 2: mix(token(tint), '#ffffff', 0.45) });

  set('--frame-card', url('frameCard'));
  set('--frame-paper', url('framePaper'));
  set('--frame-paper-ready', edged('framePaper', '--buy-dark', '--buy'));
  set('--frame-paper-gold', edged('framePaper', '--gold-dark', '--gold'));
  set('--frame-paper-heirloom', edged('framePaper', '--heirloom-dark', '--heirloom'));
  set('--frame-paper-selected', edged('framePaper', '--soft-dark', '--soft'));
  set('--frame-tab', url('frameTab'));
  set('--frame-tab-card', url('frameTab', { 1: token('--kraft'), 2: token('--kraft-dark'), 3: token('--kraft-edge') }));
  // M11: the casino's tables, green card-table felt (the tray's frame, repainted).
  set('--frame-felt', url('frameCard', { U: token('--felt-edge'), x: token('--felt-light'), n: token('--felt'), N: token('--felt-dark') }));
  // 1.5.0: the tables have a wooden rail round the felt.
  set('--frame-rail', url('frameRail', { U: token('--wood-ink'), x: token('--wood-light'), n: token('--wood'), N: token('--wood-dark'), k: token('--felt-edge'), 1: token('--felt') }));
  set('--tile-felt', `url("${kraftTile(token('--felt-light'), token('--felt-edge'))}")`);
  set('--bubble-tail', url('bubbleTail'));
  set('--tile-page', `url("${pageTile(token('--page'), token('--page-dot'), token('--outline-ink'))}")`);
  set('--tile-kraft', `url("${kraftTile(token('--kraft'), token('--kraft-dark'))}")`);
  set('--tile-bedding', url('bedding'));

  for (const [id, [face, lip]] of Object.entries(BUTTONS)) {
    const base = token(face);
    const dark = token(lip);
    set(`--frame-btn-${id}`, url('frameButton', { 4: base, 5: dark, 6: mix(base, '#ffffff', 0.45), 7: mix(dark, INK, 0.45) }));
  }

  // 1.6.0 ("New Digs"): the kit's materials (frames.ts), and the older screens' frames made of
  // them too: every button becomes enamel (the plain ones wooden keys), paper becomes the new
  // paper, and the sub-tabs index tabs. So the screens not yet rebuilt on the kit (DESIGN §31's
  // later parts) already look like the rest.
  applyFrames(root);
  for (const id of Object.keys(BUTTONS)) set(`--frame-btn-${id}`, `var(--fr-enamel-${id === 'card' ? 'wood' : id})`);
  for (const tone of ['', '-ready', '-gold', '-heirloom', '-selected']) set(`--frame-paper${tone}`, `var(--fr-paper${tone})`);
  set('--frame-tab', 'var(--fr-index-tab)');
  set('--frame-tab-card', 'var(--fr-index-tab-dim)');
  set('--frame-card', 'var(--fr-wood-panel)');
}
