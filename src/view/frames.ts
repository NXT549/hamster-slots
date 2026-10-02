// frames.ts — VIEW layer. The UI's materials, painted as pixel art (1.6.0, "New Digs";
// DESIGN §31): the wood, paper, brass and enamel the new UI is built from, like the
// furniture and paperwork of the room the cage stands in.
//
// Every frame is a tiny 12×12 picture used as a "9-slice" border (CSS border-image, like
// theme.ts's frames): its 4×4 corners stay sharp, and the middle 4 pixels of each edge
// stretch to fit any box. So every edge is painted from a PROFILE: four colours from the
// outside in (an outline, a highlight or shade, the body, an inner line), the same all
// along that edge, which is what lets it stretch without smearing (tests/kit.test.js
// checks every frame). Corners are where two edges meet: mitred like a picture frame,
// rounded like paper, or decorated (a screw, a brass bracket).
//
// The textures (wood grain, the tray's oak panel, paper fibres) are small tiles that
// repeat seamlessly behind the frames.
//
// Colours come from theme tokens (FRAME_TOKENS, in style.css :root), painted once at
// startup into CSS variables (--fr-<name> for frames, --tx-<name> for textures), never
// per frame. The painting itself (paintFrames, paintTextures) is pure, so it runs in the
// tests without a page.

import { Pixmap, pixel, mixPixel, hash2, readTokens } from './paint.ts';
import type { Pixel } from './paint.ts';

// Every colour this file reads. All must be "#rrggbb" in style.css :root (tests/kit.test.js).
export const FRAME_TOKENS = [
  '--wood', '--wood-light', '--wood-dark', '--wood-ink',
  '--brass', '--brass-light', '--brass-dark', '--brass-ink',
  '--panel', '--panel-light', '--panel-dark', '--glass', '--glass-dark',
  '--paper', '--paper-2', '--paper-edge', '--ink-faint', '--outline-ink',
  '--primary', '--primary-dark', '--soft', '--soft-dark', '--buy', '--buy-dark', '--gold', '--gold-dark',
  '--danger', '--danger-dark', '--token', '--token-dark', '--heirloom', '--heirloom-dark', '--off', '--off-dark',
  '--card-black', '--card-black-dark', '--luck', '--luck-dark',
] as const;
export type FrameColors = Record<(typeof FRAME_TOKENS)[number], string>;

export const FRAME_SIZE = 12; // every frame is 12×12…
export const FRAME_SLICE = 4; // …with 4 px corners (CSS: border-image-slice 4, drawn at 1×, 2× or 3×)

// The enamel button tones: the face and the darker lip under it (the action colours).
export const ENAMEL_TONES: Record<string, [string, string]> = {
  primary: ['--primary', '--primary-dark'],
  soft: ['--soft', '--soft-dark'],
  buy: ['--buy', '--buy-dark'],
  gold: ['--gold', '--gold-dark'],
  danger: ['--danger', '--danger-dark'],
  token: ['--token', '--token-dark'],
  heirloom: ['--heirloom', '--heirloom-dark'],
  off: ['--off', '--off-dark'],
  black: ['--card-black', '--card-black-dark'],
  wood: ['--wood-light', '--wood-dark'], // a plain wooden key: the neutral button
  brass: ['--brass-light', '--brass-dark'],
  luck: ['--luck', '--luck-dark'],
};

// The paper tones: an edge colour and a tint for the shade along the bottom. Their meanings
// stay what they were (§12): green = you can buy it, gold = maxed or running, heirloom =
// planted, blue = selected, faint = locked.
const PAPER_TONES: Record<string, [string, string]> = {
  paper: ['--paper-edge', '--paper-2'],
  paperReady: ['--buy-dark', '--buy'],
  paperGold: ['--gold-dark', '--gold'],
  paperHeirloom: ['--heirloom-dark', '--heirloom'],
  paperSelected: ['--soft-dark', '--soft'],
  paperLocked: ['--ink-faint', '--paper-2'],
};

const WHITE = 0xffffffff;
const CLEAR = 0; // a see-through pixel

// A frame's description: four colours per edge from the outside in, the middle's colour,
// how the corners join, and how many outer corner pixels are cut away (1 = the very corner,
// 2 = a rounder corner like paper's).
interface FrameSpec {
  top: Pixel[]; bottom: Pixel[]; left: Pixel[]; right: Pixel[];
  fill: Pixel;
  cut: number;
  joint?: Pixel; // a mitre line drawn across each corner (wood), or none
  open?: 'bottom'; // a tab: no bottom edge (it joins whatever is below it)
}

// Paint a frame from its profiles. Edge pixels come straight from a profile (so the
// middle of every edge is uniform); corners pick the edge they belong to by the diagonal.
export function paintFrame(spec: FrameSpec): Pixmap {
  const N = FRAME_SIZE;
  const S = FRAME_SLICE;
  const out = new Pixmap(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fromL = x;
      const fromR = N - 1 - x;
      const fromT = y;
      const fromB = spec.open === 'bottom' ? N : N - 1 - y; // an open bottom never reaches its edge
      const dx = Math.min(fromL, fromR); // how far in from the nearer side
      const dy = Math.min(fromT, fromB);
      const sideX = fromL <= fromR ? spec.left : spec.right;
      const sideY = fromT <= fromB ? spec.top : spec.bottom;
      let p: Pixel;
      if (dx >= S && dy >= S) p = spec.fill; // the middle
      else if (dx >= S) p = sideY[dy]; // the top or bottom edge
      else if (dy >= S) p = sideX[dx]; // the left or right edge
      else {
        // A corner. Cut away the outermost pixels, then join the two edges along the diagonal.
        if (dx + dy < spec.cut) p = CLEAR;
        else if (dx + dy === spec.cut && spec.cut > 0) p = sideY[0]; // the outline follows the rounded corner
        else if (dy < dx) p = sideY[dy];
        else if (dx < dy) p = sideX[dx];
        else p = dx > 0 && dx < S - 1 && spec.joint ? spec.joint : darker(sideX[dx], sideY[dy]);
      }
      out.data[y * N + x] = p;
    }
  }
  return out;
}

// The darker of two pixels (where two edges meet on a corner's diagonal).
function darker(a: Pixel, b: Pixel): Pixel {
  const lum = (p: Pixel) => (p & 0xff) * 0.3 + ((p >>> 8) & 0xff) * 0.59 + ((p >>> 16) & 0xff) * 0.11;
  if (!(a >>> 24)) return b;
  if (!(b >>> 24)) return a;
  return lum(a) <= lum(b) ? a : b;
}

// ─────────────────────── the frames ───────────────────────

export function paintFrames(c: FrameColors): Record<string, Pixmap> {
  const P = (t: keyof FrameColors) => pixel(c[t]);
  const frames: Record<string, Pixmap> = {};

  // WOOD: a picture-frame moulding. Lit from the top-left: the top and left sides catch the
  // light on their outside, the bottom and right sides are in shade; inside the opening the
  // frame throws a shadow on the top and left, and its lip catches the light at the bottom
  // and right. The corners are mitred, with a joint line, like a real frame.
  const ink = P('--wood-ink');
  const wood = P('--wood');
  const wl = P('--wood-light');
  const wd = P('--wood-dark');
  const woodSpec = (fill: Pixel): FrameSpec => ({
    top: [ink, wl, wood, wd], left: [ink, wl, wood, wd],
    bottom: [ink, wd, wood, wl], right: [ink, wd, wood, wl],
    fill, cut: 1, joint: mixPixel(wd, ink, 0.25),
  });
  frames.wood = paintFrame(woodSpec(wood));
  // The tray's cabinet: the same moulding round the light oak panel inside it.
  frames.woodPanel = paintFrame(woodSpec(P('--panel')));
  // A picture frame with brass corner brackets and a screw in each (dialogs, the HUD's shelf).
  const woodBrass = paintFrame(woodSpec(P('--panel')));
  bracket(woodBrass, P('--brass-ink'), P('--brass'), P('--brass-light'), P('--brass-dark'));
  frames.woodBrass = woodBrass;

  // BRASS: a plate (the wallet's counters, the tabs, selectors, switches): bevelled, a bright
  // glint top-left, a screw in each corner.
  const bink = P('--brass-ink');
  const brassSpec = (base: Pixel, light: Pixel, dark: Pixel): FrameSpec => ({
    top: [bink, light, base, base], left: [bink, light, base, base],
    bottom: [bink, dark, base, base], right: [bink, dark, base, base],
    fill: base, cut: 1,
  });
  const brassPlate = (base: Pixel, light: Pixel, dark: Pixel) => {
    const f = paintFrame(brassSpec(base, light, dark));
    screws(f, mixPixel(dark, bink, 0.35));
    f.set(1, 1, mixPixel(light, WHITE, 0.6)); // the glint
    return f;
  };
  frames.brass = brassPlate(P('--brass'), P('--brass-light'), P('--brass-dark'));
  // Lit (the open tab, a pressed selector): brighter all over.
  frames.brassLit = brassPlate(mixPixel(P('--brass'), P('--brass-light'), 0.55), mixPixel(P('--brass-light'), WHITE, 0.5), P('--brass'));
  // Dim (a tab that isn't open): the plate in shade.
  frames.brassDim = brassPlate(mixPixel(P('--brass'), P('--brass-dark'), 0.55), P('--brass'), mixPixel(P('--brass-dark'), bink, 0.3));
  // A brass slot: the inside sunk in (a switch's track, a selector's well).
  frames.brassSlot = paintFrame({
    top: [bink, P('--brass-dark'), mixPixel(P('--brass-dark'), bink, 0.35), P('--brass-dark')],
    left: [bink, P('--brass-dark'), mixPixel(P('--brass-dark'), bink, 0.35), P('--brass-dark')],
    bottom: [bink, P('--brass-light'), P('--brass'), P('--brass-dark')],
    right: [bink, P('--brass-light'), P('--brass'), P('--brass-dark')],
    fill: P('--brass-dark'), cut: 1,
  });

  // GLASS: a gauge's tube in a brass rim (drawn at 1×: progress bars are thin).
  frames.glass = paintFrame({
    top: [bink, P('--brass-light'), P('--brass'), P('--glass-dark')],
    left: [bink, P('--brass-light'), P('--brass'), P('--glass-dark')],
    bottom: [bink, P('--brass-dark'), P('--brass'), P('--glass')],
    right: [bink, P('--brass-dark'), P('--brass'), P('--glass')],
    fill: P('--glass'), cut: 1,
  });

  // PAPER: cream index cards in tones. The edge is the tone's dark colour, a shade runs along
  // the bottom and right (a lighter tint of the tone), and the corners are rounded.
  for (const [name, [edgeT, tintT]] of Object.entries(PAPER_TONES)) {
    const edge = P(edgeT as keyof FrameColors);
    const paper = P('--paper');
    const shade = name === 'paper' || name === 'paperLocked' ? P('--paper-2') : mixPixel(P(tintT as keyof FrameColors), WHITE, 0.45);
    frames[name] = paintFrame({
      top: [edge, paper, paper, paper], left: [edge, paper, paper, paper],
      bottom: [edge, shade, shade, paper], right: [edge, shade, paper, paper],
      fill: paper, cut: 2,
    });
  }
  // An index tab (a sub-tab): paper open at the bottom, so it joins the strip under it. The
  // dim one is a tab behind the open one.
  const tab = (paper: Pixel, edge: Pixel, shade: Pixel) => paintFrame({
    top: [edge, paper, paper, paper], left: [edge, paper, paper, paper],
    bottom: [paper, paper, paper, paper], right: [edge, shade, paper, paper],
    fill: paper, cut: 2, open: 'bottom',
  });
  frames.indexTab = tab(P('--paper'), P('--paper-edge'), P('--paper-2'));
  frames.indexTabDim = tab(P('--paper-2'), P('--paper-edge'), mixPixel(P('--paper-2'), P('--paper-edge'), 0.4));

  // ENAMEL: domed arcade buttons in each action colour. A two-row highlight with a glint on
  // the dome, a darker lip under it; pressed ("-down"), the face sinks into the lip.
  for (const [tone, [faceT, lipT]] of Object.entries(ENAMEL_TONES)) {
    const face = pixel(c[faceT as keyof FrameColors]);
    const lip = pixel(c[lipT as keyof FrameColors]);
    const outline = mixPixel(lip, pixel(c['--outline-ink']), 0.45);
    const light = mixPixel(face, WHITE, 0.42);
    const hilite = mixPixel(face, WHITE, 0.72);
    const up = paintFrame({
      top: [outline, hilite, light, face], left: [outline, light, face, face],
      bottom: [outline, lip, lip, face], right: [outline, lip, face, face],
      fill: face, cut: 2,
    });
    up.set(2, 1, WHITE); // the glint on the dome
    up.set(3, 1, WHITE);
    frames[`enamel-${tone}`] = up;
    const down = paintFrame({
      top: [outline, mixPixel(lip, pixel(c['--outline-ink']), 0.2), light, face], left: [outline, lip, face, face],
      bottom: [outline, lip, face, face], right: [outline, lip, face, face],
      fill: face, cut: 2,
    });
    frames[`enamel-${tone}-down`] = down;
  }
  return frames;
}

// A screw head in each corner of a plate: one dark pixel (drawn at 2×, a little 2×2 screw).
function screws(f: Pixmap, dark: Pixel): void {
  const N = FRAME_SIZE;
  for (const [x, y] of [[2, 2], [N - 3, 2], [2, N - 3], [N - 3, N - 3]]) f.set(x, y, dark);
}

// Brass brackets over a wooden frame's corners: an L of brass on each corner, a screw in it.
function bracket(f: Pixmap, ink: Pixel, base: Pixel, light: Pixel, dark: Pixel): void {
  const N = FRAME_SIZE;
  for (const [cx, cy] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) {
    const sx = cx === 0 ? 1 : -1;
    const sy = cy === 0 ? 1 : -1;
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= 2; j++) {
        // the bracket's two arms: along the top/bottom edge and down/up the side
        f.set(cx + sx * i, cy + sy * j, j === 1 ? (sy > 0 ? light : dark) : base);
        f.set(cx + sx * j, cy + sy * i, j === 1 ? (sx > 0 ? light : dark) : base);
      }
    }
    f.set(cx + sx * 2, cy + sy * 2, ink); // the screw
    f.set(cx + sx * 3, cy + sy * 3, mixPixel(base, dark, 0.5));
  }
}

// ─────────────────────── the textures ───────────────────────

// Wood grain: a 32×32 tile of long wavy streaks (they repeat seamlessly: every wave fits the
// tile a whole number of times), a few lighter flecks, and a knot.
function grain(base: Pixel, light: Pixel, dark: Pixel, knots: boolean): Pixmap {
  const W = 32;
  const t = new Pixmap(W, W);
  const streak = mixPixel(base, dark, 0.45);
  const soft = mixPixel(base, dark, 0.22);
  const fleck = mixPixel(base, light, 0.5);
  t.rect(0, 0, W, W, base);
  for (let row = 0; row < 6; row++) {
    const y0 = row * 5.33 + 1;
    const phase = row * 1.7;
    for (let x = 0; x < W; x++) {
      const y = Math.round(y0 + Math.sin((x / W) * Math.PI * 2 + phase) * 1.2) % W;
      t.set(x, (y + W) % W, row % 2 ? streak : soft);
      if (hash2(x, row) > 0.86) t.set(x, (y + 2 + W) % W, fleck); // a lighter fleck beside it
    }
  }
  if (knots) {
    // A small knot: a dark ring with a lighter middle.
    for (const [dx, dy, col] of [[0, -1, streak], [1, 0, streak], [0, 1, streak], [-1, 0, streak], [0, 0, soft]] as [number, number, Pixel][]) t.set(21 + dx, 17 + dy, col);
  }
  return t;
}

// Paper fibres: a few faint specks (see-through, so the paper's own colour shows).
function fibres(edge: Pixel): Pixmap {
  const W = 32;
  const t = new Pixmap(W, W);
  const speck = (edge & 0x00ffffff) | (0x22 << 24);
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(hash2(k, 3) * W);
    const y = Math.floor(hash2(k, 7) * W);
    t.data[y * W + x] = speck;
    if (k % 5 === 0) t.data[y * W + ((x + 1) % W)] = speck;
  }
  return t;
}

export function paintTextures(c: FrameColors): Record<string, Pixmap> {
  const P = (t: keyof FrameColors) => pixel(c[t]);
  return {
    wood: grain(P('--wood'), P('--wood-light'), P('--wood-dark'), true),
    panel: grain(P('--panel'), P('--panel-light'), P('--panel-dark'), false),
    paper: fibres(P('--paper-edge')),
  };
}

// ─────────────────────── into CSS ───────────────────────

// Paint every frame and texture from the page's tokens and hand them to the CSS as variables:
// --fr-wood, --fr-paper-ready, --fr-enamel-primary-down …, --tx-wood, --tx-panel, --tx-paper.
// Once at startup (main.ts, after theme.ts), and again only if the tokens change.
export function applyFrames(root: HTMLElement = document.documentElement): void {
  const colors = readTokens(root, FRAME_TOKENS);
  const url = (p: Pixmap) => {
    const canvas = document.createElement('canvas');
    p.toCanvas(canvas);
    return `url("${canvas.toDataURL()}")`;
  };
  // "paperReady" → "paper-ready", "enamel-primary-down" stays as it is.
  const cssName = (name: string) => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
  for (const [name, p] of Object.entries(paintFrames(colors))) root.style.setProperty(`--fr-${cssName(name)}`, url(p));
  for (const [name, p] of Object.entries(paintTextures(colors))) root.style.setProperty(`--tx-${cssName(name)}`, url(p));
}
