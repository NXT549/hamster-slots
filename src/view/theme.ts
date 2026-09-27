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
export const FRAME_SPRITES = ['frameCard', 'framePaper', 'frameTab', 'frameButton'];

// Every token this file reads. They must exist in style.css :root as "#rrggbb"
// colours, because mix() works on hex colours (tests/art.test.js checks).
export const THEME_TOKENS = [
  ...new Set([...Object.values(BUTTONS).flat(), '--buy-dark', '--buy', '--gold-dark', '--gold', '--heirloom-dark', '--heirloom',
    '--soft-dark', '--soft', '--kraft', '--kraft-dark', '--kraft-edge', '--felt', '--felt-dark', '--felt-light', '--felt-edge']),
];

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
  set('--bubble-tail', url('bubbleTail'));
  set('--tile-bedding', url('bedding'));

  for (const [id, [face, lip]] of Object.entries(BUTTONS)) {
    const base = token(face);
    const dark = token(lip);
    set(`--frame-btn-${id}`, url('frameButton', { 4: base, 5: dark, 6: mix(base, '#ffffff', 0.45), 7: mix(dark, INK, 0.45) }));
  }
}
