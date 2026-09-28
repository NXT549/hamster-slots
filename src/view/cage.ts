// cage.ts — VIEW layer. The hamster's cage and the room around it, painted as
// pixel art (1.5.0, "The Glow Up"), behind the wheel and the machine.
//
// What you see, from the back to the front:
//   · the ROOM behind the cage: wallpaper, a wainscot, a window with the sky and
//     hills outside (the sky is a layer of its own behind the canvas, so its clouds
//     can drift), curtains, a shelf with a plant and books, and a family portrait;
//   · the CAGE: wire on the back wall and on both side walls, drawn in perspective so
//     the cage has depth, standing in a plastic tray;
//   · the BEDDING in the tray: wood shavings (bigger towards the front), a few
//     sunflower seeds, and a soft shadow under the wheel and the machine;
//   · the front of the TRAY, where the buttons are;
//   · sunlight falling in from the window (or, in free spins, the room at night
//     with the lamp on: a second painting that the scene fades to).
//
// The layout is worked out for the stage's size (cageLayout: pure maths), and the
// picture is painted on a small canvas that CSS scales up 2×, like a sprite. It's
// only repainted when something changes (the size, a skin, the machine), never
// every frame. Colours are theme tokens (CAGE_TOKENS, style.css :root); room skins
// recolour the wall, the wire and the tray, like before.

import { Pixmap, Mask, pixel, mixPixel, withAlpha, hash, hash2, readTokens, ramp, paintMask, BASE, LIGHT, SHADE, DEEP, HILITE } from './paint.ts';
import type { Pixel } from './paint.ts';

// Every colour the painting reads (tests/art.test.js checks they're all in style.css :root).
export const CAGE_TOKENS = [
  '--wall-top', '--wall-bottom', '--wall-stripe', '--wire', '--wire-dark', '--wire-light', '--floor', '--floor-dark',
  '--bedding', '--bedding-light', '--bedding-shade', '--bedding-deep', '--bedding-ink', '--seed-body', '--seed-stripe',
  '--wood', '--wood-light', '--wood-dark', '--wood-ink', '--curtain', '--curtain-light', '--curtain-dark',
  '--leaf', '--leaf-light', '--leaf-dark', '--leaf-ink', '--pot', '--pot-light', '--pot-dark',
  '--book-1', '--book-2', '--book-3', '--gold', '--gold-dark', '--sun-shaft', '--night', '--lamp', '--outline-ink',
  '--sky-top', '--sky-bottom', '--cloud', '--cloud-shade', '--hill-far', '--hill-near',
  '--night-sky-top', '--night-sky-bottom', '--moon', '--star',
  '--fur', '--fur-shade', '--fur-ink', '--cream',
] as const;
export type CageColors = Record<(typeof CAGE_TOKENS)[number], string>;

export const CAGE_PX = 2; // screen pixels per painted pixel (like a sprite at 2×)

interface Rect { x: number; y: number; w: number; h: number }
export interface CageLayout {
  w: number; h: number; // the painting, in painted pixels
  wallB: number; // where the wall band ends (the bedding band starts), painted pixels from the top
  floorT: number; // the top of the tray's front (where the buttons are)
  back: { l: number; r: number; top: number; floor: number }; // the cage's back wall: its sides, top and foot
  tray: number; // how tall the tray's plastic shows at the back
  window: Rect | null; // the window in the room (its glass: the sky shows through)
  shelf: Rect | null; // the shelf on the right
  portrait: Rect | null; // the family portrait
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Where everything goes, for a stage W × H screen pixels whose wall band ends at
// wallBottom and whose buttons start at floorTop.
export function cageLayout(W: number, H: number, wallBottom: number, floorTop: number): CageLayout {
  const w = Math.max(40, Math.ceil(W / CAGE_PX));
  const h = Math.max(40, Math.ceil(H / CAGE_PX));
  const wallB = clamp(Math.round(wallBottom / CAGE_PX), 20, h);
  const floorT = clamp(Math.round(floorTop / CAGE_PX), wallB, h);
  const inset = clamp(Math.round(w * 0.045), 6, 26);
  const depth = clamp(Math.round(wallB * 0.055), 7, 16); // how far back the back wall's foot is
  const back = { l: inset, r: w - inset, top: clamp(Math.round(h * 0.035), 4, 12), floor: wallB - depth };
  const tray = clamp(Math.round(depth * 0.45), 3, 7);
  const room = back.floor - back.top; // the height of the back wall
  const inner = back.r - back.l;
  // The window, top left; the shelf, right; the portrait between them (wide enough stages only).
  const winW = clamp(Math.round(inner * 0.2), 26, 76);
  const winH = clamp(Math.round(room * 0.4), 22, 86);
  const window = inner >= 120 && room >= 60
    ? { x: back.l + Math.round(inner * 0.07), y: back.top + Math.round(room * 0.12), w: winW, h: winH } : null;
  const shelfW = clamp(Math.round(inner * 0.21), 34, 84);
  const shelf = inner >= 170 && room >= 70
    ? { x: back.r - Math.round(inner * 0.06) - shelfW, y: back.top + Math.round(room * 0.36), w: shelfW, h: 4 } : null;
  const portrait = inner >= 260 && room >= 90
    ? { x: Math.round(back.l + inner * 0.5 - 9), y: back.top + Math.round(room * 0.1), w: 18, h: 22 } : null;
  return { w, h, wallB, floorT, back, tray, window, shelf, portrait };
}

// ─────────────────────── painting ───────────────────────

// The screen-space boxes of the wheel and the machine (painted pixels), for their shadows.
export interface Standing { x: number; w: number; foot: number }

export function paintCage(L: CageLayout, c: CageColors, standing: Standing[] = []): Pixmap {
  const out = new Pixmap(L.w, L.h);
  paintRoom(out, L, c);
  paintWire(out, L, c);
  paintBedding(out, L, c, standing);
  paintTray(out, L, c);
  paintSunlight(out, L, c);
  return out;
}

// The same scene at night (free spins): everything dimmed towards the night colour,
// the window dark, and a warm pool of lamplight by the shelf.
export function nightOf(day: Pixmap, L: CageLayout, c: CageColors): Pixmap {
  const out = new Pixmap(L.w, L.h);
  const night = pixel(c['--night']);
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const p = day.data[y * L.w + x];
      if (!(p >>> 24)) continue; // the window's glass stays see-through (the night sky is behind it)
      // The tray's front (the buttons) dims less, so the buttons stay easy to read.
      const t = y >= L.floorT ? 0.22 : 0.5;
      out.data[y * L.w + x] = mixPixel(p, night, t);
    }
  }
  // Lamplight: a warm glow, brightest at the lamp, dithered at its edge.
  const lamp = pixel(c['--lamp']);
  const cx = L.shelf ? L.shelf.x + L.shelf.w * 0.78 : L.w * 0.82;
  const cy = L.shelf ? L.shelf.y - 8 : L.back.top + 20;
  const r = clamp(L.w * 0.26, 30, 110);
  for (let y = Math.floor(cy - r); y < cy + r; y++) {
    for (let x = Math.floor(cx - r); x < cx + r; x++) {
      if (!out.inside(x, y) || y >= L.floorT) continue;
      const d = Math.hypot(x - cx, (y - cy) * 1.15) / r;
      if (d > 1 || !(out.data[y * L.w + x] >>> 24)) continue;
      const k = d < 0.35 ? 0.34 : d < 0.62 ? 0.22 : d < 0.85 ? 0.12 : (x + y) % 2 ? 0.06 : 0;
      if (k) out.data[y * L.w + x] = mixPixel(out.data[y * L.w + x], lamp, k);
    }
  }
  if (L.shelf) paintLamp(out, L.shelf, c, true);
  return out;
}

// ── The room behind the cage ──
function paintRoom(out: Pixmap, L: CageLayout, c: CageColors): void {
  const top = pixel(c['--wall-top']);
  const bottom = pixel(c['--wall-bottom']);
  const stripe = pixel(c['--wall-stripe']);
  const ink = pixel(c['--outline-ink']);
  const railY = L.back.top + Math.round((L.back.floor - L.back.top) * 0.64); // the chair rail
  // The wallpaper: the wall's two colours in bands, dithered where they meet; wide
  // stripes (the wall-stripe token, like the old look) with a tiny flower in every other one.
  const bands = 5;
  for (let y = 0; y < L.wallB + 4; y++) {
    const f = y / Math.max(1, railY);
    const band = Math.min(bands - 1, Math.floor(f * bands));
    const edge = (f * bands) % 1 > 0.86 && band < bands - 1;
    for (let x = 0; x < L.w; x++) {
      const k = Math.min(bands - 1, band + (edge && (x + y) % 2 ? 1 : 0)) / (bands - 1);
      out.data[y * L.w + x] = mixPixel(top, bottom, Math.min(1, k));
    }
  }
  for (let x = 0; x < L.w; x++) {
    if (Math.floor(x / 11) % 2) continue;
    for (let y = 0; y < railY; y++) out.set(x, y, stripe);
  }
  const motif = mixPixel(bottom, ink, 0.12);
  for (let y = 6; y < railY - 3; y += 9) {
    for (let x = 5 + (Math.floor(y / 9) % 2) * 11; x < L.w; x += 22) {
      out.set(x, y, motif);
      out.set(x - 1, y + 1, motif);
      out.set(x + 1, y + 1, motif);
      out.set(x, y + 2, motif);
    }
  }
  // Up near the ceiling the room is a little darker (it frames the scene).
  const dim = mixPixel(top, ink, 0.1);
  for (let y = 0; y < 3; y++) for (let x = 0; x < L.w; x++) if (y < 2 || (x + y) % 2) out.set(x, y, dim);
  // The wainscot under the chair rail: darker panels with a lit top edge and bevelled frames.
  const panel = mixPixel(bottom, ink, 0.1);
  const panelDark = mixPixel(bottom, ink, 0.2);
  const panelLight = mixPixel(bottom, 0xffffffff, 0.35);
  out.rect(0, railY, L.w, L.wallB + 4 - railY, panel);
  const pw = 26;
  for (let x0 = 3; x0 < L.w; x0 += pw) {
    const x1 = x0 + pw - 6;
    const y0 = railY + 5;
    const y1 = L.back.floor - L.tray - 3;
    if (y1 - y0 < 5) break;
    out.hline(x0, x1, y0, panelDark);
    out.vline(x0, y0, y1, panelDark);
    out.hline(x0 + 1, x1, y1, panelLight);
    out.vline(x1, y0 + 1, y1, panelLight);
  }
  // The chair rail: a strip of wood.
  const wood = ramp(c['--wood'], c['--wood-dark'], c['--wood-ink'], c['--wood-light']);
  out.hline(0, L.w, railY - 1, wood.light);
  out.hline(0, L.w, railY, wood.base);
  out.hline(0, L.w, railY + 1, wood.shade);
  out.hline(0, L.w, railY + 2, mixPixel(panel, ink, 0.25));
  if (L.window) paintWindow(out, L.window, c);
  if (L.shelf) paintShelf(out, L.shelf, c);
  if (L.portrait) paintPortrait(out, L.portrait, c);
}

// A window with four panes (see-through: the sky layer behind the canvas shows),
// a wooden frame and sill, and curtains tied back on both sides.
function paintWindow(out: Pixmap, r: Rect, c: CageColors): void {
  const wood = ramp(c['--wood'], c['--wood-dark'], c['--wood-ink'], c['--wood-light']);
  const f = 3; // the frame's thickness
  // The frame (a bevel: lit top-left, shaded bottom-right) with the glass cut out.
  const m = new Mask(r.w, r.h);
  m.box(0, 0, r.w, r.h, 1);
  paintMask(out, m, wood, r.x, r.y);
  const midX = Math.round(r.w / 2);
  const midY = Math.round(r.h * 0.46);
  const glass = [
    [f, f, midX - 1 - f, midY - 1 - f], [midX + 1, f, r.w - f - midX - 1, midY - 1 - f],
    [f, midY + 1, midX - 1 - f, r.h - f - midY - 1], [midX + 1, midY + 1, r.w - f - midX - 1, r.h - f - midY - 1],
  ];
  for (const [gx, gy, gw, gh] of glass) {
    out.clear(r.x + gx, r.y + gy, gw, gh); // a hole: the sky shows through
    // The inner edge of the frame is in shade (a 1-pixel lip around each pane).
    out.hline(r.x + gx - 1, r.x + gx + gw, r.y + gy - 1, wood.shade);
    out.vline(r.x + gx - 1, r.y + gy, r.y + gy + gh - 1, wood.shade);
    // A glint on the glass: two little diagonal streaks (see-through white).
    const shine = withAlpha(0xffffffff, 0.55);
    for (let k = 0; k < Math.min(gw, gh) * 0.5; k++) {
      out.set(r.x + gx + 2 + k, r.y + gy + gh - 3 - k, shine);
      if (k > 1) out.set(r.x + gx + 5 + k, r.y + gy + gh - 3 - k, withAlpha(0xffffffff, 0.3));
    }
  }
  // The sill: a ledge wider than the window, and a little plant in a pot on it.
  const sillY = r.y + r.h;
  out.rect(r.x - 3, sillY, r.w + 6, 1, wood.light);
  out.rect(r.x - 3, sillY + 1, r.w + 6, 2, wood.base);
  out.rect(r.x - 2, sillY + 3, r.w + 4, 1, wood.shade);
  out.hline(r.x - 4, r.x + r.w + 3, sillY - 1, wood.ink);
  out.vline(r.x - 4, sillY - 1, sillY + 2, wood.ink);
  out.vline(r.x + r.w + 3, sillY - 1, sillY + 2, wood.ink);
  out.hline(r.x - 3, r.x + r.w + 2, sillY + 4, wood.ink);
  paintPottedPlant(out, r.x + r.w - 9, sillY - 1, c, 0.8);
  // Curtains: gathered at the top, tied back halfway, falling in folds.
  const cloth = ramp(c['--curtain'], c['--curtain-dark'], c['--outline-ink'], c['--curtain-light']);
  const rodY = r.y - 3;
  out.hline(r.x - 7, r.x + r.w + 6, rodY, wood.ink);
  out.hline(r.x - 7, r.x + r.w + 6, rodY + 1, wood.base);
  out.rect(r.x - 9, rodY - 1, 3, 3, wood.shade); // the rod's knobs
  out.rect(r.x + r.w + 6, rodY - 1, 3, 3, wood.shade);
  const curtainH = r.h + 10;
  for (const side of [-1, 1]) {
    const cm = new Mask(12, curtainH);
    for (let y = 0; y < curtainH; y++) {
      const tie = y / curtainH;
      // Wide at the top and the bottom, pulled in where it's tied (at 55% of the way down).
      const width = Math.round(8 + 4 * Math.abs(tie - 0.55) * 2.4);
      for (let x = 0; x < Math.min(12, width); x++) {
        const fold = (x + (y > curtainH * 0.55 ? 1 : 0)) % 4;
        cm.put(side < 0 ? x : 11 - x, y, fold === 0 ? LIGHT : fold === 3 ? SHADE : BASE);
      }
    }
    const cx = side < 0 ? r.x - 8 : r.x + r.w - 4;
    paintMask(out, cm, cloth, cx, rodY + 1);
    // The tie-back: a gold band where the curtain is gathered.
    const ty = rodY + 1 + Math.round(curtainH * 0.55);
    const tx0 = side < 0 ? cx : cx + 4;
    out.hline(tx0, tx0 + 7, ty, pixel(c['--gold']));
    out.hline(tx0, tx0 + 7, ty + 1, pixel(c['--gold-dark']));
  }
}

// A plant in a terracotta pot, standing with its foot at (x, y): a few leaves on stems.
function paintPottedPlant(out: Pixmap, x: number, y: number, c: CageColors, size = 1): void {
  const pot = ramp(c['--pot'], c['--pot-dark'], c['--outline-ink'], c['--pot-light']);
  const leaf = ramp(c['--leaf'], c['--leaf-dark'], c['--leaf-ink'], c['--leaf-light']);
  const pw = Math.max(5, Math.round(8 * size));
  const ph = Math.max(4, Math.round(7 * size));
  const pm = new Mask(pw + 2, ph);
  for (let yy = 0; yy < ph; yy++) {
    const inset = yy === 0 ? 0 : Math.floor((yy / ph) * 2) + 1; // a rim, then it narrows
    for (let xx = inset; xx < pw + 2 - inset; xx++) pm.put(xx, yy, yy === 0 ? LIGHT : xx < pw / 2 ? BASE : SHADE);
  }
  // Leaves: little shaded blobs fanning out of the pot.
  const lm = new Mask(pw + 10, Math.round(14 * size) + 2);
  const n = size > 0.9 ? 6 : 4;
  for (let k = 0; k < n; k++) {
    const a = Math.PI * (1.1 + (k / (n - 1)) * 0.8);
    const d = 5 * size + hash(k + x) * 2;
    lm.ball(lm.w / 2 + Math.cos(a) * d, lm.h - 2 + Math.sin(a) * d * 1.3, 2.4 * size + 0.6, 1.7 * size + 0.6, { spot: false });
  }
  paintMask(out, lm, leaf, x + pw / 2 + 1 - lm.w / 2, y - ph - lm.h + 3);
  paintMask(out, pm, pot, x, y - ph);
}

// A shelf with brackets, and on it: a plant, a row of books, and a little lamp.
function paintShelf(out: Pixmap, r: Rect, c: CageColors): void {
  const wood = ramp(c['--wood'], c['--wood-dark'], c['--wood-ink'], c['--wood-light']);
  const ink = pixel(c['--outline-ink']);
  // The brackets under it, and a soft shadow on the wall.
  const shadow = withAlpha(ink, 0.12);
  out.rect(r.x + 2, r.y + 5, r.w - 2, 2, shadow);
  for (const bx of [r.x + 4, r.x + r.w - 7]) {
    for (let k = 0; k < 5; k++) out.hline(bx, bx + Math.max(0, 3 - k), r.y + 4 + k, wood.shade);
    out.vline(bx, r.y + 4, r.y + 9, wood.ink);
  }
  const plank = new Mask(r.w, 4);
  plank.box(0, 0, r.w, 4, 1);
  paintMask(out, plank, wood, r.x, r.y);
  // Books: spines of three colours, different heights, one leaning.
  const books = [c['--book-1'], c['--book-2'], c['--book-3'], c['--book-1'], c['--book-3']];
  let bx = r.x + Math.round(r.w * 0.36);
  books.forEach((col, i) => {
    const bh = 9 + Math.round(hash(i * 3.7) * 4);
    const bw = i === 2 ? 4 : 3;
    const book = ramp(col, mixHex(col, c['--outline-ink'], 0.3), c['--outline-ink']);
    const bm = new Mask(bw, bh);
    bm.box(0, 0, bw, bh, 1);
    paintMask(out, bm, book, bx, r.y - bh - 1);
    // A little label band on the spine.
    out.hline(bx, bx + bw - 1, r.y - bh + 2, book.light);
    bx += bw + 1;
  });
  paintPottedPlant(out, r.x + 3, r.y - 1, c, 1);
  paintLamp(out, r, c, false);
}

// A little lamp at the end of the shelf (lit at night).
function paintLamp(out: Pixmap, r: Rect, c: CageColors, lit: boolean): void {
  const x = r.x + r.w - 8;
  const y = r.y - 1;
  const ink = pixel(c['--outline-ink']);
  const gold = ramp(c['--gold'], c['--gold-dark'], c['--outline-ink']);
  // The base and the stem.
  out.hline(x - 1, x + 5, y, ink);
  out.hline(x, x + 4, y - 1, gold.shade);
  out.vline(x + 2, y - 7, y - 2, gold.base);
  // The shade: a little trapezoid, glowing when the lamp is on.
  const shade = lit ? ramp(c['--lamp'], c['--gold'], c['--gold-dark']) : ramp(c['--curtain'], c['--curtain-dark'], c['--outline-ink'], c['--curtain-light']);
  const sm = new Mask(9, 6);
  for (let yy = 0; yy < 6; yy++) for (let xx = 2 - Math.floor(yy / 3); xx < 7 + Math.floor(yy / 3); xx++) sm.put(xx, yy, yy < 2 ? LIGHT : xx > 5 ? SHADE : BASE);
  paintMask(out, sm, shade, x - 2, y - 13);
}

// The family portrait: a gold frame with an old hamster in it (the family's first).
function paintPortrait(out: Pixmap, r: Rect, c: CageColors): void {
  const gold = ramp(c['--gold'], c['--gold-dark'], c['--outline-ink']);
  const fm = new Mask(r.w, r.h);
  fm.box(0, 0, r.w, r.h, 1);
  paintMask(out, fm, gold, r.x, r.y);
  // A string and a nail it hangs from.
  const ink = pixel(c['--outline-ink']);
  out.line(r.x + 3, r.y - 1, r.x + r.w / 2, r.y - 5, ink);
  out.line(r.x + r.w - 4, r.y - 1, r.x + r.w / 2, r.y - 5, ink);
  out.set(r.x + r.w / 2, r.y - 6, gold.shade);
  // The painting: a warm background and a hamster's head and shoulders.
  const bg = pixel(c['--curtain-dark']);
  out.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, mixPixel(bg, ink, 0.25));
  out.rect(r.x + 2, r.y + 2, r.w - 4, 2, mixPixel(bg, ink, 0.1));
  const fur = ramp(c['--fur'], c['--fur-shade'], c['--fur-ink']);
  const cx = r.x + r.w / 2;
  const hm = new Mask(r.w, r.h);
  hm.ball(r.w / 2, r.h * 0.62, 5.6, 5, { spot: false }); // the head
  hm.ball(r.w / 2, r.h - 2, 7, 4, { spot: false }); // the shoulders
  hm.ball(r.w / 2 - 4.5, r.h * 0.38, 1.8, 1.8, { spot: false }); // the ears
  hm.ball(r.w / 2 + 4.5, r.h * 0.38, 1.8, 1.8, { spot: false });
  for (let y = r.h - 3; y < r.h; y++) for (let x = 0; x < r.w; x++) if (x < 2 || x > r.w - 3) hm.put(x, y, 0);
  paintMask(out, hm, fur, r.x, r.y, false);
  const cream = pixel(c['--cream']);
  out.rect(cx - 2, r.y + r.h * 0.62 + 1, 4, 3, cream); // the muzzle
  out.set(cx - 3, r.y + r.h * 0.55, ink); // the eyes
  out.set(cx + 2, r.y + r.h * 0.55, ink);
  out.set(cx - 1, r.y + r.h * 0.62 + 1, pixel(c['--pot'])); // the nose
  out.rect(r.x + r.w / 2 - 3, r.y + r.h - 4, 6, 1, pixel(c['--gold'])); // a medal on its chest
}

// ── The cage: wire on the back and side walls, in a plastic tray ──
function paintWire(out: Pixmap, L: CageLayout, c: CageColors): void {
  const { back, tray } = L;
  const wire = pixel(c['--wire']);
  const wireDark = pixel(c['--wire-dark']);
  const wireLight = pixel(c['--wire-light']);
  const floor = pixel(c['--floor']);
  const floorDark = pixel(c['--floor-dark']);
  const floorLight = mixPixel(floor, 0xffffffff, 0.45);
  const wallTop = back.floor - tray;
  // The side walls' edges, top and bottom: from the front corners to the back ones.
  const topAt = (x: number, side: number) => { const d = side < 0 ? x / back.l : (L.w - 1 - x) / (L.w - 1 - back.r); return Math.round(back.top * d); };
  const footAt = (x: number, side: number) => { const d = side < 0 ? x / back.l : (L.w - 1 - x) / (L.w - 1 - back.r); return Math.round(L.floorT + (wallTop - L.floorT) * d); };
  // The tray's plastic along the back and up the sides (in perspective, taller at the front).
  out.rect(back.l, wallTop, back.r - back.l, tray, floor);
  out.hline(back.l, back.r - 1, wallTop, floorLight);
  out.hline(back.l, back.r - 1, back.floor - 1, floorDark);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : back.r;
    const x1 = side < 0 ? back.l : L.w;
    for (let x = x0; x < x1; x++) {
      const d = side < 0 ? x / back.l : (L.w - 1 - x) / (L.w - 1 - back.r);
      const foot = footAt(x, side);
      const th = Math.round(tray + (tray * 1.9 - tray) * (1 - d));
      out.vline(x, foot - th, foot, floor);
      out.set(x, foot - th, floorLight);
      out.set(x, foot, floorDark);
    }
  }
  // Back wall: vertical wires, a lit side and a shaded side.
  const sp = L.w < 220 ? 8 : 11;
  const n = Math.max(2, Math.round((back.r - back.l) / sp));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(back.l + ((back.r - back.l - 1) * k) / n);
    out.vline(x, back.top, wallTop - 1, wire);
    if (k < n) out.vline(x + 1, back.top + 1, wallTop - 1, withAlpha(wireDark, 0.55));
  }
  // …and horizontal wires across it: a strong top rail, a middle one and the foot.
  const railY = back.top + Math.round((wallTop - back.top) * 0.42);
  for (const [y, thick] of [[back.top, 2], [railY, 1], [wallTop - 2, 1]] as [number, number][]) {
    out.hline(back.l, back.r - 1, y, wireLight);
    if (thick > 1) out.hline(back.l, back.r - 1, y + 1, wire);
    out.hline(back.l, back.r - 1, y + thick, withAlpha(wireDark, 0.6));
  }
  // Side walls: wires that get closer together towards the back, and the rails
  // slanting from the front corners to the back ones.
  for (const side of [-1, 1]) {
    const fracs = [0.18, 0.43, 0.64, 0.82, 0.95];
    for (const f of fracs) {
      const x = side < 0 ? Math.round(back.l * f) : Math.round(L.w - 1 - (L.w - 1 - back.r) * f);
      const y0 = topAt(x, side);
      const y1 = footAt(x, side) - Math.round(tray + tray * 0.9 * (1 - f)) - 1;
      out.vline(x, y0, y1, wire);
      out.vline(x + (side < 0 ? 1 : -1), y0 + 1, y1, withAlpha(wireDark, 0.45));
    }
    // The slanting rails (top, middle, foot).
    const xs = side < 0 ? [0, back.l] : [L.w - 1, back.r];
    const yFor = (x: number, share: number) => {
      const top = topAt(x, side);
      const foot = footAt(x, side) - Math.round(tray + tray * 0.9 * (1 - (side < 0 ? x / back.l : (L.w - 1 - x) / (L.w - 1 - back.r)))) - 1;
      return Math.round(top + (foot - top) * share);
    };
    for (const share of [0, 0.42, 1]) {
      out.line(xs[0], yFor(xs[0], share), xs[1], yFor(xs[1], share), share === 0 ? wireLight : wire);
      out.line(xs[0], yFor(xs[0], share) + 1, xs[1], yFor(xs[1], share) + 1, withAlpha(wireDark, 0.5));
    }
    // The corner post where the side wall meets the back.
    const post = side < 0 ? back.l : back.r - 1;
    out.vline(post, back.top, wallTop - 1, wireLight);
    out.vline(post + (side < 0 ? 1 : -1), back.top, wallTop - 1, wire);
  }
  // The front of the roof: a thick rail right across the top, and the front corner posts.
  out.hline(0, L.w - 1, 0, wireDark);
  out.hline(0, L.w - 1, 1, wireLight);
  out.hline(0, L.w - 1, 2, wire);
  out.hline(0, L.w - 1, 3, wireDark);
  for (const x of [0, L.w - 2]) {
    out.vline(x, 0, L.floorT - 1, wireLight);
    out.vline(x + 1, 0, L.floorT - 1, wire);
  }
}

// ── The bedding: wood shavings in the tray, bigger and looser towards the front ──
function paintBedding(out: Pixmap, L: CageLayout, c: CageColors, standing: Standing[]): void {
  const { back } = L;
  const base = pixel(c['--bedding']);
  const light = pixel(c['--bedding-light']);
  const shade = pixel(c['--bedding-shade']);
  const deep = pixel(c['--bedding-deep']);
  const ink = pixel(c['--bedding-ink']);
  const y0 = back.floor;
  const y1 = L.floorT;
  const span = Math.max(1, y1 - y0);
  // The floor of the tray: a trapezoid from the back wall's foot out to the front corners.
  for (let y = y0; y <= y1; y++) {
    const d = (y - y0) / span; // 0 at the back, 1 at the front
    const xl = Math.round(back.l * (1 - d));
    const xr = Math.round(back.r + (L.w - back.r) * d);
    for (let x = xl; x < xr; x++) {
      // Darker right at the back (where the wall meets the bedding), dithered into the rest.
      const col = d < 0.1 ? deep : d < 0.22 ? ((x + y) % 2 ? shade : deep) : d < 0.34 ? ((x + y) % 2 ? base : shade) : base;
      out.set(x, y, col);
    }
  }
  // Shavings: little curls, tiny at the back and bigger at the front (depth).
  const count = Math.round((L.w * span) / 9);
  for (let k = 0; k < count; k++) {
    const d = Math.pow(hash(k * 1.31 + 7), 0.8);
    const y = Math.round(y0 + 1 + d * (span - 1));
    const xl = back.l * (1 - d);
    const xr = back.r + (L.w - back.r) * d;
    const x = Math.round(xl + hash(k * 7.77 + 1) * (xr - xl));
    const size = d < 0.35 ? 1 : d < 0.7 ? 2 : 3;
    const tone = hash(k * 3.3);
    const hi = tone < 0.5 ? light : base;
    const lo = tone < 0.5 ? shade : deep;
    if (size === 1) {
      out.set(x, y, tone < 0.5 ? light : shade);
      continue;
    }
    // A curl: a little arc, lit on top, with a shaded underside and an inked end.
    const flip = hash(k * 9.1) < 0.5 ? 1 : -1;
    for (let i = 0; i < size + 2; i++) {
      const ax = x + flip * (i - 1);
      const ay = y - (i > 0 && i < size + 1 ? 1 : 0);
      out.set(ax, ay, hi);
      out.set(ax, ay + 1, lo);
    }
    if (size === 3) out.set(x + flip * (size + 1), y + 1, ink);
  }
  // A few sunflower seeds dropped in the bedding (the hamster's snacks).
  const seed = pixel(c['--seed-body']);
  const stripe = pixel(c['--seed-stripe']);
  const seedInk = mixPixel(seed, pixel(c['--outline-ink']), 0.5);
  for (let k = 0; k < Math.round(L.w / 40); k++) {
    const d = 0.45 + hash(k * 5.9 + 2) * 0.5;
    const y = Math.round(y0 + d * span);
    const xl = back.l * (1 - d);
    const xr = back.r + (L.w - back.r) * d;
    const x = Math.round(xl + (0.05 + hash(k * 2.3 + 4) * 0.9) * (xr - xl));
    out.hline(x, x + 2, y, seedInk);
    out.hline(x, x + 2, y - 1, seed);
    out.set(x + 1, y - 1, stripe);
    out.set(x + 3, y, seedInk);
  }
  // Shadows where the wheel and the machine stand in the bedding: soft, dithered ovals.
  const sh = withAlpha(pixel(c['--bedding-ink']), 0.28);
  const sh2 = withAlpha(pixel(c['--bedding-ink']), 0.16);
  for (const s of standing) {
    const cx = s.x + s.w / 2;
    const cy = Math.min(y1 - 2, s.foot - 1);
    const rx = s.w / 2 + 4;
    const ry = Math.max(2, Math.min(6, span * 0.28));
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dd = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (dd > 1 || y < y0) continue;
        if (dd < 0.55) out.set(x, y, sh);
        else if ((x + y) % 2) out.set(x, y, sh2);
      }
    }
  }
}

// ── The front of the tray: glossy plastic, where the buttons sit ──
function paintTray(out: Pixmap, L: CageLayout, c: CageColors): void {
  const floor = pixel(c['--floor']);
  const dark = pixel(c['--floor-dark']);
  const light = mixPixel(floor, 0xffffffff, 0.45);
  const lighter = mixPixel(floor, 0xffffffff, 0.7);
  const deep = mixPixel(dark, pixel(c['--outline-ink']), 0.3);
  const y0 = L.floorT;
  const hgt = L.h - y0;
  if (hgt <= 0) return;
  for (let y = y0; y < L.h; y++) {
    const d = (y - y0) / Math.max(1, hgt);
    // The lip (lit), a shadow under it, then the plastic, darkening towards the bottom.
    let col = y - y0 < 2 ? light : y - y0 === 2 ? dark : d < 0.55 ? floor : d < 0.62 ? ((y % 2) ? floor : mixPixel(floor, dark, 0.35)) : mixPixel(floor, dark, 0.35);
    if (y === L.h - 1) col = deep;
    out.hline(0, L.w - 1, y, col);
  }
  out.hline(0, L.w - 1, y0, lighter);
  // A long, soft shine along the plastic (a highlight band, dithered at its ends).
  const sy = y0 + 4;
  const x0 = Math.round(L.w * 0.06);
  const x1 = Math.round(L.w * 0.94);
  for (let x = x0; x < x1; x++) {
    const endFade = Math.min(x - x0, x1 - x) / (L.w * 0.08);
    if (endFade < 1 && (x + sy) % 2) continue;
    out.set(x, sy, mixPixel(floor, 0xffffffff, 0.3));
  }
  // Moulded screw heads in the corners.
  for (const x of [4, L.w - 6]) {
    out.rect(x, y0 + 5, 2, 2, dark);
    out.set(x, y0 + 5, light);
  }
}

// ── Sunlight from the window: bands of warm light falling to the lower right ──
function paintSunlight(out: Pixmap, L: CageLayout, c: CageColors): void {
  if (!L.window) return;
  const sun = pixel(c['--sun-shaft']);
  const r = L.window;
  const slope = 0.9; // x moves this much for every pixel down
  const bands = [[0.08, 0.34, 0.16], [0.46, 0.78, 0.12]]; // [from, to] across the window's width, and strength
  for (let y = r.y + 2; y < L.floorT; y++) {
    const dy = y - (r.y + r.h / 2);
    if (dy < 0) continue;
    const fade = 1 - dy / (L.floorT - r.y); // it fades as it falls
    for (const [a, b, k] of bands) {
      const xa = r.x + r.w * a + dy * slope;
      const xb = r.x + r.w * b + dy * slope * 1.08;
      for (let x = Math.floor(xa); x < xb; x++) {
        if (!out.inside(x, y)) continue;
        const i = y * L.w + x;
        if (!(out.data[i] >>> 24)) continue;
        const edge = x - xa < 1.5 || xb - x < 1.5;
        if (edge && (x + y) % 2) continue; // dithered edges
        out.data[i] = mixPixel(out.data[i], sun, k * (0.4 + 0.6 * fade));
      }
    }
  }
}

// mix() for two CSS colours, giving a CSS colour back (for building a ramp from one colour).
function mixHex(a: string, b: string, t: number): string {
  const p = mixPixel(pixel(a), pixel(b), t);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(p & 0xff)}${hex((p >>> 8) & 0xff)}${hex((p >>> 16) & 0xff)}`;
}

// ─────────────────────── the view outside the window ───────────────────────

// The sky, clouds and hills outside, painted once as a strip wider than the window
// (the clouds are a strip of their own, so CSS can drift them across).
export function paintView(w: number, h: number, c: CageColors, night: boolean): Pixmap {
  const out = new Pixmap(w, h);
  const top = pixel(night ? c['--night-sky-top'] : c['--sky-top']);
  const bottom = pixel(night ? c['--night-sky-bottom'] : c['--sky-bottom']);
  for (let y = 0; y < h; y++) {
    const f = y / h;
    const band = Math.min(3, Math.floor(f * 4));
    const edge = (f * 4) % 1 > 0.8 && (y % 2);
    for (let x = 0; x < w; x++) out.data[y * w + x] = mixPixel(top, bottom, Math.min(1, (band + (edge && x % 2 ? 1 : 0)) / 3));
  }
  if (night) {
    // Stars (a few twinkle brighter), and the moon.
    const star = pixel(c['--star']);
    for (let k = 0; k < (w * h) / 40; k++) {
      const x = Math.floor(hash(k * 3.1) * w);
      const y = Math.floor(hash(k * 7.3) * h * 0.7);
      out.set(x, y, hash(k) > 0.8 ? star : withAlpha(star, 0.55));
    }
    const moon = pixel(c['--moon']);
    out.ellipse(w * 0.7, h * 0.25, 4.5, 4.5, moon);
    out.ellipse(w * 0.7 + 2, h * 0.25 - 1, 3.6, 3.6, top); // a crescent
  } else {
    // The sun peeking in at the top.
    out.ellipse(w * 0.78, h * 0.18, 5, 5, pixel(c['--sun-shaft']));
  }
  // Hills, and a round tree on the nearer one.
  const far = pixel(c['--hill-far']);
  const near = pixel(c['--hill-near']);
  const dim = night ? pixel(c['--night']) : 0;
  const tone = (p: Pixel) => (night ? mixPixel(p, dim, 0.6) : p);
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const yf = Math.round(h * (0.62 - 0.08 * Math.sin(t * Math.PI * 2.2 + 0.6)));
    const yn = Math.round(h * (0.76 - 0.06 * Math.sin(t * Math.PI * 3.1 + 2)));
    for (let y = yf; y < h; y++) out.set(x, y, tone(far));
    for (let y = yn; y < h; y++) out.set(x, y, tone(near));
  }
  const tree = { x: w * 0.3, y: h * 0.62 };
  const leaf = ramp(c['--leaf'], c['--leaf-dark'], c['--leaf-ink'], c['--leaf-light']);
  const tm = new Mask(16, 16);
  tm.ball(8, 7, 6, 5.5);
  const trunk = pixel(c['--wood-dark']);
  out.rect(tree.x - 1, tree.y + 2, 2, 6, tone(trunk));
  const tp = new Pixmap(18, 18);
  paintMask(tp, tm, night ? { ...leaf, hilite: tone(leaf.hilite), light: tone(leaf.light), base: tone(leaf.base), shade: tone(leaf.shade), deep: tone(leaf.deep), ink: tone(leaf.ink) } : leaf, 1, 1);
  out.draw(tp, Math.round(tree.x - 9), Math.round(tree.y - 11));
  return out;
}

// A strip of clouds on a see-through background (it tiles side by side).
export function paintClouds(w: number, h: number, c: CageColors, night: boolean): Pixmap {
  const out = new Pixmap(w, h);
  const cloud = pixel(night ? c['--cloud-shade'] : c['--cloud']);
  const under = pixel(c['--cloud-shade']);
  const dimmed = (p: Pixel) => (night ? withAlpha(mixPixel(p, pixel(c['--night']), 0.55), 0.8) : p);
  for (let k = 0; k < 3; k++) {
    const cx = w * (0.15 + k * 0.33) + hash(k * 4) * 6;
    const cy = h * (0.25 + hash(k * 2.2) * 0.3);
    const s = 3 + hash(k * 9) * 2.5;
    const bottom = cy + s * 0.6;
    for (let p = 0; p < 4; p++) {
      const px = cx + (p - 1.5) * s * 0.95;
      const py = cy - (p === 1 || p === 2 ? s * 0.5 : 0);
      const r = s * (p === 1 || p === 2 ? 1 : 0.72);
      for (let y = Math.floor(py - r); y <= bottom; y++) {
        for (let x = Math.floor(px - r); x <= px + r; x++) {
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > r) continue;
          const xx = ((x % w) + w) % w;
          out.set(xx, y, dimmed(y > bottom - 1.5 ? under : cloud));
        }
      }
    }
  }
  return out;
}

// ─────────────────────── on the page ───────────────────────

// The painting behind the stage: a canvas (day), a second one (night, faded in during
// free spins), and the sky behind the window. ui.ts calls render() every frame; it only
// repaints when invalidate() was called (a resize, a skin, the machine moving).
export function createCageScene(stage: HTMLElement, parts: { wall: HTMLElement; floor: HTMLElement; standing: () => HTMLElement[] }) {
  const sky = document.createElement('div');
  sky.className = 'cage-sky';
  sky.innerHTML = '<div class="cage-sky-view"></div><div class="cage-sky-clouds"></div>';
  const day = document.createElement('canvas');
  day.className = 'cage-canvas';
  const night = document.createElement('canvas');
  night.className = 'cage-canvas cage-night';
  stage.prepend(sky, day, night);
  let dirty = true;
  let nightOn = false;
  let nightPainted = false;
  let lastLayout: CageLayout | null = null;
  let lastColors: CageColors | null = null;
  let dayPix: Pixmap | null = null;
  new ResizeObserver(() => { dirty = true; }).observe(stage);

  const toURL = (p: Pixmap) => {
    const cv = document.createElement('canvas');
    p.toCanvas(cv);
    return cv.toDataURL();
  };

  function paintSky(L: CageLayout, colors: CageColors, isNight: boolean): void {
    if (!L.window) {
      sky.classList.add('hidden');
      return;
    }
    sky.classList.remove('hidden');
    const r = L.window;
    sky.style.left = `${r.x * CAGE_PX}px`;
    sky.style.top = `${r.y * CAGE_PX}px`;
    sky.style.width = `${r.w * CAGE_PX}px`;
    sky.style.height = `${r.h * CAGE_PX}px`;
    const view = paintView(r.w, r.h, colors, isNight);
    const clouds = paintClouds(r.w * 2, Math.max(8, Math.round(r.h * 0.5)), colors, isNight);
    const v = sky.firstElementChild as HTMLElement;
    const cl = sky.lastElementChild as HTMLElement;
    v.style.backgroundImage = `url("${toURL(view)}")`;
    v.style.backgroundSize = `${r.w * CAGE_PX}px ${r.h * CAGE_PX}px`;
    cl.style.backgroundImage = `url("${toURL(clouds)}")`;
    cl.style.backgroundSize = `${clouds.w * CAGE_PX}px ${clouds.h * CAGE_PX}px`;
    cl.style.setProperty('--drift', `${clouds.w * CAGE_PX}px`);
  }

  function repaint(): void {
    dirty = false;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    const sr = stage.getBoundingClientRect();
    const wallBottom = parts.wall.offsetTop + parts.wall.offsetHeight;
    const L = cageLayout(W, H, wallBottom, parts.floor.offsetTop);
    const colors = readTokens(stage, CAGE_TOKENS);
    // Where the wheel and the machine stand (for their shadows in the bedding).
    const standing: Standing[] = parts.standing().map((el) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - sr.left) / CAGE_PX, w: r.width / CAGE_PX, foot: (r.bottom - sr.top) / CAGE_PX };
    }).filter((s) => s.w > 0);
    dayPix = paintCage(L, colors, standing);
    dayPix.toCanvas(day);
    for (const cv of [day, night]) {
      cv.style.width = `${L.w * CAGE_PX}px`;
      cv.style.height = `${L.h * CAGE_PX}px`;
    }
    lastLayout = L;
    lastColors = colors;
    nightPainted = false;
    paintSky(L, colors, nightOn);
    if (nightOn) paintNight();
  }

  function paintNight(): void {
    if (!dayPix || !lastLayout || !lastColors || nightPainted) return;
    nightOf(dayPix, lastLayout, lastColors).toCanvas(night);
    nightPainted = true;
  }

  return {
    invalidate() { dirty = true; },
    // Free spins: the room at night (the painting fades over, the window's sky turns dark).
    setNight(on: boolean) {
      if (on === nightOn) return;
      nightOn = on;
      if (on) paintNight();
      stage.classList.toggle('night', on);
      if (lastLayout && lastColors) paintSky(lastLayout, lastColors, on);
    },
    render() {
      if (dirty) repaint();
    },
  };
}
