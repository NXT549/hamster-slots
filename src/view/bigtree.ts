// bigtree.ts — VIEW layer. The family's tree in the Big Cage (M15).
//
// Retiring plants an Heirloom Seed and the family's tree grows in a meadow, with the
// Family Tree's traits on it. The tree grows with the family: it starts as a sapling
// holding the first trait, and every trait you plant makes it grow, the trunk up to
// the next level and a branch out to the traits that trait unlocks (the user's pick:
// a trait only appears once the one it needs is planted). Three parts:
//   1) treeLayout(): where the trunk, the branches and every trait go in the grown
//      tree, for a scene of any size. Pure maths (no DOM), so tests/bigtree.test.js can
//      check that the traits never overlap, from a phone up to a big screen. A trait
//      never moves as the tree grows: the tree grows out to it.
//   2) treeShape() and leafClumps(): how big the tree is for the traits the family can
//      see (how tall the trunk, how far each branch), and where its leaves go.
//   3) drawTree(): paints the meadow and the tree as real pixel art on a small canvas
//      (each canvas pixel is `px` screen pixels, like a sprite drawn at 2× or 3×), at any
//      size it has grown to, shaded from the top-left with an outline around each part.
//
// The levels: the first trait of the Roots (data.json's first branch, Family Pride)
// sits at the foot of the trunk and every other trait needs it; each other branch's
// first trait sits on the lowest level, its second one level up, its third at the
// top, always in the same column (so a trait is right above the one it needs). Half
// the branches are columns on the left, half on the right; the Roots' other traits
// sit on the trunk. Colours are theme tokens (style.css :root, TREE_TOKENS below).

export interface Point { x: number; y: number }
// One branch of the Family Tree, from data.json: its id and its traits in order.
export interface BranchIn { id: string; nodes: string[] }
// A trait's spot: its centre in screen pixels, its level, and where it grows from:
// a limb (limb ≥ 0, `t` along it, 0 = the trunk) or the trunk (limb -1).
export interface NodeSpot extends Point { id: string; branch: number; tier: number; limb: number; t: number }
// A limb: one level's branch on one side, a curve from the trunk out to its tip.
export interface Limb { tier: number; side: -1 | 1; p0: Point; p1: Point; p2: Point }
export interface Layout {
  width: number; height: number; px: number; // the scene in screen pixels, and screen pixels per canvas pixel
  ground: number; // the ground line (screen pixels from the top)
  base: Point; // the foot of the trunk
  tiers: number[]; // the height (y) of each level: 0 = the foot's trait, then the branches' levels
  fullTop: number; // the top of the trunk when the tree is fully grown
  trunkR0: number; // the trunk's radius at the foot, fully grown
  leaf: number; // the size of a bunch of leaves
  limbs: Limb[];
  nodes: NodeSpot[];
  node: { w: number; h: number; up: number }; // a trait's box, for the overlap checks
}

// How much room a trait takes in a scene of this width (style.css .bt-node matches):
// w × h, starting `up` pixels above its centre. Below 820 px the traits are small
// icons (tap one to read its name); from 820 px they're bigger, with their name under them.
export const COMPACT_BELOW = 820;
export function nodeBox(width: number): { w: number; h: number; up: number } {
  if (width < 360) return { w: 38, h: 46, up: 23 }; // the smallest phones
  return width < COMPACT_BELOW ? { w: 44, h: 52, up: 26 } : { w: 96, h: 88, up: 36 };
}

// A point on a curved branch (a quadratic Bézier curve: from p0, pulled towards p1, to p2).
export function bezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
// How far along a limb (t) it reaches a given x (x grows steadily along it, so halve the range).
function tAtX(l: Limb, x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if ((bezier(l.p0, l.p1, l.p2, mid).x - x) * l.side < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function treeLayout(width: number, height: number, trunk: string[], branches: BranchIn[]): Layout {
  const px = width < 600 ? 2 : 3;
  const levels = Math.max(1, ...branches.map((b) => b.nodes.length)); // the branches' levels (3; 4 with 1.4.0's colony traits)
  const crowded = levels > 3; // a migrated family's tree (1.4.0) has a 4th level
  const node = crowded && height < 340 ? nodeBox(0) : nodeBox(width); // (a short scene: the smallest traits)
  const cx = Math.round(width / 2);
  const ground = Math.round(height * 0.9);
  const base = { x: cx, y: ground };
  const tiers = [ground - height * 0.1];
  const yHigh = height * 0.24;
  // The levels share the space from yLow up to yHigh. A 4th level would crowd the
  // traits into each other, so then the first level starts as low as it can (just
  // clear of the trait at the foot), each gap is at least a trait's height, and the
  // tree climbs higher, but never so high that a trait on the top limb (whose tip
  // rises a little) leaves the scene.
  const yLow = crowded ? Math.max(height * 0.62, tiers[0] - node.h - 2) : height * 0.62;
  const gaps = Math.max(1, levels - 1);
  const rise = height * 0.06;
  const gap = crowded ? Math.min(Math.max((yLow - yHigh) / gaps, node.h + 2), (yLow - node.up - 2 - rise) / gaps) : (yLow - yHigh) / gaps;
  for (let k = 0; k < levels; k++) tiers.push(levels > 1 ? yLow - k * gap : (yLow + yHigh) / 2);
  const perSide = Math.ceil(branches.length / 2);
  // The columns: the inner one a little way out from the trunk, the outer one near the edge.
  const spread = Math.min(width * 0.41, height * 0.62);
  const cols = Array.from({ length: perSide }, (_, j) => spread * (perSide > 1 ? 0.37 + (j * 0.63) / (perSide - 1) : 0.7));
  const tip = Math.min(width * 0.05, width * 0.48 - spread); // a limb reaches a little past its last column
  const limbs: Limb[] = [];
  const limbOf = new Map<string, number>();
  for (let tier = 1; tier <= levels; tier++) {
    for (const side of [-1, 1] as const) {
      const y = tiers[tier];
      limbOf.set(`${tier}|${side}`, limbs.length);
      limbs.push({
        tier, side,
        p0: { x: cx, y: y + height * 0.025 },
        p1: { x: cx + side * spread * 0.45, y: y + height * 0.005 },
        p2: { x: cx + side * (spread + tip), y: y - height * 0.06 },
      });
    }
  }
  const nodes: NodeSpot[] = [];
  // The Roots: the first trait at the foot of the trunk, the others on the trunk, a level each.
  trunk.forEach((id, k) => {
    const tier = Math.min(k, tiers.length - 1);
    nodes.push({ id, branch: -1, tier, limb: -1, t: 0, x: cx, y: Math.round(tiers[tier]) });
  });
  branches.forEach((b, i) => {
    const side: -1 | 1 = i < perSide ? -1 : 1;
    const col = cols[i < perSide ? i : i - perSide];
    b.nodes.forEach((id, d) => {
      const limb = limbOf.get(`${d + 1}|${side}`)!;
      const l = limbs[limb];
      const t = tAtX(l, cx + side * col);
      const p = bezier(l.p0, l.p1, l.p2, t);
      nodes.push({ id, branch: i, tier: d + 1, limb, t, x: Math.round(p.x), y: Math.round(p.y) });
    });
  });
  return {
    width, height, px, ground, base, tiers, fullTop: tiers[tiers.length - 1] - height * 0.1,
    trunkR0: Math.max(9, Math.min(26, width * 0.026)), leaf: Math.max(16, Math.min(56, Math.min(width, height) * 0.065)),
    limbs, nodes, node,
  };
}

// ─────────────────────── growing ───────────────────────

// How big the tree is when the family can see these traits (the planted ones and the
// ones they unlock). trunk: how tall, as a share of the grown trunk (a sapling if only
// the first trait shows); girth: how thick (0–1); reach: how far each limb has grown out
// (0 = not yet, 1 = to its tip): just past the last trait on it that shows.
export interface Shape { trunk: number; girth: number; reach: number[]; tier: number }
export function treeShape(layout: Layout, shown: Set<string>): Shape {
  const visible = layout.nodes.filter((n) => shown.has(n.id));
  const tier = Math.max(0, ...visible.map((n) => n.tier));
  const top = tier === 0 ? layout.tiers[0] - layout.height * 0.13 : layout.tiers[tier] - layout.height * 0.1;
  const trunk = Math.min(1, (layout.ground - top) / (layout.ground - layout.fullTop));
  const reach = layout.limbs.map((_, i) => {
    const on = visible.filter((n) => n.limb === i);
    return on.length ? Math.min(1, Math.max(...on.map((n) => n.t)) + 0.08) : 0;
  });
  return { trunk, girth: 0.4 + (0.6 * tier) / Math.max(1, layout.tiers.length - 1), reach, tier };
}

// Where the trunk's top is when it has grown to `trunk` (a share of the grown trunk).
export function trunkTop(layout: Layout, trunk: number): number {
  return layout.ground - (layout.ground - layout.fullTop) * trunk;
}

// A bunch of leaves: where, how big, and what has to grow first for it to sprout
// (the trunk to a height, or its limb out to a point). The key names it (for its pop).
export interface Clump extends Point { key: string; r: number; limb: number; need: number }
// The leaves for these traits, on a tree grown to `drawn` (the crown rides on the
// trunk's top and a limb's leafy tip on its end, so they move as the tree grows).
export function leafClumps(layout: Layout, shown: Set<string>, drawn: { trunk: number; reach: number[] }, shape: Shape): Clump[] {
  const out: Clump[] = [];
  const R = layout.leaf;
  // On a phone the traits are big for the tree, so the leaves go by their size too.
  const rTrait = Math.max(R * 1.25, layout.node.w * 0.85);
  const rMid = Math.max(R * 0.85, layout.node.w * 0.6);
  const rCrown = Math.max(R * 1.5, layout.node.w * 1.1);
  // A big bunch behind each trait that shows on a limb, so the traits sit in the
  // leaves like fruit; side by side, the bunches grow together into the canopy.
  const onLimb = new Map<number, number[]>();
  for (const n of layout.nodes) {
    if (n.limb < 0 || !shown.has(n.id)) continue;
    out.push({ key: `t:${n.id}`, x: n.x, y: n.y - layout.node.up * 0.35, r: rTrait, limb: n.limb, need: n.t });
    onLimb.set(n.limb, [...(onLimb.get(n.limb) || []), n.t]);
  }
  layout.limbs.forEach((l, i) => {
    // Smaller bunches along the limb, between the trunk and its traits…
    const ts = [0.12, ...(onLimb.get(i) || []).sort((a, b) => a - b)];
    for (let k = 1; k < ts.length; k++) {
      const t = (ts[k - 1] + ts[k]) / 2;
      const p = bezier(l.p0, l.p1, l.p2, t);
      out.push({ key: `m:${i}:${k}`, x: p.x, y: p.y - rMid * 0.5, r: rMid, limb: i, need: t });
    }
    // …and a leafy tip on its end, which rides out as the limb grows.
    const reach = drawn.reach[i] || 0;
    if (reach <= 0.04) return;
    const p = bezier(l.p0, l.p1, l.p2, reach);
    out.push({ key: `tip:${i}`, x: p.x + l.side * rMid * 0.3, y: p.y - rMid * 0.35, r: rMid * 0.95, limb: i, need: 0.04 });
  });
  // The crown on top of the trunk: small on a sapling, big and wide on a grown tree.
  const top = trunkTop(layout, drawn.trunk);
  const big = 0.55 + 0.45 * (shape.tier / Math.max(1, layout.tiers.length - 1));
  const rc = rCrown * big;
  out.push({ key: 'crown:0', x: layout.base.x, y: top, r: rc, limb: -1, need: 0.05 });
  if (shape.tier >= 1) {
    out.push({ key: 'crown:1', x: layout.base.x - rc * 0.9, y: top + rc * 0.37, r: rc * 0.73, limb: -1, need: 0.1 });
    out.push({ key: 'crown:2', x: layout.base.x + rc * 0.9, y: top + rc * 0.37, r: rc * 0.73, limb: -1, need: 0.1 });
  }
  return out;
}

// ─────────────────────── painting ───────────────────────

// Every colour drawTree uses: theme tokens in style.css :root (tests/bigtree.test.js checks them).
export const TREE_TOKENS = [
  '--sky-top', '--sky-bottom', '--sun', '--cloud', '--cloud-shade', '--hill-far', '--hill-near',
  '--grass', '--grass-dark', '--grass-light', '--soil', '--soil-dark',
  '--bark', '--bark-light', '--bark-dark', '--bark-ink', '--leaf', '--leaf-light', '--leaf-dark', '--leaf-ink',
  '--blossom',
] as const;
export type TreeColors = Record<(typeof TREE_TOKENS)[number], string>;

// The tree as it's drawn right now (bigcage.ts eases these towards treeShape()).
export interface Drawn {
  trunk: number; // how tall (a share of the grown trunk)
  girth: number; // how thick (0–1)
  reach: number[]; // how far out each limb has grown (0–1)
  clumps: (Clump & { scale: number })[]; // the leaves, each scaled 0–1 (a little over while it pops)
  mound: number; // the little mound of soil where the seed went in (0–1)
  blossoms: number; // how many blossoms (one for every trait level the family has planted)
}

// "#rrggbb" → one pixel for a Uint32Array over ImageData (its bytes are R, G, B, A).
function pixel(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}
// A small, fixed "random" number from a seed, so the clouds and leaves never jump about.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Mask values: which ramp colour a pixel of wood or leaves gets.
const BASE = 1;
const LIGHT = 2;
const SHADE = 3;
const BLOSSOM = 4; // a flower's middle (sun yellow)
const PETAL = 5; // its petals (blossom pink)

// A filled, shaded disc (light towards the top-left, shade towards the bottom-right).
function stamp(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, bumpy = 0): void {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      // A leaf clump's edge wobbles a little (bumpy), so it looks leafy, not round.
      const edge = bumpy ? rr * (1 + bumpy * Math.sin(Math.atan2(dy, dx) * 7 + cx)) : rr;
      if (dx * dx + dy * dy > edge) continue;
      const d = (dx + dy) * 0.7071; // along the light (top-left → bottom-right)
      mask[y * w + x] = d < -r * 0.35 ? LIGHT : d > r * 0.4 ? SHADE : BASE;
    }
  }
}

// The sky, sun, clouds, hills and ground: painted once per size (they never grow).
function paintBackdrop(out: Uint32Array, w: number, h: number, groundY: number, c: TreeColors): void {
  const sky0 = pixel(c['--sky-top']);
  const sky1 = pixel(c['--sky-bottom']);
  // The sky in four bands, dithered (a checkerboard) where they meet: the pixel-art way to blend.
  const skyMix = [sky0, sky0, sky1, sky1];
  const bandH = groundY / 3;
  for (let y = 0; y < groundY; y++) {
    const i = Math.floor(y / bandH);
    const intoNext = bandH - (y - i * bandH) <= 2; // the last two rows of a band…
    for (let x = 0; x < w; x++) {
      const upper = intoNext && (x + y) % 2 === 0; // …are dithered into the next one
      out[y * w + x] = skyMix[Math.min(3, upper ? i + 1 : i)];
    }
  }
  // The sun, top right, with a ring of dither around it.
  const sun = pixel(c['--sun']);
  const sx = w * 0.82;
  const sy = groundY * 0.2;
  const sr = Math.max(6, w * 0.045);
  for (let y = Math.floor(sy - sr * 1.5); y < sy + sr * 1.5; y++) {
    for (let x = Math.floor(sx - sr * 1.5); x < sx + sr * 1.5; x++) {
      if (x < 0 || y < 0 || x >= w || y >= groundY) continue;
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= sr || (d <= sr * 1.35 && (x + y) % 2 === 0)) out[y * w + x] = sun;
    }
  }
  // Clouds: a few puffs each, flat-bottomed, a shade along the bottom.
  const cloud = pixel(c['--cloud']);
  const cloudShade = pixel(c['--cloud-shade']);
  for (let k = 0; k < 4; k++) {
    const cxp = w * (0.08 + 0.26 * k + hash(k) * 0.1);
    const cyp = groundY * (0.12 + hash(k + 9) * 0.25);
    const size = Math.max(4, w * (0.025 + hash(k + 3) * 0.02));
    const bottom = cyp + size * 0.6;
    for (let p = 0; p < 4; p++) {
      const px = cxp + (p - 1.5) * size * 0.9;
      const py = cyp - (p === 1 || p === 2 ? size * 0.5 : 0);
      const r = size * (p === 1 || p === 2 ? 1 : 0.75);
      for (let y = Math.floor(py - r); y <= bottom; y++) {
        for (let x = Math.floor(px - r); x <= px + r; x++) {
          if (x < 0 || y < 0 || x >= w || y >= groundY) continue;
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > r) continue;
          out[y * w + x] = y > bottom - 2 ? cloudShade : cloud;
        }
      }
    }
  }
  // Two rows of rolling hills behind the ground.
  const hills: [string, number, number, number][] = [['--hill-far', 0.16, 0.05, 1.3], ['--hill-near', 0.08, 0.035, 2.1]];
  for (const [token, height, wave, freq] of hills) {
    const col = pixel(c[token as keyof TreeColors]);
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const top = groundY - groundY * (height + wave * Math.sin(t * Math.PI * freq * 2 + freq));
      for (let y = Math.max(0, Math.floor(top)); y < groundY; y++) out[y * w + x] = col;
    }
  }
  // The ground: a grass edge with tufts, then soil with pebbles.
  const grass = pixel(c['--grass']);
  const grassDark = pixel(c['--grass-dark']);
  const grassLight = pixel(c['--grass-light']);
  const soil = pixel(c['--soil']);
  const soilDark = pixel(c['--soil-dark']);
  const grassH = Math.max(3, Math.round((h - groundY) * 0.3));
  for (let y = groundY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = y - groundY;
      let col = d < grassH ? (d === 0 ? grassLight : d === grassH - 1 ? grassDark : grass) : soil;
      if (d >= grassH && hash(x * 31 + y * 17) > 0.965) col = soilDark; // pebbles
      if (d === grassH && x % 3 === 0) col = grassDark; // the grass's ragged bottom edge
      out[y * w + x] = col;
    }
  }
  // Grass tufts poking up above the edge, and little flowers in it.
  const petal = pixel(c['--blossom']);
  const middle = pixel(c['--sun']);
  for (let x = 1; x < w - 1; x += 2) {
    if (hash(x * 7) < 0.55) continue;
    const tall = hash(x * 13) > 0.6 ? 2 : 1;
    for (let k = 1; k <= tall; k++) if (groundY - k >= 0) out[(groundY - k) * w + x] = k === tall ? grassLight : grass;
  }
  for (let x = 3; x < w - 3; x += 5) {
    if (hash(x * 3.3) < 0.72 || Math.abs(x - w / 2) < w * 0.08) continue; // none right at the tree's foot
    const y = groundY - 3;
    if (y < 1) continue;
    out[(y + 1) * w + x] = grassDark; // the stem
    out[(y + 2) * w + x] = grassDark;
    out[y * w + x] = middle;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) out[(y + dy) * w + x + dx] = petal;
  }
}

// Paint the whole scene into ctx (a canvas `layout.width / px` pixels wide).
// The backdrop is cached per size (paint it once, copy it each frame).
let cache: { key: string; data: Uint32Array } | null = null;
export function drawTree(ctx: CanvasRenderingContext2D, layout: Layout, drawn: Drawn, colors: TreeColors): void {
  const { px } = layout;
  const w = Math.max(1, Math.floor(layout.width / px));
  const h = Math.max(1, Math.floor(layout.height / px));
  const groundY = Math.floor(layout.ground / px);
  const key = `${w}x${h}|${groundY}|${TREE_TOKENS.map((t) => colors[t]).join()}`;
  if (!cache || cache.key !== key) {
    const data = new Uint32Array(w * h);
    paintBackdrop(data, w, h, groundY, colors);
    cache = { key, data };
  }
  const image = ctx.createImageData(w, h);
  const out = new Uint32Array(image.data.buffer);
  out.set(cache.data);
  const wood = new Uint8Array(w * h);
  const leaves = new Uint8Array(w * h); // the lit leaves in front
  const back = new Uint8Array(w * h); // the darker leaves behind the branches (depth)
  const s = (v: number) => v / px; // screen pixels → canvas pixels
  const foot = { x: s(layout.base.x), y: s(layout.base.y) + 1 };
  const girth = 0.35 + 0.65 * drawn.girth; // a sapling is thin, a grown tree stout
  const R0 = s(layout.trunkR0) * girth;
  const tall = s(layout.base.y - trunkTop(layout, drawn.trunk));
  // How thick the trunk is at a height (it tapers to its top, and flares a little at the foot).
  const trunkR = (d: number) => {
    const f = tall > 0 ? d / tall : 0;
    const flare = f < 0.07 ? 1 + ((0.07 - f) / 0.07) * 0.5 : 1;
    return Math.max(0.8, R0 * (1 - 0.55 * f) * flare);
  };
  // The trunk sways a little (a gentle S), so it doesn't look like a post.
  const sway = (d: number) => Math.sin((d / Math.max(1, s(layout.base.y - layout.fullTop))) * Math.PI * 1.3) * R0 * 0.35;

  // A shadow under the tree, on the grass.
  if (drawn.trunk > 0.1) {
    const sw = Math.max(R0 * 3, s(layout.leaf) * (1 + 2.5 * drawn.girth));
    const shade = pixel(colors['--grass-dark']);
    for (let y = groundY; y < groundY + 3 && y < h; y++) {
      for (let x = Math.floor(foot.x - sw); x <= foot.x + sw; x++) {
        if (x < 0 || x >= w) continue;
        if (Math.abs(x - foot.x) / sw + (y - groundY) * 0.25 < 1 && (x + y) % 2 === 0) out[y * w + x] = shade;
      }
    }
  }

  if (drawn.trunk > 0) {
    // The trunk: stacked discs from the foot up.
    for (let d = 0; d <= tall; d += 0.5) stamp(wood, w, h, foot.x + sway(d), foot.y - d, trunkR(d));
    // Roots along the ground on both sides (once it's more than a sprout).
    if (drawn.girth > 0.2) {
      for (const side of [-1, 1]) {
        for (let k = 0; k <= 1; k += 0.05) {
          stamp(wood, w, h, foot.x + side * R0 * (0.7 + k * 1.5), foot.y - 1 + k * 2.5, Math.max(0.6, R0 * 0.32 * (1 - k)));
        }
      }
    }
    // Bark: little grooves running up the trunk (the shade colour), never at its edges.
    for (let y = Math.max(0, Math.floor(foot.y - tall)); y < Math.min(h, foot.y); y++) {
      for (let x = Math.floor(foot.x - R0 * 2); x < foot.x + R0 * 2; x++) {
        if (x < 1 || x >= w - 1) continue;
        const i = y * w + x;
        if (wood[i] === BASE && wood[i - 1] && wood[i + 1] && (x * 5 + Math.floor(y / 4) * 3) % 9 === 0) wood[i] = SHADE;
      }
    }
  }
  // The limbs, each grown as far out as drawn.reach says: thick at the trunk, thin at
  // the tip, with a little knot where each trait sits.
  layout.limbs.forEach((l, i) => {
    const g = drawn.reach[i] || 0;
    if (g <= 0) return;
    const p0 = { x: s(l.p0.x) + sway(s(layout.base.y - l.p0.y)), y: s(l.p0.y) };
    const p1 = { x: s(l.p1.x), y: s(l.p1.y) };
    const p2 = { x: s(l.p2.x), y: s(l.p2.y) };
    const r0 = Math.max(1, trunkR(s(layout.base.y - l.p0.y)) * 0.62);
    const steps = Math.ceil(Math.hypot(p2.x - p0.x, p2.y - p0.y) * 2);
    for (let k = 0; k <= steps * g; k++) {
      const t = k / steps;
      const p = bezier(p0, p1, p2, t);
      stamp(wood, w, h, p.x, p.y, Math.max(0.7, r0 * (1 - 0.7 * t)));
    }
    for (const n of layout.nodes) {
      if (n.limb !== i || n.t > g) continue;
      const p = bezier(p0, p1, p2, n.t);
      stamp(wood, w, h, p.x, p.y, Math.max(1.2, r0 * (1 - 0.7 * n.t) + 0.8));
    }
  });
  // The trunk goes into the ground: no wood below the grass (except the roots lying on it).
  for (let y = Math.max(0, groundY + 2); y < h; y++) wood.fill(0, y * w, (y + 1) * w);
  // The mound of soil where the seed went in (before the tree grows over it).
  if (drawn.mound > 0) {
    const mr = s(layout.trunkR0) * 1.3 * drawn.mound;
    for (let y = Math.floor(foot.y - mr * 0.6); y <= foot.y; y++) {
      for (let x = Math.floor(foot.x - mr); x <= foot.x + mr; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = (x + 0.5 - foot.x) / mr;
        const dy = (y + 0.5 - foot.y) / (mr * 0.6);
        if (dx * dx + dy * dy <= 1 && !wood[y * w + x]) out[y * w + x] = pixel(dy < -0.55 ? colors['--soil'] : colors['--soil-dark']);
      }
    }
  }
  // Leaves: every bunch is a few overlapping puffs, more of them on top, each shaded on
  // its own (so the bunch reads as layers of leaves, not one ball).
  drawn.clumps.forEach((c, i) => {
    if (c.scale <= 0) return;
    const r = s(c.r) * c.scale;
    const x = s(c.x) + (c.limb < 0 ? sway(tall) : 0);
    const y = s(c.y);
    // The back layer: a little bigger and lower, in the dark green, behind the branches.
    stamp(back, w, h, x + r * 0.12, y + r * 0.22, r * 0.98, 0.14);
    const puffs = 6;
    for (let k = 0; k < puffs; k++) {
      const a = Math.PI * (1.05 + (k / (puffs - 1)) * 0.9) + (hash(i * 7 + k) - 0.5) * 0.4; // around the top half
      stamp(leaves, w, h, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.42 + r * 0.12, r * (0.42 + hash(i + k * 5) * 0.12), 0.08);
    }
    stamp(leaves, w, h, x, y + r * 0.08, r * 0.62, 0.1); // the middle, drawn last, in front
  });
  // Leaf texture: a sprinkle of light and dark leaves (a fixed pattern, so it never flickers).
  for (let i = 0; i < leaves.length; i++) {
    if (!leaves[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const n = (x * 7 + y * 13) % 17;
    if (leaves[i] === BASE && n === 0) leaves[i] = LIGHT;
    else if (leaves[i] === BASE && (n === 5 || n === 11)) leaves[i] = SHADE;
  }
  // Blossoms: one for every trait level the family has planted (the tree blooms as you plant).
  const grown = drawn.clumps.filter((c) => c.scale >= 1);
  if (drawn.blossoms > 0 && grown.length) {
    let placed = 0;
    for (let k = 0; placed < drawn.blossoms && k < drawn.blossoms * 8; k++) {
      const c = grown[k % grown.length];
      const a = hash(k * 3.1) * Math.PI * 2;
      const d = s(c.r) * (0.2 + hash(k * 1.7) * 0.5);
      const bx = Math.round(s(c.x) + (c.limb < 0 ? sway(tall) : 0) + Math.cos(a) * d);
      const by = Math.round(s(c.y) + Math.sin(a) * d * 0.7);
      if (bx < 1 || by < 1 || bx >= w - 1 || by >= h - 1 || !leaves[by * w + bx]) continue;
      leaves[by * w + bx] = BLOSSOM; // a little flower: a yellow middle and four pink petals
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (leaves[(by + dy) * w + bx + dx]) leaves[(by + dy) * w + bx + dx] = PETAL;
      placed++;
    }
  }

  // Put it together: the lit leaves, then the wood, then the dark leaves behind it,
  // each with its own outline, over the backdrop.
  const woodCol = [0, pixel(colors['--bark']), pixel(colors['--bark-light']), pixel(colors['--bark-dark'])];
  const leafCol = [0, pixel(colors['--leaf']), pixel(colors['--leaf-light']), pixel(colors['--leaf-dark']), pixel(colors['--sun']), pixel(colors['--blossom'])];
  const woodInk = pixel(colors['--bark-ink']);
  const leafInk = pixel(colors['--leaf-ink']);
  const near = (m: Uint8Array, x: number, y: number) =>
    (x > 0 && m[y * w + x - 1]) || (x < w - 1 && m[y * w + x + 1]) || (y > 0 && m[(y - 1) * w + x]) || (y < h - 1 && m[(y + 1) * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (leaves[i]) out[i] = leafCol[leaves[i]];
      else if (near(leaves, x, y)) out[i] = leafInk;
      else if (wood[i]) out[i] = woodCol[wood[i]];
      else if (near(wood, x, y)) out[i] = woodInk;
      else if (back[i]) out[i] = back[i] === LIGHT ? leafCol[3] : (x + y) % 2 && back[i] === SHADE ? leafInk : leafCol[3];
      else if (near(back, x, y)) out[i] = leafInk;
    }
  }
  ctx.putImageData(image, 0, 0);
}
