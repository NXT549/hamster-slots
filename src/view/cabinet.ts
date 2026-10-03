// cabinet.ts — VIEW layer. The slot machines' cabinets, painted as pixel art
// (1.5.0, "The Glow Up"), behind the reels, the sign and the WIN meter.
//
// A machine's size depends on what's in it (2 to 5 reels, one row or three, the
// jackpot pots …), so its cabinet can't be a fixed sprite: it's painted to fit, on
// a small canvas inside the machine (2 screen pixels per painted pixel, like a
// sprite at 2×). Every machine has its own material and details:
//   Old Clunky      mint plastic, a chrome-rimmed window, bolts, speaker grilles, feet
//   Snack Stacker   a strawberry-milk vending machine under a striped awning
//   Burrow Bonanza  wooden planks, grass on the roof, a mushroom and roots
//   Pouch Palace    quilted purple velvet, gold trim and a crown on top
//   Hamster Maze    a clipped hedge with maze paths and two topiary balls
//   Acorn Vault     brushed steel, rivets and a gold combination dial on top
//   The Big Cheese  a block of cheese full of holes, with an orange rind
//   Moving Day      a cardboard box, taped up, its flaps open on top
// Around the sign there are real light bulbs: they chase slowly at rest, race while
// the reels spin and all flash on a win (drawn every frame on a second, see-through
// canvas, so the cabinet itself is only painted when its size or skin changes).
// Colours are theme tokens (CABINET_TOKENS); a machine skin repaints every machine (painted()).

import { Pixmap, Mask, pixel, mixPixel, withAlpha, hash, readTokens, ramp, paintMask, HILITE, LIGHT, BASE, SHADE, DEEP } from './paint.ts';
import type { Pixel, Ramp } from './paint.ts';

export const CABINET_TOKENS = [
  '--outline-ink', '--gold', '--gold-dark', '--chrome', '--chrome-light', '--chrome-dark', '--bulb-on', '--bulb-off', '--lcd',
  '--machine', '--machine-dark', '--stacker', '--stacker-dark', '--stacker-light',
  '--bonanza', '--bonanza-dark', '--bonanza-light', '--bonanza-grass', '--bonanza-grass-dark',
  '--palace', '--palace-dark', '--palace-light', '--palace-gold',
  '--maze', '--maze-dark', '--maze-light', '--maze-path',
  '--vault', '--vault-dark', '--vault-light', '--vault-rivet',
  '--cheese', '--cheese-dark', '--cheese-light', '--cheese-rind', '--cheese-rind-dark',
  '--box', '--box-dark', '--box-light', '--box-tape', '--box-label',
  '--danger', '--danger-dark', '--primary', '--leaf-light', '--pot', '--soil', '--soil-dark',
  '--paint', '--paint-dark', '--paint-light',
] as const;
export type CabinetColors = Record<(typeof CABINET_TOKENS)[number], string>;

export const CAB_PX = 2; // screen pixels per painted pixel
const PAD_X = 10; // painted pixels of room around the machine for decorations…
const PAD_TOP = 18; // …above it (an awning, a crown, grass, box flaps)
const PAD_BOTTOM = 4;

export interface Rect { x: number; y: number; w: number; h: number }
// The machine and the parts the painting frames, in the machine's own screen pixels.
export interface CabinetParts { w: number; h: number; sign: Rect | null; window: Rect | null; meter: Rect | null; lever: Rect | null }
export interface Bulb { x: number; y: number }
// left/top: where the canvas sits (screen px); halo: the pixels round the body, 2, 3 and 4 away
// from it (the free-spins glow is drawn on them).
export interface Cabinet { pix: Pixmap; bulbs: Bulb[]; halo: Bulb[][]; left: number; top: number }

// How each machine is built: its body's corner radii (painted pixels) and its plinth.
const SHAPES: Record<string, { rt: number; rb: number; plinth: number }> = {
  clunky: { rt: 15, rb: 6, plinth: 5 }, stacker: { rt: 6, rb: 4, plinth: 5 }, bonanza: { rt: 20, rb: 6, plinth: 5 },
  palace: { rt: 12, rb: 6, plinth: 5 }, maze: { rt: 9, rb: 6, plinth: 5 }, vault: { rt: 5, rb: 5, plinth: 5 },
  cheese: { rt: 12, rb: 6, plinth: 5 }, moving: { rt: 2, rb: 2, plinth: 4 },
};

// A body shape: a rounded box, shaded like a bevel (lit top-left, shaded bottom-right), a
// darker plinth along the bottom, and a gloss stripe down the left (plastic and metal).
function bodyMask(w: number, h: number, rt: number, rb: number, plinth: number, gloss: boolean): Mask {
  const m = new Mask(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rounded corners: skip pixels outside the corner circles.
      const r = y < rt ? rt : y >= h - rb ? rb : 0;
      if (r) {
        const cy = y < rt ? rt : h - rb - 1;
        const cx = x < r ? r : x >= w - r ? w - r - 1 : x;
        if (x < r || x >= w - r) {
          const dx = x + 0.5 - (x < r ? r : w - r);
          const dy = y + 0.5 - (y < rt ? rt : h - rb);
          if (dx * dx + dy * dy > r * r) continue;
        }
        void cx; void cy;
      }
      const fromBottom = h - 1 - y;
      const fromRight = w - 1 - x;
      let v = BASE;
      if (fromBottom < plinth) v = fromBottom === 0 ? DEEP : fromBottom === plinth - 1 ? LIGHT : SHADE;
      else if (x < 2 || y < 2) v = LIGHT;
      else if (fromRight < 3) v = fromRight === 0 ? DEEP : SHADE;
      else if (gloss && x === 4 && y > rt * 0.6 + 2 && fromBottom > plinth + 5) v = HILITE;
      else if (gloss && x === 5 && y > rt * 0.6 + 6 && fromBottom > plinth + 12 && y % 3 !== 0) v = LIGHT;
      m.put(x, y, v);
    }
  }
  return m;
}

// A frame (bezel) around a rectangle: raised, lit top-left, shaded bottom-right, inked outside.
function bezel(out: Pixmap, r: Rect, t: Ramp, thick = 2): void {
  const x0 = r.x - thick;
  const y0 = r.y - thick;
  const x1 = r.x + r.w + thick - 1;
  const y1 = r.y + r.h + thick - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      if (inside) continue;
      const lit = x - x0 < thick && y - y0 < thick ? true : x1 - x < thick || y1 - y < thick ? false : x - x0 < thick || y - y0 < thick;
      const edgeOuter = x === x0 || y === y0 || x === x1 || y === y1;
      out.set(x, y, edgeOuter ? (lit ? t.base : t.deep) : lit ? t.light : t.shade);
    }
  }
  // The ink line around it, and the inner lip (the window sits a little deeper).
  out.hline(x0 - 1, x1 + 1, y0 - 1, t.ink);
  out.hline(x0 - 1, x1 + 1, y1 + 1, t.ink);
  out.vline(x0 - 1, y0, y1, t.ink);
  out.vline(x1 + 1, y0, y1, t.ink);
  out.set(x0, y0, t.hilite);
}

// Screws and rivets: a little shaded dot.
function rivet(out: Pixmap, x: number, y: number, t: Ramp): void {
  out.set(x, y, t.light);
  out.set(x + 1, y, t.base);
  out.set(x, y + 1, t.shade);
  out.set(x + 1, y + 1, t.deep);
}

// Horizontal slots of a speaker grille.
function grille(out: Pixmap, x: number, y: number, w: number, rows: number, dark: Pixel, lit: Pixel): void {
  for (let k = 0; k < rows; k++) {
    out.hline(x, x + w - 1, y + k * 2, dark);
    out.hline(x + 1, x + w - 1, y + k * 2 + 1, lit);
  }
}

// Paint the cabinet of machine `id` for these parts. The result is placed at (left, top)
// in the machine's own screen pixels (it reaches past the machine for the decorations).
// A worn machine skin (1.6.1) sets --paint (else it's "none"): every machine's body
// colours (base, dark, light) become the skin's paint. Swapping the tokens, rather than
// adding a skin case to every painter, means the trims and knobs made from a body
// colour follow it, while each machine's own details (grass, rind, tape, gold) stay.
const BODIES = ['--machine', '--stacker', '--bonanza', '--palace', '--maze', '--vault', '--cheese', '--box'] as const;
export function painted(c: CabinetColors): CabinetColors {
  if (!c['--paint'] || c['--paint'] === 'none') return c;
  const out = { ...c };
  for (const b of BODIES) {
    out[b] = c['--paint'];
    out[`${b}-dark` as keyof CabinetColors] = c['--paint-dark'];
    if (`${b}-light` in out) out[`${b}-light` as keyof CabinetColors] = c['--paint-light'];
  }
  return out;
}

export function paintCabinet(id: string, P: CabinetParts, colors: CabinetColors, starred = false): Cabinet {
  const c = painted(colors);
  const s = (v: number) => Math.round(v / CAB_PX);
  const W = s(P.w);
  const H = s(P.h);
  const out = new Pixmap(W + PAD_X * 2, H + PAD_TOP + PAD_BOTTOM);
  const ox = PAD_X;
  const oy = PAD_TOP;
  const toArt = (r: Rect | null): Rect | null => (r ? { x: ox + s(r.x), y: oy + s(r.y), w: s(r.w), h: s(r.h) } : null);
  const sign = toArt(P.sign);
  const win = toArt(P.window);
  const meter = toArt(P.meter);
  const lever = toArt(P.lever);
  const ink = pixel(c['--outline-ink']);
  const chrome = ramp(c['--chrome'], c['--chrome-dark'], c['--outline-ink'], c['--chrome-light']);
  const gold = ramp(c['--gold'], c['--gold-dark'], c['--outline-ink']);
  const shape = SHAPES[id] || SHAPES.clunky;
  const T = (base: string, dark: string, light?: string) => ramp(base, dark, mixCss(dark, c['--outline-ink'], 0.55), light);

  // Each machine's materials: its body and its trim.
  const looks: Record<string, { body: Ramp; trim: Ramp; gloss: boolean }> = {
    clunky: { body: T(c['--machine'], c['--machine-dark']), trim: chrome, gloss: true },
    stacker: { body: T(c['--stacker'], c['--stacker-dark'], c['--stacker-light']), trim: T(c['--stacker-light'], c['--stacker']), gloss: true },
    bonanza: { body: T(c['--bonanza'], c['--bonanza-dark'], c['--bonanza-light']), trim: T(c['--bonanza-dark'], mixCss(c['--bonanza-dark'], c['--outline-ink'], 0.3)), gloss: false },
    palace: { body: T(c['--palace'], c['--palace-dark'], c['--palace-light']), trim: T(c['--palace-gold'], c['--gold-dark']), gloss: false },
    maze: { body: T(c['--maze'], c['--maze-dark'], c['--maze-light']), trim: T(c['--maze-dark'], mixCss(c['--maze-dark'], c['--outline-ink'], 0.3)), gloss: false },
    vault: { body: T(c['--vault'], c['--vault-dark'], c['--vault-light']), trim: gold, gloss: true },
    cheese: { body: T(c['--cheese'], c['--cheese-dark'], c['--cheese-light']), trim: T(c['--cheese-rind'], c['--cheese-rind-dark']), gloss: false },
    moving: { body: T(c['--box'], c['--box-dark'], c['--box-light']), trim: T(c['--box-dark'], mixCss(c['--box-dark'], c['--outline-ink'], 0.3)), gloss: false },
  };
  const look = looks[id] || looks.clunky;
  // A machine with a Machine Star (M8) is trimmed in gold: its outline turns gold.
  const body = starred ? { ...look.body, ink: pixel(c['--gold-dark']) } : look.body;

  // Things behind the body (feet, the vault's dial, the box's flaps …).
  if (id === 'moving') paintFlaps(out, ox, oy, W, body);
  // Little feet under the plinth.
  if (id !== 'bonanza' && id !== 'moving') {
    for (const fx of [ox + 3, ox + W - 9]) {
      const foot = new Mask(6, 3);
      foot.box(0, 0, 6, 3, 1);
      paintMask(out, foot, T(mixCss(c['--outline-ink'], '#ffffff', 0.25), c['--outline-ink']), fx, oy + H - 1);
    }
  }

  // The body.
  const bm = bodyMask(W, H, shape.rt, shape.rb, shape.plinth, look.gloss);
  paintMask(out, bm, body, ox, oy);
  const inside = (x: number, y: number) => bm.at(x - ox, y - oy) !== 0;

  // Its surface: every material has its own texture (never under the window or the sign).
  const clear = (x: number, y: number, pad = 2) => [sign, win, meter].every((r) => !r || x < r.x - pad || x >= r.x + r.w + pad || y < r.y - pad || y >= r.y + r.h + pad);
  const flat = (x: number, y: number) => bm.at(x - ox, y - oy) === BASE;
  if (id === 'bonanza') {
    // Planks: a line every 6 pixels, with nail heads and a little grain.
    for (let y = oy + 6; y < oy + H - shape.plinth; y += 6) {
      for (let x = ox; x < ox + W; x++) if (inside(x, y) && flat(x, y) && clear(x, y, 1)) out.set(x, y, body.shade);
      for (const nx of [ox + 4, ox + W - 6]) if (inside(nx, y + 2) && clear(nx, y + 2)) rivet(out, nx, y + 2, look.trim);
    }
    for (let k = 0; k < (W * H) / 30; k++) {
      const x = ox + Math.floor(hash(k * 1.7) * W);
      const y = oy + Math.floor(hash(k * 3.1) * H);
      if (inside(x, y) && flat(x, y) && clear(x, y) && flat(x + 2, y)) out.hline(x, x + 2, y, mixPixel(body.base, body.shade, 0.5));
    }
  } else if (id === 'palace') {
    // Quilted velvet: diagonal seams in a diamond lattice, a gold button where they cross.
    for (let y = oy + 3; y < oy + H - shape.plinth; y++) {
      for (let x = ox + 3; x < ox + W - 3; x++) {
        if (!flat(x, y) || !clear(x, y)) continue;
        const a = (x - ox + y - oy) % 10;
        const b = (x - ox - (y - oy) + 1000) % 10;
        if (a === 0 && b === 0) out.set(x, y, gold.base);
        else if (a === 0 || b === 0) out.set(x, y, body.shade);
        else if (a === 1 || b === 9) out.set(x, y, mixPixel(body.base, body.light, 0.5));
      }
    }
    // A gold border just inside the edge.
    for (let y = oy; y < oy + H; y++) {
      for (let x = ox; x < ox + W; x++) {
        const v = bm.at(x - ox, y - oy);
        if (!v || y > oy + H - shape.plinth - 1) continue;
        const near3 = [1, 2, 3].some((d) => !bm.at(x - ox - d, y - oy) || !bm.at(x - ox + d, y - oy) || !bm.at(x - ox, y - oy - d));
        const near2 = [1, 2].some((d) => !bm.at(x - ox - d, y - oy) || !bm.at(x - ox + d, y - oy) || !bm.at(x - ox, y - oy - d));
        if (near3 && !near2) out.set(x, y, gold.base);
      }
    }
  } else if (id === 'maze') {
    // A clipped hedge: leafy speckles, and tan maze paths on the sides.
    for (let y = oy; y < oy + H - shape.plinth; y++) {
      for (let x = ox; x < ox + W; x++) {
        if (!flat(x, y)) continue;
        const n = hash(x * 13.1 + y * 7.7);
        if (n < 0.06) out.set(x, y, body.light);
        else if (n > 0.95) out.set(x, y, body.shade);
      }
    }
    const path = ramp(c['--maze-path'], mixCss(c['--maze-path'], c['--maze-dark'], 0.35), c['--maze-dark']);
    for (let y = oy + 6; y < oy + H - shape.plinth - 3; y += 8) {
      for (let x = ox + 3; x < ox + W - 3; x++) {
        if (!clear(x, y, 3) || !inside(x, y)) continue;
        const cellX = Math.floor((x - ox) / 8);
        const gap = hash(cellX * 3 + y) < 0.3;
        if (!gap) { out.set(x, y, path.base); out.set(x, y + 1, path.shade); }
        if ((x - ox) % 8 === 0 && hash(cellX + y * 2) < 0.55) { out.vline(x, y, y + 7, path.base); out.vline(x + 1, y + 1, y + 7, path.shade); }
      }
    }
  } else if (id === 'vault') {
    // Brushed steel: faint horizontal streaks, and rivets all round the edge.
    for (let y = oy + 2; y < oy + H - shape.plinth; y++) {
      if (hash(y * 3.7) < 0.45) continue;
      for (let x = ox + 3; x < ox + W - 3; x++) {
        if (flat(x, y) && hash(x * 0.37 + y * 11) > 0.3) out.set(x, y, hash(y) > 0.5 ? body.light : mixPixel(body.base, body.shade, 0.4));
      }
    }
    for (let x = ox + 5; x < ox + W - 5; x += 8) { rivet(out, x, oy + 3, look.trim); rivet(out, x, oy + H - shape.plinth - 3, look.trim); }
    for (let y = oy + 10; y < oy + H - shape.plinth - 6; y += 8) { rivet(out, ox + 3, y, look.trim); rivet(out, ox + W - 5, y, look.trim); }
  } else if (id === 'cheese') {
    // Holes: shaded dents, some cut off by the edge.
    for (let k = 0; k < 26; k++) {
      const r = 2 + hash(k * 2.3) * 3.2;
      const x = ox + 2 + hash(k * 5.1) * (W - 4);
      const y = oy + 8 + hash(k * 7.9) * (H - shape.plinth - 10);
      if (!clear(Math.round(x), Math.round(y), Math.ceil(r) + 2)) continue;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
        for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
          const d = Math.hypot(xx + 0.5 - x, (yy + 0.5 - y) * 1.1);
          if (d > r || !inside(xx, yy) || bm.at(xx - ox, yy - oy) === SHADE || bm.at(xx - ox, yy - oy) === DEEP) continue;
          // A hole is dark at the top-left (in shadow) and lit at its bottom-right rim.
          const lit = (xx + 0.5 - x) + (yy + 0.5 - y) > r * 0.6;
          out.set(xx, yy, d > r - 1 && lit ? body.light : d < r * 0.55 ? body.deep : body.shade);
        }
      }
    }
    // The rind along the top: orange, with a darker edge.
    const rind = ramp(c['--cheese-rind'], c['--cheese-rind-dark'], mixCss(c['--cheese-rind-dark'], c['--outline-ink'], 0.4));
    for (let y = oy; y < oy + 5; y++) {
      for (let x = ox; x < ox + W; x++) {
        if (!inside(x, y)) continue;
        out.set(x, y, y === oy + 4 ? rind.shade : y === oy ? rind.light : (x + y) % 5 === 0 ? rind.shade : rind.base);
      }
    }
  } else if (id === 'moving') {
    // Cardboard: fine corrugation lines, packing tape up the middle of the top, a label and arrows.
    for (let x = ox + 3; x < ox + W - 3; x += 3) {
      for (let y = oy + 2; y < oy + H - shape.plinth; y++) if (flat(x, y) && clear(x, y) && (y + x) % 4) out.set(x, y, mixPixel(body.base, body.shade, 0.35));
    }
    const tape = ramp(c['--box-tape'], mixCss(c['--box-tape'], c['--outline-ink'], 0.25), mixCss(c['--box-tape'], c['--outline-ink'], 0.5));
    const tw = 10;
    for (let y = oy; y < oy + Math.max(6, (sign ? sign.y - oy - 2 : 8)); y++) {
      for (let x = ox + Math.round(W / 2 - tw / 2); x < ox + Math.round(W / 2 + tw / 2); x++) {
        if (!inside(x, y)) continue;
        out.set(x, y, x === ox + Math.round(W / 2 - tw / 2) ? tape.light : (x + y) % 7 === 0 ? tape.shade : tape.base);
      }
    }
    // "This way up" arrows on the side.
    for (const ax of [ox + 5, ox + W - 10]) {
      const ay = oy + Math.round(H * 0.55);
      if (!clear(ax + 2, ay, 3)) continue;
      out.vline(ax + 2, ay, ay + 5, ink);
      out.hline(ax + 1, ax + 3, ay + 1, ink);
      out.hline(ax, ax + 4, ay + 2, ink);
    }
  } else if (id === 'stacker') {
    // Candy stripes down the sides, and a strawberry sticker.
    for (let y = oy + 2; y < oy + H - shape.plinth; y++) {
      for (let x = ox + 2; x < ox + W - 3; x++) {
        if (!flat(x, y) || !clear(x, y, 3)) continue;
        if ((x - ox + y - oy) % 12 === 0) out.set(x, y, mixPixel(body.base, body.light, 0.6));
      }
    }
  } else {
    // Old Clunky: bolts in the corners.
    for (const [bx, by] of [[ox + 4, oy + shape.rt], [ox + W - 6, oy + shape.rt], [ox + 4, oy + H - shape.plinth - 4], [ox + W - 6, oy + H - shape.plinth - 4]]) {
      rivet(out, bx, by, chrome);
    }
  }

  // The reel window's bezel, the sign's board and the WIN meter's housing.
  const trim = look.trim;
  if (win) bezel(out, { x: win.x, y: win.y, w: win.w, h: win.h }, trim, id === 'bonanza' ? 3 : 2);
  const bulbs: Bulb[] = [];
  if (sign) {
    // The sign sits on a board with a row of bulbs all round it.
    const board = { x: sign.x - 3, y: sign.y - 3, w: sign.w + 6, h: sign.h + 6 };
    const bmk = new Mask(board.w, board.h);
    bmk.box(0, 0, board.w, board.h, 1);
    paintMask(out, bmk, T(mixCss(c['--outline-ink'], '#ffffff', 0.12), c['--outline-ink']), board.x, board.y);
    for (let x = board.x + 2; x < board.x + board.w - 2; x += 4) { bulbs.push({ x, y: board.y + 1 }); bulbs.push({ x, y: board.y + board.h - 2 }); }
    for (let y = board.y + 5; y < board.y + board.h - 4; y += 4) { bulbs.push({ x: board.x + 1, y }); bulbs.push({ x: board.x + board.w - 2, y }); }
  }
  if (meter) {
    bezel(out, meter, trim, 1);
    // Speaker grilles either side of the meter, where there's room.
    const room = (meter.x - ox - 6);
    if (room >= 8 && (id === 'clunky' || id === 'vault' || id === 'stacker')) {
      const gw = Math.min(10, room - 2);
      grille(out, meter.x - 4 - gw, meter.y, gw, Math.max(1, Math.floor(meter.h / 2)), body.deep, body.light);
      grille(out, meter.x + meter.w + 4, meter.y, gw, Math.max(1, Math.floor(meter.h / 2)), body.deep, body.light);
    }
  }
  // The coin tray at the bottom: a dark opening with a chrome lip, a few coins in it.
  const trayW = Math.min(34, Math.round(W * 0.34));
  const tx = ox + Math.round(W / 2 - trayW / 2);
  const ty = oy + H - shape.plinth - 5;
  out.rect(tx, ty, trayW, 4, ink);
  out.rect(tx + 1, ty + 1, trayW - 2, 3, mixPixel(ink, 0xff000000, 0.35));
  out.hline(tx - 1, tx + trayW, ty - 1, trim.light);
  out.hline(tx - 1, tx + trayW, ty + 4, trim.shade);
  for (let k = 0; k < 3; k++) {
    const cx = tx + 4 + Math.round(hash(k * 3.3 + W) * (trayW - 8));
    out.hline(cx, cx + 2, ty + 3, gold.base);
    out.set(cx + 1, ty + 2, gold.light);
  }
  // Where the lever joins the cabinet: a chrome plate with a bolt.
  if (lever) {
    const lx = ox + W - 2;
    const ly = lever.y + lever.h - 7;
    const plate = new Mask(5, 9);
    plate.box(0, 0, 5, 9, 1);
    paintMask(out, plate, chrome, lx, ly);
    rivet(out, lx + 1, ly + 3, chrome);
  }

  // Decorations on top.
  if (id === 'stacker') paintAwning(out, ox, oy, W, body, c);
  if (id === 'bonanza') paintGrassRoof(out, ox, oy, W, H, bm, c);
  if (id === 'palace') paintCrown(out, ox + W / 2, oy, gold, c);
  if (id === 'maze') { paintTopiary(out, ox + 5, oy + 2, body); paintTopiary(out, ox + W - 6, oy + 2, body); }
  if (id === 'vault') paintDial(out, ox + W / 2, oy - 1, gold, chrome);
  if (id === 'clunky') paintClunkyTop(out, ox + W / 2, oy, chrome, c);
  if (id === 'cheese') paintMouseHole(out, ox + 6, oy + H - shape.plinth, ink, body);

  // The halo round the body (for the free-spins glow): the rings of pixels 2, 3 and 4 away.
  const dist = new Uint8Array(out.w * out.h);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (bm.at(x - ox, y - oy)) dist[y * out.w + x] = 1;
  const halo: Bulb[][] = [[], [], []];
  for (let d = 2; d <= 4; d++) {
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const i = y * out.w + x;
        if (dist[i]) continue;
        const near = (x > 0 && dist[i - 1] === d - 1) || (x < out.w - 1 && dist[i + 1] === d - 1)
          || (y > 0 && dist[i - out.w] === d - 1) || (y < out.h - 1 && dist[i + out.w] === d - 1);
        if (near) { dist[i] = d; halo[d - 2].push({ x, y }); }
      }
    }
  }
  return { pix: out, bulbs, halo, left: -PAD_X * CAB_PX, top: -PAD_TOP * CAB_PX };
}

// A striped awning over the Snack Stacker: scalloped at the bottom.
function paintAwning(out: Pixmap, ox: number, oy: number, W: number, body: Ramp, c: CabinetColors): void {
  const x0 = ox - 3;
  const x1 = ox + W + 2;
  const top = oy - 7;
  const white = ramp('#fffdf8', mixCss('#fffdf8', c['--stacker'], 0.35), c['--stacker-dark']);
  for (let y = top; y < oy + 3; y++) {
    for (let x = x0; x <= x1; x++) {
      const stripe = Math.floor((x - x0) / 5) % 2 === 0;
      const scallop = y >= oy + 1 && Math.abs(((x - x0) % 5) - 2) >= (y === oy + 1 ? 2 : 1);
      if (scallop) continue;
      const r = stripe ? body : white;
      out.set(x, y, y === top ? r.light : y === oy + 2 || y === oy + 1 ? r.shade : r.base);
    }
  }
  out.hline(x0 - 1, x1 + 1, top - 1, body.ink);
  out.vline(x0 - 1, top, oy + 1, body.ink);
  out.vline(x1 + 1, top, oy + 1, body.ink);
  // Its little rod ends.
  out.rect(x0 - 2, top + 1, 2, 2, body.deep);
  out.rect(x1 + 1, top + 1, 2, 2, body.deep);
}

// Grass and a dirt mound on the Burrow Bonanza's roof, with a mushroom by its foot.
function paintGrassRoof(out: Pixmap, ox: number, oy: number, W: number, H: number, bm: Mask, c: CabinetColors): void {
  const grass = ramp(c['--bonanza-grass'], c['--bonanza-grass-dark'], mixCss(c['--bonanza-grass-dark'], c['--outline-ink'], 0.4), c['--leaf-light']);
  for (let x = ox - 2; x < ox + W + 2; x++) {
    // The top edge of the body at this column.
    let edge = oy;
    while (edge < oy + H && !bm.at(x - ox, edge - oy)) edge++;
    if (edge >= oy + H) edge = oy + 20;
    const tuft = 2 + Math.round(hash(x * 1.9) * 3) + (x % 3 === 0 ? 2 : 0);
    for (let y = edge - tuft; y < edge + 3; y++) {
      const v = y < edge - tuft + 1 ? grass.light : y > edge ? grass.shade : grass.base;
      out.set(x, y, v);
    }
    out.set(x, edge - tuft - 1, grass.ink);
  }
  // A mushroom at the bottom left.
  const mx = ox - 3;
  const my = oy + H - 7;
  const cap = ramp(c['--danger'], c['--danger-dark'], mixCss(c['--danger-dark'], c['--outline-ink'], 0.5));
  const cm = new Mask(8, 4);
  cm.ball(4, 4, 4, 4, { spot: false });
  paintMask(out, cm, cap, mx, my - 2);
  out.set(mx + 2, my - 1, 0xffffffff);
  out.set(mx + 5, my, 0xffffffff);
  out.rect(mx + 3, my + 2, 2, 4, pixel('#fdf5ec'));
  out.vline(mx + 2, my + 2, my + 5, mixPixel(pixel('#fdf5ec'), pixel(c['--outline-ink']), 0.4));
}

// A gold crown on the Pouch Palace, with a jewel.
function paintCrown(out: Pixmap, cx: number, oy: number, gold: Ramp, c: CabinetColors): void {
  const w = 26;
  const h = 13;
  const x0 = Math.round(cx - w / 2);
  const y0 = oy - h + 2;
  const m = new Mask(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const band = y >= h - 4;
      const spike = [2, 8, 13, 18, 23].some((sx) => Math.abs(x - sx) <= Math.max(0, (y - 1) * 0.55));
      if (!band && !spike) continue;
      m.put(x, y, band ? (y === h - 4 ? LIGHT : y === h - 1 ? SHADE : BASE) : x < w / 2 ? LIGHT : BASE);
    }
  }
  paintMask(out, m, gold, x0, y0);
  // Jewels: a ruby in the middle, sapphires either side, pearls on the tips.
  const ruby = pixel(c['--danger']);
  out.rect(x0 + 12, y0 + h - 3, 2, 2, ruby);
  out.set(x0 + 12, y0 + h - 3, 0xffffffff);
  out.set(x0 + 6, y0 + h - 2, pixel(c['--chrome-light']));
  out.set(x0 + 19, y0 + h - 2, pixel(c['--chrome-light']));
  for (const sx of [2, 8, 13, 18, 23]) out.set(x0 + sx, y0, 0xffffffff);
}

// A round topiary bush on the Hamster Maze's shoulders.
function paintTopiary(out: Pixmap, cx: number, oy: number, body: Ramp): void {
  const m = new Mask(10, 10);
  m.ball(5, 5, 4.6, 4.6);
  paintMask(out, m, body, Math.round(cx - 5), oy - 9);
}

// A gold combination dial on the Acorn Vault's top.
function paintDial(out: Pixmap, cx: number, oy: number, gold: Ramp, chrome: Ramp): void {
  const r = 8;
  const m = new Mask(r * 2 + 2, r * 2 + 2);
  m.ball(r + 1, r + 1, r, r);
  paintMask(out, m, gold, Math.round(cx - r - 1), oy - r - 2);
  const inner = new Mask(r * 2, r * 2);
  inner.ball(r, r, r - 3, r - 3);
  paintMask(out, inner, chrome, Math.round(cx - r), oy - r - 1);
  // Its notches, and the pointer.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    out.set(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(oy - 1 + Math.sin(a) * (r - 1)), gold.deep);
  }
  out.vline(Math.round(cx), oy - r - 1, oy - r + 1, chrome.ink);
}

// Old Clunky's topper: a chrome cap with a big bulb (it's a toy: one bulb, lots of charm).
function paintClunkyTop(out: Pixmap, cx: number, oy: number, chrome: Ramp, c: CabinetColors): void {
  const m = new Mask(12, 5);
  m.box(0, 0, 12, 5, 1);
  paintMask(out, m, chrome, Math.round(cx - 6), oy - 4);
  const bulb = new Mask(8, 8);
  bulb.ball(4, 4, 3.6, 3.6);
  paintMask(out, bulb, ramp(c['--danger'], c['--danger-dark'], mixCss(c['--danger-dark'], c['--outline-ink'], 0.5)), Math.round(cx - 4), oy - 11);
}

// A mouse hole at the foot of the Big Cheese.
function paintMouseHole(out: Pixmap, x: number, y: number, ink: Pixel, body: Ramp): void {
  for (let yy = -6; yy < 0; yy++) {
    for (let xx = 0; xx < 8; xx++) {
      const d = Math.hypot(xx + 0.5 - 4, (yy + 0.5) * 0.8);
      if (d < 3.6) out.set(x + xx, y + yy, ink);
      else if (d < 4.6 && yy < -1) out.set(x + xx, y + yy, body.deep);
    }
  }
}

// Moving Day's open flaps, behind the top of the box.
function paintFlaps(out: Pixmap, ox: number, oy: number, W: number, body: Ramp): void {
  const flap = (x0: number, x1: number, lean: number) => {
    const m = new Mask(Math.abs(x1 - x0) + 12, 12);
    for (let y = 0; y < 10; y++) {
      const shift = Math.round((10 - y) * lean);
      for (let x = 0; x < Math.abs(x1 - x0); x++) m.put(x + 6 + shift, y, y === 0 ? LIGHT : x < 2 ? LIGHT : x > Math.abs(x1 - x0) - 3 ? SHADE : BASE);
    }
    paintMask(out, m, body, Math.min(x0, x1) - 6, oy - 10);
  };
  flap(ox + 1, ox + Math.round(W * 0.45), -0.45);
  flap(ox + Math.round(W * 0.55), ox + W - 1, 0.45);
}

// The lever's ball (13×13), or the Snack Stacker's square push button (11×11), in the machine's colours.
const KNOBS: Record<string, [string, string]> = {
  clunky: ['--danger', '--danger-dark'], stacker: ['--gold', '--gold-dark'], bonanza: ['--bonanza-grass', '--bonanza-grass-dark'],
  palace: ['--palace-gold', '--gold-dark'], maze: ['--maze-light', '--maze'], vault: ['--gold', '--gold-dark'],
  cheese: ['--cheese-rind', '--cheese-rind-dark'], moving: ['--box-tape', '--box-dark'],
};
export function paintKnob(id: string, colors: CabinetColors): Pixmap {
  const c = painted(colors);
  const [a, b] = KNOBS[id] || KNOBS.clunky;
  const r = ramp(c[a as keyof CabinetColors], c[b as keyof CabinetColors], mixCss(c[b as keyof CabinetColors], c['--outline-ink'], 0.55));
  if (id === 'stacker') {
    const out = new Pixmap(11, 11);
    const m = new Mask(9, 9);
    m.box(0, 0, 9, 9, 2);
    m.put(2, 2, HILITE);
    paintMask(out, m, r, 1, 1);
    return out;
  }
  const out = new Pixmap(13, 13);
  const m = new Mask(11, 11);
  m.ball(5.5, 5.5, 5.5, 5.5);
  paintMask(out, m, r, 1, 1);
  return out;
}

// mix() for two CSS colours, giving a CSS colour back.
function mixCss(a: string, b: string, t: number): string {
  const p = mixPixel(pixel(a), pixel(b), t);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(p & 0xff)}${hex((p >>> 8) & 0xff)}${hex((p >>> 16) & 0xff)}`;
}

// ─────────────────────── on the page ───────────────────────

// The cabinet canvas inside the machine element, the bulbs' canvas over it, and when
// to repaint (the machine's or its sign's size changes, a skin, a switch).
export function createCabinet(machine: HTMLElement, { starred }: { starred: () => boolean }) {
  const base = document.createElement('canvas');
  base.className = 'cabinet-canvas';
  const lights = document.createElement('canvas');
  lights.className = 'cabinet-canvas cabinet-lights';
  machine.prepend(base, lights);
  const q = (sel: string) => machine.querySelector<HTMLElement>(sel);
  let dirty = true;
  let cab: Cabinet | null = null;
  let onPix: Pixel = 0;
  let offPix: Pixel = 0;
  let glowPix: Pixel = 0;
  let haloPix: [Pixel, Pixel] = [0, 0]; // the free-spins glow: gold, then pink as it pulses
  let lastLit = '';
  let lastStarred = false;
  const ro = new ResizeObserver(() => { dirty = true; });
  ro.observe(machine);
  const sign = q('.marquee');
  if (sign) ro.observe(sign);

  const rectOf = (el: HTMLElement | null): Rect | null => {
    if (!el || el.offsetParent === null) return null;
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
  };

  function repaint(): void {
    dirty = false;
    const w = machine.clientWidth;
    const h = machine.clientHeight;
    if (!w || !h) return;
    const colors = readTokens(machine, CABINET_TOKENS);
    const parts: CabinetParts = {
      w, h, sign: rectOf(q('.marquee')), window: rectOf(q('.reel-window')), meter: rectOf(q('.win-meter')), lever: rectOf(q('.lever')),
    };
    const id = machine.dataset.machine || 'clunky';
    lastStarred = starred();
    cab = paintCabinet(id, parts, colors, lastStarred);
    cab.pix.toCanvas(base);
    // The lever's ball (or the Stacker's button), painted in this machine's colours.
    const knob = q('.lever-knob');
    if (knob) {
      const kc = document.createElement('canvas');
      paintKnob(id, colors).toCanvas(kc);
      knob.style.setProperty('--knob-sprite', `url("${kc.toDataURL()}")`);
    }
    lights.width = cab.pix.w;
    lights.height = cab.pix.h;
    for (const cv of [base, lights]) {
      cv.style.left = `${cab.left}px`;
      cv.style.top = `${cab.top}px`;
      cv.style.width = `${cab.pix.w * CAB_PX}px`;
      cv.style.height = `${cab.pix.h * CAB_PX}px`;
    }
    onPix = pixel(colors['--bulb-on']);
    offPix = pixel(colors['--bulb-off']);
    glowPix = withAlpha(pixel(colors['--bulb-on']), 0.35);
    haloPix = [pixel(colors['--gold']), pixel(colors['--primary'])];
    lastLit = '';
  }

  // Every frame: which bulbs are lit. At rest a slow chase, spinning a fast one, a
  // win flashes them all, a teasing reel makes them race. With Motion "Less" they just glow.
  function render(now: number, mode: { spinning: boolean; winning: boolean; teasing: boolean; still: boolean; glow: boolean }): void {
    if (starred() !== lastStarred) dirty = true;
    if (dirty) repaint();
    if (!cab) return;
    const n = cab.bulbs.length;
    let lit: boolean[];
    if (mode.still) lit = cab.bulbs.map(() => true);
    else if (mode.winning) lit = cab.bulbs.map(() => Math.floor(now / 120) % 2 === 0);
    else {
      const speed = mode.teasing ? 40 : mode.spinning ? 70 : 260; // ms per step
      const step = Math.floor(now / speed);
      lit = cab.bulbs.map((_, i) => (i + step) % 3 === 0);
    }
    // Free spins (1.5.0): a halo glows round the cabinet, pulsing between gold and pink
    // (painted here, a few steps a second: a CSS glow on the moving machine cost too much).
    const pulse = mode.glow ? (mode.still ? 2 : Math.floor(now / 110) % 8) : -1;
    const key = `${lit.map((b) => (b ? 1 : 0)).join('')}|${pulse}`;
    if (key === lastLit) return;
    lastLit = key;
    const ctx = lights.getContext('2d')!;
    const img = ctx.createImageData(lights.width, lights.height);
    const data = new Uint32Array(img.data.buffer);
    const put = (x: number, y: number, p: Pixel) => { if (x >= 0 && y >= 0 && x < lights.width && y < lights.height) data[y * lights.width + x] = p; };
    if (pulse >= 0) {
      const t = pulse < 4 ? pulse / 3 : (7 - pulse) / 3; // 0 → 1 → 0
      const col = mixPixel(haloPix[0], haloPix[1], t);
      cab.halo.forEach((ring, k) => {
        const a = [1, 1, 0.55][k];
        for (const p of ring) if (k < 2 || (p.x + p.y) % 2) put(p.x, p.y, withAlpha(col, a));
      });
    }
    for (let i = 0; i < n; i++) {
      const b = cab.bulbs[i];
      if (lit[i]) {
        for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2], [-1, 1], [2, 1]]) put(b.x + dx, b.y + dy, glowPix);
        put(b.x, b.y, 0xffffffff);
        put(b.x + 1, b.y, onPix);
        put(b.x, b.y + 1, onPix);
        put(b.x + 1, b.y + 1, onPix);
      } else {
        put(b.x, b.y, offPix);
        put(b.x + 1, b.y, offPix);
        put(b.x, b.y + 1, offPix);
        put(b.x + 1, b.y + 1, offPix);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  return { invalidate() { dirty = true; }, render };
}
