// paint.ts — VIEW layer. A tiny pixel-art painter, shared by the painted scenes
// (1.5.0, "The Glow Up"): the cage and the room behind it (cage.ts), the hamster
// wheel (wheel.ts) and the slot machine cabinets (cabinet.ts).
//
// Why paint in code? Sprites (art.ts) are small squares, but a cage or a machine
// cabinet has to fit any size. So these are painted pixel by pixel on a small
// canvas, and CSS scales the canvas up by a whole number with crisp pixels
// (image-rendering: pixelated), exactly like a sprite drawn at 2×. The Big Cage's
// tree (bigtree.ts) is painted the same way.
//
// The pixel-art rules still hold: every material has a small colour ramp (light
// from the top-left, shade towards the bottom-right) and its own darker outline;
// blends are dithered (a checkerboard), never smooth. Every colour comes from a
// theme token in style.css :root (rule 11), read with readTokens().

// One pixel for a Uint32Array laid over ImageData: its bytes are R, G, B, A
// (little-endian, which every browser is), so the number reads as 0xAABBGGRR.
export type Pixel = number;

const parsed = new Map<string, [number, number, number, number]>();

// Any CSS colour a token can hold ("#rgb", "#rrggbb", "#rrggbbaa", "rgb(…)", "rgba(…)")
// as [r, g, b, a] with a from 0 to 1. Anything else asks the browser (a 1×1 canvas).
export function rgba(css: string): [number, number, number, number] {
  const key = css.trim();
  const hit = parsed.get(key);
  if (hit) return hit;
  let out: [number, number, number, number] = [0, 0, 0, 1];
  const hex = key.match(/^#([0-9a-f]{3,8})$/i);
  const fn = key.match(/^rgba?\(([^)]+)\)$/i);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  } else if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map((p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
    out = [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? Math.min(1, fn[1].includes('%') && parts[3] > 1 ? parts[3] / 255 : parts[3]) : 1];
  } else if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    out = [d[0], d[1], d[2], d[3] / 255];
  }
  parsed.set(key, out);
  return out;
}

// A colour as a Pixel (fully opaque unless the colour itself is see-through).
export function pixel(css: string): Pixel {
  const [r, g, b, a] = rgba(css);
  return ((Math.round(a * 255) << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
const R = (p: Pixel) => p & 0xff;
const G = (p: Pixel) => (p >>> 8) & 0xff;
const B = (p: Pixel) => (p >>> 16) & 0xff;
const A = (p: Pixel) => p >>> 24;
const make = (r: number, g: number, b: number, a = 255): Pixel => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

// Mix two pixels: t = 0 gives a, t = 1 gives b (for working out a shade from two tokens).
export function mixPixel(a: Pixel, b: Pixel, t: number): Pixel {
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return make(m(R(a), R(b)), m(G(a), G(b)), m(B(a), B(b)), m(A(a), A(b)));
}
// Mix two CSS colours into a Pixel.
export const mix = (a: string, b: string, t: number): Pixel => mixPixel(pixel(a), pixel(b), t);
// A pixel with a new alpha (0–1).
export const withAlpha = (p: Pixel, a: number): Pixel => ((p & 0x00ffffff) | (Math.round(a * 255) << 24)) >>> 0;

// A small, fixed "random" number (0–1) from a seed, so painted details never jump about.
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export const hash2 = (x: number, y: number) => hash(x * 57.31 + y * 113.97);

// The theme tokens an element sees right now (a skin may have changed some on the stage).
export function readTokens<T extends string>(el: Element, names: readonly T[]): Record<T, string> {
  const css = getComputedStyle(el);
  const out = {} as Record<T, string>;
  for (const n of names) out[n] = css.getPropertyValue(n).trim() || '#ff00ff'; // magenta = a missing token (tests catch it)
  return out;
}

// ─────────────────────── the pixmap ───────────────────────

// A picture being painted: w × h pixels. Everything is clipped to its edges.
export class Pixmap {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.data = new Uint32Array(this.w * this.h);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): Pixel {
    return this.inside(x, y) ? this.data[y * this.w + x] : 0;
  }
  // One pixel. A see-through colour is blended over what's there.
  set(x: number, y: number, p: Pixel): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const a = A(p);
    if (a >= 255) this.data[y * this.w + x] = p;
    else if (a > 0) this.data[y * this.w + x] = over(this.data[y * this.w + x], p);
  }
  // A filled rectangle.
  rect(x: number, y: number, w: number, h: number, p: Pixel): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    const solid = A(p) >= 255;
    for (let yy = y0; yy < y1; yy++) {
      if (solid) this.data.fill(p, yy * this.w + x0, yy * this.w + x1);
      else for (let xx = x0; xx < x1; xx++) this.set(xx, yy, p);
    }
  }
  // Make a rectangle see-through again (a hole: whatever is behind the canvas shows).
  clear(x: number, y: number, w: number, h: number): void {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.h, Math.floor(y + h)); yy++) {
      this.data.fill(0, yy * this.w + Math.max(0, Math.floor(x)), yy * this.w + Math.min(this.w, Math.floor(x + w)));
    }
  }
  // A rectangle filled with a checkerboard of two colours (the pixel-art way to blend them).
  dither(x: number, y: number, w: number, h: number, a: Pixel, b: Pixel, phase = 0): void {
    for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) this.set(xx, yy, (xx + yy + phase) % 2 ? b : a);
  }
  hline(x0: number, x1: number, y: number, p: Pixel): void {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, p);
  }
  vline(x: number, y0: number, y1: number, p: Pixel): void {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, p);
  }
  // A line one pixel thick (Bresenham), with no gaps.
  line(x0: number, y0: number, x1: number, y1: number, p: Pixel): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.set(x0, y0, p);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // A filled disc / ellipse (pixel centres inside it).
  ellipse(cx: number, cy: number, rx: number, ry: number, p: Pixel): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, p);
      }
    }
  }
  // Copy another pixmap on top (its see-through pixels let this one show).
  draw(src: Pixmap, x: number, y: number): void {
    for (let yy = 0; yy < src.h; yy++) {
      for (let xx = 0; xx < src.w; xx++) {
        const p = src.data[yy * src.w + xx];
        if (A(p)) this.set(x + xx, y + yy, p);
      }
    }
  }
  // Put the picture on a canvas (sized to it).
  toCanvas(canvas: HTMLCanvasElement): void {
    if (canvas.width !== this.w) canvas.width = this.w;
    if (canvas.height !== this.h) canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(this.w, this.h);
    new Uint32Array(image.data.buffer).set(this.data);
    ctx.putImageData(image, 0, 0);
  }
}

// `top` (maybe see-through) over `bottom`.
function over(bottom: Pixel, top: Pixel): Pixel {
  const a = A(top) / 255;
  const b = A(bottom) / 255;
  const outA = a + b * (1 - a);
  if (outA <= 0) return 0;
  const ch = (t: number, u: number) => Math.round((t * a + u * b * (1 - a)) / outA);
  return make(ch(R(top), R(bottom)), ch(G(top), G(bottom)), ch(B(top), B(bottom)), Math.round(outA * 255));
}

// ─────────────────────── masks: shapes first, colours after ───────────────────────

// A mask marks which pixels belong to a shape, and which part of its ramp each gets:
// 0 = empty, then LIGHT, BASE, SHADE, DEEP (and HILITE, the brightest spot). Painting a
// shape as a mask first, then colouring it, is what lets every shape get its own
// outline (outline()), like the sprites.
export const HILITE = 1;
export const LIGHT = 2;
export const BASE = 3;
export const SHADE = 4;
export const DEEP = 5;
export class Mask {
  readonly w: number;
  readonly h: number;
  readonly m: Uint8Array;
  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.m = new Uint8Array(this.w * this.h);
  }
  at(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.m[y * this.w + x] : 0;
  }
  put(x: number, y: number, v: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = v;
  }
  // A shaded ellipse: light from the top-left, shade and deep shade towards the
  // bottom-right, like a ball under a lamp (a small bright spot near the top-left).
  // `light`, `shade` and `deep` move where the ramp's steps fall (higher = less light,
  // more shade), for materials that should look soft (fur) or glossy (a ball).
  ball(cx: number, cy: number, rx: number, ry: number,
    { spot = true, flat = 0, light = 0.62, shade = 0.18, deep = -0.25, hilite = 0.92 }:
    { spot?: boolean; flat?: number; light?: number; shade?: number; deep?: number; hilite?: number } = {}): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d) * (1 - flat) + flat;
        const lit = -nx * 0.5 - ny * 0.62 + nz * 0.6; // the light comes from the top-left, a bit in front
        let v = lit > light ? LIGHT : lit > shade ? BASE : lit > deep ? SHADE : DEEP;
        if (spot && lit > hilite) v = HILITE;
        this.put(x, y, v);
      }
    }
  }
  // A box shaded like a bevel: the top and left edges light, the bottom and right edges shade.
  box(x: number, y: number, w: number, h: number, bevel = 1): void {
    for (let yy = Math.floor(y); yy < y + h; yy++) {
      for (let xx = Math.floor(x); xx < x + w; xx++) {
        const top = yy - y < bevel;
        const left = xx - x < bevel;
        const bottom = y + h - 1 - yy < bevel;
        const right = x + w - 1 - xx < bevel;
        this.put(xx, yy, bottom || right ? SHADE : top || left ? LIGHT : BASE);
      }
    }
  }
  // Every pixel of the ramp value `from` becomes `to` (e.g. DEEP → SHADE for a flatter look).
  swap(from: number, to: number): void {
    for (let i = 0; i < this.m.length; i++) if (this.m[i] === from) this.m[i] = to;
  }
  // Is this empty pixel next to the shape (up, down, left or right)?
  edge(x: number, y: number): boolean {
    return !this.at(x, y) && !!(this.at(x - 1, y) || this.at(x + 1, y) || this.at(x, y - 1) || this.at(x, y + 1));
  }
}

// A ramp: the colours a mask's values become, [HILITE, LIGHT, BASE, SHADE, DEEP], and
// the outline around it (0 = no outline).
export interface Ramp { hilite: Pixel; light: Pixel; base: Pixel; shade: Pixel; deep: Pixel; ink: Pixel }
// A ramp from a base colour, its shade and its outline tokens (the light and hilite are
// mixed towards white, the deep shade halfway to the outline).
export function ramp(base: string, shade: string, ink: string, light?: string): Ramp {
  const b = pixel(base);
  const s = pixel(shade);
  const k = pixel(ink);
  const l = light ? pixel(light) : mixPixel(b, 0xffffffff, 0.4);
  return { hilite: mixPixel(l, 0xffffffff, 0.55), light: l, base: b, shade: s, deep: mixPixel(s, k, 0.45), ink: k };
}

// Colour a mask onto a pixmap with a ramp; `outline` adds its ink around the shape.
export function paintMask(out: Pixmap, mask: Mask, r: Ramp, ox = 0, oy = 0, outline = true): void {
  const cols = [0, r.hilite, r.light, r.base, r.shade, r.deep];
  for (let y = -1; y <= mask.h; y++) {
    for (let x = -1; x <= mask.w; x++) {
      const v = mask.at(x, y);
      if (v) out.set(ox + x, oy + y, cols[v]);
      else if (outline && r.ink && mask.edge(x, y)) out.set(ox + x, oy + y, r.ink);
    }
  }
}
